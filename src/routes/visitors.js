const express = require('express');
const router = express.Router();
const { fetchVisitorDetails, submitCheckin } = require('../utils/zohoVisitorUtils');

/**
 * @swagger
 * /api/visitors:
 *   get:
 *     summary: Lấy thông tin chi tiết visitor từ Zoho Creator
 *     description: API trả về thông tin đầy đủ của visitor đã đăng ký sự kiện
 *     parameters:
 *       - in: query
 *         name: visid
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của visitor trong Zoho Creator
 *         example: "4433256000012345678"
 *     responses:
 *       200:
 *         description: Dữ liệu visitor thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 visitor:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID của visitor
 *                       example: "4433256000012345678"
 *                     salutation:
 *                       type: string
 *                       description: Danh xưng (Mr., Ms., Dr., etc.)
 *                       example: "Mr."
 *                     name:
 *                       type: string
 *                       description: Tên đầy đủ của visitor
 *                       example: "Nguyen Van A"
 *                     email:
 *                       type: string
 *                       description: Email của visitor
 *                       example: "nguyenvana@example.com"
 *                     phone:
 *                       type: string
 *                       description: Số điện thoại
 *                       example: "0901234567"
 *                     company:
 *                       type: string
 *                       description: Tên công ty
 *                       example: "ABC Corporation"
 *                     job_title:
 *                       type: string
 *                       description: Chức vụ
 *                       example: "Manager"
 *                     registration_date:
 *                       type: string
 *                       description: Ngày đăng ký
 *                       example: "2025-01-15 10:30:00.0"
 *                     status:
 *                       type: string
 *                       description: Trạng thái đăng ký
 *                       example: "confirmed"
 *                     event_id:
 *                       type: string
 *                       description: ID sự kiện đã đăng ký
 *                       example: "4433256000012332047"
 *                     event_name:
 *                       type: string
 *                       description: Tên sự kiện
 *                       example: "Automation World VietNam"
 *                     group_id:
 *                       type: string
 *                       description: ID nhóm đăng ký (nếu có)
 *                       example: "GRP-1750414070451"
 *                     group_redeem_id:
 *                       type: string
 *                       description: ID redeem của nhóm
 *                     badge_qr:
 *                       type: string
 *                       description: QR code của badge
 *                     redeem_qr:
 *                       type: string
 *                       description: QR code để redeem
 *                     redeem_id:
 *                       type: string
 *                       description: ID redeem
 *                     encrypt_key:
 *                       type: string
 *                       description: Key mã hóa
 *                     head_mark:
 *                       type: boolean
 *                       description: Đánh dấu head
 *                     check_in_history:
 *                       type: array
 *                       description: Lịch sử check-in
 *                       items:
 *                         type: object
 *                         properties:
 *                           event_name:
 *                             type: string
 *                             description: Tên sự kiện đã check-in
 *                             example: "VIET NAM INTERNATIONAL LOGISTICS EXHIBITION 2025"
 *                           qr_scan:
 *                             type: string
 *                             description: QR code đã scan
 *                             example: "VILOG2510000930"
 *                           valid_check:
 *                             type: boolean
 *                             description: Check-in có hợp lệ không
 *                             example: true
 *                           event_id:
 *                             type: string
 *                             description: ID sự kiện đã check-in
 *                             example: "4433256000012557772"
 *                           group_registration_id:
 *                             type: string
 *                             description: ID đăng ký nhóm (nếu có)
 *                             example: ""
 *                           checkintime:
 *                             type: string
 *                             description: Thời gian check-in
 *                             example: "2025-07-22 20:28:36.0"
 *                     matching_list:
 *                       type: array
 *                       description: Danh sách business matching
 *                       items:
 *                         type: object
 *                         properties:
 *                           exhibitor_profile_id:
 *                             type: integer
 *                             description: ID của exhibitor
 *                             example: 4433256000012938592
 *                           time:
 *                             type: string
 *                             description: Thời gian hẹn
 *                             example: "10:00:00"
 *                           confirmed:
 *                             type: boolean
 *                             description: Trạng thái xác nhận
 *                             example: false
 *                           date:
 *                             type: string
 *                             description: Ngày hẹn
 *                             example: "2025-08-01"
 *                           message:
 *                             type: string
 *                             description: Ghi chú
 *                             example: "test"
 *                     custom_fields:
 *                       type: object
 *                       description: Các trường custom đã điền (parsed object)
 *                       example: {"vilog2025_confdatetime": "Thứ Bảy ngày 02/08", "vilog2025_jobtitle": "Chuyển phát nhanh", "Introduce Expo": "true"}
 *                     formFields:
 *                       type: array
 *                       description: Danh sách các field trong form (nếu có)
 *                       items:
 *                         type: object
 *                         properties:
 *                           field_id:
 *                             type: string
 *                             description: ID duy nhất của field
 *                           sort:
 *                             type: integer
 *                             description: Thứ tự hiển thị field
 *                           label:
 *                             type: string
 *                             description: Nhãn hiển thị của field
 *                           type:
 *                             type: string
 *                             description: Loại field
 *                           required:
 *                             type: boolean
 *                             description: Field có bắt buộc không
 *                           values:
 *                             type: array
 *                             description: Danh sách options (nếu có)
 *                             items:
 *                               type: string
 *       400:
 *         description: Thiếu visid parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing visid"
 *       500:
 *         description: Lỗi khi lấy dữ liệu từ Zoho
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch visitor data"
 *                 details:
 *                   type: string
 *                   description: Chi tiết lỗi
 */

