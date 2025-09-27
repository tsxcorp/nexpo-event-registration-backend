const express = require('express');
// Temporarily use console.log instead of logger to avoid production crash
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};
const router = express.Router();
const { fetchEventDetails } = require('../utils/zohoEventUtils');
const { fetchEventDetailsREST } = require('../utils/zohoEventUtilsREST');

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lấy thông tin chi tiết sự kiện từ Zoho Creator
 *     description: |
 *       API trả về thông tin đầy đủ của sự kiện bao gồm form fields, sections, media, và danh sách exhibitors.
 *       
 *       **Modes:**
 *       - **Single Event**: Truyền eventId cụ thể (ví dụ: "4433256000012332047")
 *       - **List All Events**: Truyền "NEXPO" để lấy danh sách tất cả events
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           ID của sự kiện trong Zoho Creator hoặc "NEXPO" để lấy tất cả events
 *         examples:
 *           single_event:
 *             summary: Single Event
 *             value: "4433256000012332047"
 *           all_events:
 *             summary: List All Events
 *             value: "NEXPO"
 *     responses:
 *       200:
 *         description: Dữ liệu sự kiện thành công
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SingleEventResponse'
 *                 - $ref: '#/components/schemas/EventListResponse'
 *       400:
 *         description: Thiếu eventId parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing eventId"
 *       500:
 *         description: Lỗi khi lấy dữ liệu từ Zoho
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch event data"
 *                 details:
 *                   type: string
 *                   description: Chi tiết lỗi
 * 
 * components:
 *   schemas:
 *     SingleEventResponse:
 *       type: object
 *       properties:
 *         event:
 *           $ref: '#/components/schemas/EventDetail'
 *         gallery:
 *           type: array
 *           description: Danh sách URL hình ảnh gallery
 *           items:
 *             type: string
 *         mode:
 *           type: string
 *           enum: [single]
 *           example: "single"
 *     
 *     EventListResponse:
 *       type: object
 *       properties:
 *         events:
 *           type: array
 *           description: Danh sách tất cả events
 *           items:
 *             $ref: '#/components/schemas/EventSummary'
 *         total:
 *           type: integer
 *           description: Tổng số events
 *           example: 7
 *         mode:
 *           type: string
 *           enum: [list]
 *           example: "list"
 *     
 *     EventSummary:
 *       type: object
 *       description: Thông tin tóm tắt của event (dùng cho list mode)
 *       properties:
 *         id:
 *           type: string
 *           description: ID của event
 *           example: "4433256000012332047"
 *         name:
 *           type: string
 *           description: Tên event
 *           example: "Automation World VietNam"
 *         description:
 *           type: string
 *           description: Mô tả event (có thể chứa HTML)
 *         start_date:
 *           type: string
 *           description: Ngày bắt đầu
 *           example: "2025-08-27 08:00:00.0"
 *         end_date:
 *           type: string
 *           description: Ngày kết thúc
 *           example: "2025-08-29 17:00:00.0"
 *         logo:
 *           type: string
 *           description: URL logo event
 *         banner:
 *           type: string
 *           description: URL banner event
 *         email:
 *           type: string
 *           description: Email liên hệ
 *         location:
 *           type: string
 *           description: Địa điểm
 *         badge_size:
 *           type: string
 *           description: Kích thước badge
 *         badge_printing:
 *           type: boolean
 *           description: Có in badge không
 *         ticket_mode:
 *           type: boolean
 *           description: Chế độ ticket
 *         one_time_check_in:
 *           type: boolean
 *           description: Chế độ check-in một lần
 *     
 *     EventDetail:
 *       type: object
 *       description: Thông tin chi tiết đầy đủ của event (dùng cho single mode)
 *       properties:
 *         id:
 *           type: string
 *           description: ID của sự kiện
 *           example: "4433256000012332047"
 *         name:
 *           type: string
 *           description: Tên sự kiện
 *           example: "VIET NAM INTERNATIONAL LOGISTICS EXHIBITION 2025"
 *         description:
 *           type: string
 *           description: Mô tả sự kiện (có thể chứa HTML)
 *         email:
 *           type: string
 *           description: Email liên hệ của sự kiện
 *         location:
 *           type: string
 *           description: Địa điểm tổ chức sự kiện
 *         start_date:
 *           type: string
 *           description: Ngày bắt đầu sự kiện
 *           example: "2025-07-31 09:00:00.0"
 *         end_date:
 *           type: string
 *           description: Ngày kết thúc sự kiện
 *           example: "2025-08-02 17:00:00.0"
 *         badge_size:
 *           type: string
 *           description: Kích thước thẻ đeo (format "W123 x H123 mm")
 *           example: "W85 x H54 mm"
 *         badge_custom_content:
 *           type: object
 *           description: Cấu hình nội dung hiển thị trên thẻ đeo
 *           properties:
 *             name:
 *               type: boolean
 *               description: Hiển thị tên hay không
 *               example: true
 *             company:
 *               type: boolean
 *               description: Hiển thị tên công ty hay không
 *               example: true
 *             job_title:
 *               type: boolean
 *               description: Hiển thị chức vụ hay không
 *               example: false
 *         badge_printing:
 *           type: boolean
 *           description: Xác định xem event có in badge hay không
 *           example: true
 *         ticket_mode:
 *           type: boolean
 *           description: Chế độ ticket của event
 *           example: false
 *         one_time_check_in:
 *           type: boolean
 *           description: Chế độ check-in một lần của event
 *           example: false
 *         logo:
 *           type: string
 *           description: URL logo của sự kiện
 *         header:
 *           type: string
 *           description: URL header image
 *         banner:
 *           type: string
 *           description: URL banner image
 *         footer:
 *           type: string
 *           description: URL footer image
 *         favicon:
 *           type: string
 *           description: URL favicon của sự kiện
 *         floor_plan_pdf:
 *           type: string
 *           description: URL file PDF bản đồ mặt bằng sự kiện (URL trực tiếp từ Zoho Creator)
 *           example: "https://creator.zoho.com/file/download/ABC123/floorplan.pdf"
 *         formFields:
 *           type: array
 *           description: Danh sách các field trong form đăng ký
 *           items:
 *             type: object
 *             properties:
 *               field_id:
 *                 type: string
 *                 description: ID duy nhất của field trong Zoho
 *               sort:
 *                 type: integer
 *                 description: Thứ tự hiển thị field
 *               label:
 *                 type: string
 *                 description: Nhãn hiển thị của field
 *               type:
 *                 type: string
 *                 description: Loại field
 *                 enum: [Text, Select, Multi Select, Agreement, Number, Email, Phone]
 *               placeholder:
 *                 type: string
 *                 description: Placeholder text
 *               values:
 *                 type: array
 *                 description: Danh sách options cho Select/Multi Select
 *                 items:
 *                   type: string
 *               required:
 *                 type: boolean
 *                 description: Field có bắt buộc không
 *               helptext:
 *                 type: string
 *                 description: Text hướng dẫn
 *               field_condition:
 *                 type: string
 *                 description: Điều kiện hiển thị field
 *               section_id:
 *                 type: string
 *                 description: ID của section chứa field
 *               section_name:
 *                 type: string
 *                 description: Tên section chứa field
 *               section_sort:
 *                 type: integer
 *                 description: Thứ tự section
 *               section_condition:
 *                 type: string
 *                 description: Điều kiện hiển thị section
 *               title:
 *                 type: string
 *                 description: Tiêu đề cho Agreement field
 *               content:
 *                 type: string
 *                 description: Nội dung HTML cho Agreement field
 *               checkbox_label:
 *                 type: string
 *                 description: Label cho checkbox Agreement
 *               link_text:
 *                 type: string
 *                 description: Text của link
 *               link_url:
 *                 type: string
 *                 description: URL của link
 *               groupmember:
 *                 type: boolean
 *                 description: Field có áp dụng cho group member không
 *               matching_field:
 *                 type: boolean
 *                 description: Field có dùng để matching không
 *               translation:
 *                 type: object
 *                 description: Thông tin dịch thuật cho field
 *                 properties:
 *                   en_sectionname:
 *                     type: string
 *                     description: Tên section tiếng Anh
 *                   en_label:
 *                     type: string
 *                     description: Label tiếng Anh
 *                   en_value:
 *                     type: string
 *                     description: Giá trị tiếng Anh (cho Select/Multi Select)
 *                   en_placeholder:
 *                     type: string
 *                     description: Placeholder tiếng Anh
 *                   en_helptext:
 *                     type: string
 *                     description: Help text tiếng Anh
 *                   en_agreementcontent:
 *                     type: string
 *                     description: Nội dung agreement tiếng Anh
 *                   en_agreementtitle:
 *                     type: string
 *                     description: Tiêu đề agreement tiếng Anh
 *                   en_checkboxlabel:
 *                     type: string
 *                     description: Label checkbox tiếng Anh
 *                   en_linktext:
 *                     type: string
 *                     description: Link text tiếng Anh
 *         sessions:
 *           type: array
 *           description: Danh sách các session/hội thảo trong sự kiện
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID duy nhất của session trong Zoho
 *                 example: "4433256000012707023"
 *               title:
 *                 type: string
 *                 description: Tiêu đề của session/hội thảo
 *                 example: "Hội thảo về Chương trình Đại lý Hàng hóa Hàng không IATA"
 *               date:
 *                 type: string
 *                 description: Ngày diễn ra session
 *                 example: "2025-07-31"
 *               start_time:
 *                 type: string
 *                 description: Thời gian bắt đầu (HH:MM:SS)
 *                 example: "13:30:00"
 *               end_time:
 *                 type: string
 *                 description: Thời gian kết thúc (HH:MM:SS)
 *                 example: "15:00:00"
 *               description:
 *                 type: string
 *                 description: Mô tả chi tiết session (có thể chứa HTML)
 *                 example: "<div>Hiệp hội Vận tải Hàng không Quốc tế (IATA), VINEXAD<br /></div>"
 *               speaker_name:
 *                 type: string
 *                 description: Tên diễn giả/tổ chức
 *                 example: "Hiệp hội Vận tải Hàng không Quốc tế (IATA), VINEXAD"
 *               speaker_id:
 *                 type: string
 *                 description: ID của diễn giả trong Zoho
 *                 example: "4433256000013270007"
 *               area_name:
 *                 type: string
 *                 description: Tên khu vực/phòng diễn ra session
 *                 example: "Khu VILOG TALK Nhà B1, SECC"
 *               area_id:
 *                 type: string
 *                 description: ID của khu vực trong Zoho
 *                 example: "4433256000013270011"
 *               session_accessibility:
 *                 type: string
 *                 description: Phạm vi truy cập session
 *                 example: "All ticket classes"
 *               session_banner:
 *                 type: string
 *                 description: URL banner image của session (đã process thành public URL)
 *                 example: "https://creatorexport.zoho.com/file/tsxcorp/nexpo/All_Sessions/4433256000012707031/Banner/image-download/wwa8TKgnHpS4v9dESgnUFSQFKBrRuS7Ox9ntWPnuSUrmfw2OxkVwVJTG0T4ugCbtRmW6Ytg31MydA0WXggAF68jNzsRtO1f6ERjD?filepath=/1753675822307324_523908681_10161364504588038_9121145198446849570_n.jpg"
 *         sessions_by_date:
 *           type: array
 *           description: Sessions được group theo ngày cho timeline minimalist
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 description: Ngày gốc (YYYY-MM-DD)
 *                 example: "2025-07-31"
 *               display_date:
 *                 type: string
 *                 description: Ngày hiển thị gọn (DD-MM)
 *                 example: "31-07"
 *               day_name:
 *                 type: string
 *                 description: Tên thứ trong tuần
 *                 example: "Thứ Năm"
 *               session_count:
 *                 type: integer
 *                 description: Số lượng session trong ngày
 *                 example: 3
 *               sessions:
 *                 type: array
 *                 description: Danh sách sessions trong ngày này
 *                 items:
 *                   $ref: '#/components/schemas/Session'
 *         exhibitors:
 *           type: array
 *           description: Danh sách các exhibitor tham gia sự kiện
 *           items:
 *             type: object
 *             properties:
 *               exhibitor_profile_id:
 *                 type: string
 *                 description: ID duy nhất của exhibitor profile trong Zoho
 *               display_name:
 *                 type: string
 *                 description: Tên hiển thị của exhibitor
 *               en_company_name:
 *                 type: string
 *                 description: Tên công ty (tiếng Anh)
 *                 example: "ABC Corporation Ltd."
 *               vi_company_name:
 *                 type: string
 *                 description: Tên công ty (tiếng Việt)
 *                 example: "Công ty TNHH ABC"
 *               booth_no:
 *                 type: string
 *                 description: Số gian hàng của exhibitor
 *               category:
 *                 type: string
 *                 description: Danh mục/ngành nghề của exhibitor
 *               country:
 *                 type: string
 *                 description: Quốc gia của exhibitor
 *               email:
 *                 type: string
 *                 description: Email liên hệ
 *               tel:
 *                 type: string
 *                 description: Số điện thoại cố định
 *               mobile:
 *                 type: string
 *                 description: Số điện thoại di động
 *               fax:
 *                 type: string
 *                 description: Số fax
 *               website:
 *                 type: string
 *                 description: Website (có thể chứa HTML link)
 *               zip_code:
 *                 type: string
 *                 description: Mã bưu chính
 *               vie_address:
 *                 type: string
 *                 description: Địa chỉ tiếng Việt
 *               eng_address:
 *                 type: string
 *                 description: Địa chỉ tiếng Anh
 *               vie_company_description:
 *                 type: string
 *                 description: Mô tả công ty tiếng Việt (có thể chứa HTML)
 *               eng_company_description:
 *                 type: string
 *                 description: Mô tả công ty tiếng Anh (có thể chứa HTML)
 *               vie_display_products:
 *                 type: string
 *                 description: Sản phẩm hiển thị tiếng Việt
 *               eng_display_products:
 *                 type: string
 *                 description: Sản phẩm hiển thị tiếng Anh
 *               introduction_video:
 *                 type: string
 *                 description: Video giới thiệu (có thể chứa HTML link)
 *               company_logo:
 *                 type: string
 *                 description: URL logo công ty (đã process thành public URL)
 *               cover_image:
 *                 type: string
 *                 description: URL ảnh cover (đã process thành public URL)
 */

