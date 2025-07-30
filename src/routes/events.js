const express = require('express');
const router = express.Router();
const { fetchEventDetails } = require('../utils/zohoEventUtils');

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
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

  try {
    const result = await fetchEventDetails(eventId);
    console.log("✅ Event data fetched successfully for ID:", eventId);
    
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error fetching event data:", err.message);
    res.status(500).json({ error: 'Failed to fetch event data', details: err.message });
  }
});

module.exports = router;