router.get('/', async (req, res) => {
  const visitorId = req.query.visid;
  if (!visitorId) return res.status(400).json({ error: 'Missing visid' });

  try {
    const result = await fetchVisitorDetails(visitorId);
    console.log("✅ Visitor data fetched successfully for ID:", visitorId);
    
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error fetching visitor data:", err.message);
    res.status(500).json({ error: 'Failed to fetch visitor data', details: err.message });
  }
});

/**
 * @swagger
 * /api/visitors/checkin:
 *   post:
 *     summary: Submit check-in data for a visitor
 *     description: Submit visitor check-in information to Zoho Creator
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               visitor:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: ID của visitor
 *                     example: "4433256000013160039"
 *                   name:
 *                     type: string
 *                     description: Tên đầy đủ của visitor
 *                     example: "NGUYỄN THÁI PHI"
 *                   email:
 *                     type: string
 *                     description: Email của visitor
 *                     example: "ceo@ozcorp.vn"
 *                   phone:
 *                     type: string
 *                     description: Số điện thoại
 *                     example: "+840901234567"
 *                   company:
 *                     type: string
 *                     description: Tên công ty
 *                     example: "ABC Corporation"
 *                   job_title:
 *                     type: string
 *                     description: Chức vụ
 *                     example: "CEO"
 *                   registration_date:
 *                     type: string
 *                     description: Ngày đăng ký
 *                   status:
 *                     type: string
 *                     description: Trạng thái đăng ký
 *                   event_id:
 *                     type: string
 *                     description: ID sự kiện
 *                     example: "4433256000013114003"
 *                   event_name:
 *                     type: string
 *                     description: Tên sự kiện
 *                     example: "CHUỖI SỰ KIỆN THÁNG 07"
 *                   group_id:
 *                     type: string
 *                     description: ID nhóm đăng ký
 *                     example: "GRP-1752671254685"
 *                   group_redeem_id:
 *                     type: string
 *                     description: ID redeem của nhóm
 *                   badge_qr:
 *                     type: string
 *                     description: QR code của badge
 *                     example: "NDQzMzI1NjAwMDAxMzE2MDAzOQ=="
 *                   redeem_qr:
 *                     type: string
 *                     description: QR code để redeem
 *                     example: "CNG10001131"
 *                   redeem_id:
 *                     type: string
 *                     description: ID redeem
 *                     example: "CNG10001131"
 *                   encrypt_key:
 *                     type: string
 *                     description: Key mã hóa
 *                     example: "NDQzMzI1NjAwMDAxMzE2MDAzOQ=="
 *                   head_mark:
 *                     type: boolean
 *                     description: Đánh dấu head
 *                     example: false
 *                   check_in_history:
 *                     type: array
 *                     description: Lịch sử check-in
 *                     items:
 *                       type: object
 *                   custom_fields:
 *                     type: string
 *                     description: Các trường custom (JSON string)
 *                     example: "{\"Bạn sẽ tham dự chương trình\":\"\",\"Tên Công Ty\":\"CÔNG TY XD KIẾN TRÚC ÂN GIA\"}"
 *                   formFields:
 *                     type: array
 *                     description: Danh sách các field trong form
 *                     items:
 *                       type: object
 *     responses:
 *       200:
 *         description: Check-in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Check-in submitted successfully"
 *                 data:
 *                   type: object
 *                   description: Response data từ Zoho
 *       400:
 *         description: Thiếu dữ liệu visitor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing visitor data"
 *       500:
 *         description: Lỗi khi submit check-in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to submit check-in"
 *                 details:
 *                   type: string
 *                   description: Chi tiết lỗi
 */

router.post('/checkin', async (req, res) => {
  const { visitor } = req.body;
  
  if (!visitor) {
    return res.status(400).json({ error: 'Missing visitor data' });
  }

  try {
    const result = await submitCheckin({ visitor });
    console.log("✅ Check-in submitted successfully for visitor:", visitor.id);
    
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error submitting check-in:", err.message);
    res.status(500).json({ error: 'Failed to submit check-in', details: err.message });
  }
});

module.exports = router; 