router.get('/', async (req, res) => {
  const eventId = req.query.eventId;
  const detailed = req.query.detailed === 'true';
  
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

  try {
    // If detailed=true and eventId=NEXPO, fetch detailed info for each event
    if (detailed && eventId === 'NEXPO') {
      logger.info("Fetching detailed events list...");
      
      // First get the basic list
      const basicResult = await fetchEventDetails(eventId);
      
      if (basicResult.mode === 'list' && basicResult.events) {
        // Fetch detailed info for each event
        const detailedEvents = [];
        
        for (const event of basicResult.events) {
          try {
            logger.info(`📋 Fetching detailed info for event: ${event.id}`);
            let detailedEvent;
            
            // Try Custom API first, fallback to REST API only if token is available
            try {
              detailedEvent = await fetchEventDetails(event.id);
            } catch (customError) {
              logger.warn(`Custom API failed for event ${event.id}, trying REST API:`, customError.message);
              
              // Only try REST API if we have a token
              if (process.env.ZOHO_ACCESS_TOKEN) {
                try {
                  detailedEvent = await fetchEventDetailsREST(event.id);
                } catch (restError) {
                  logger.warn(`Both Custom API and REST API failed for event ${event.id}:`, restError.message);
                  throw customError; // Throw original Custom API error
                }
              } else {
                logger.warn(`No ZOHO_ACCESS_TOKEN available for event ${event.id}, cannot use REST API fallback`);
                throw customError; // Throw original Custom API error
              }
            }
            
            if (detailedEvent.mode === 'single' && detailedEvent.event) {
              detailedEvents.push({
                id: event.id,
                name: event.name,
                description: event.description,
                start_date: event.start_date,
                end_date: event.end_date,
                logo: event.logo,
                banner: event.banner,
                email: event.email,
                location: event.location,
                badge_size: detailedEvent.event.badge_size,
                badge_printing: detailedEvent.event.badge_printing, // Accurate value
                ticket_mode: detailedEvent.event.ticket_mode,
                one_time_check_in: detailedEvent.event.one_time_check_in,
                badge_custom_content: detailedEvent.event.badge_custom_content
              });
            } else {
              // Fallback to basic info if detailed fetch fails
              detailedEvents.push(event);
            }
          } catch (error) {
            logger.warn(`Failed to fetch detailed info for event ${event.id}:`, error.message);
            // Fallback to basic info
            detailedEvents.push(event);
          }
        }
        
        return res.status(200).json({
          events: detailedEvents,
          total: detailedEvents.length,
          mode: "detailed_list"
        });
      }
    }
    
    // Default behavior - try Custom API first, fallback to REST API only if token is available
    let result;
    try {
      result = await fetchEventDetails(eventId);
      logger.info("Event data fetched successfully via Custom API for ID:", eventId);
    } catch (customError) {
      logger.warn(`Custom API failed for event ${eventId}, trying REST API:`, customError.message);
      
      // Only try REST API if we have a token
      if (process.env.ZOHO_ACCESS_TOKEN) {
        try {
          result = await fetchEventDetailsREST(eventId);
          logger.info("Event data fetched successfully via REST API for ID:", eventId);
        } catch (restError) {
          logger.error(`Both Custom API and REST API failed for event ${eventId}:`, restError.message);
          throw customError; // Throw original Custom API error
        }
      } else {
        logger.warn("No ZOHO_ACCESS_TOKEN available, cannot use REST API fallback");
        throw customError; // Throw original Custom API error
      }
    }
    
    res.status(200).json(result);
  } catch (err) {
    logger.error("Error fetching event data:", err.message);
    res.status(500).json({ error: 'Failed to fetch event data', details: err.message });
  }
});

module.exports = router;
