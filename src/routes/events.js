const express = require('express');
const router = express.Router();
const { fetchEventDetails } = require('../utils/zohoEventUtils');

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lấy thông tin chi tiết sự kiện từ Zoho Creator
 *     description: API trả về thông tin đầy đủ của sự kiện bao gồm form fields, sections, và media
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sự kiện trong Zoho Creator
 *         example: "4433256000012332047"
 *     responses:
 *       200:
 *         description: Dữ liệu sự kiện thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID của sự kiện
 *                       example: "4433256000012332047"
 *                     name:
 *                       type: string
 *                       description: Tên sự kiện
 *                       example: "Automation World VietNam"
 *                     description:
 *                       type: string
 *                       description: Mô tả sự kiện (có thể chứa HTML)
 *                     email:
 *                       type: string
 *                       description: Email liên hệ của sự kiện
 *                     location:
 *                       type: string
 *                       description: Địa điểm tổ chức sự kiện
 *                     start_date:
 *                       type: string
 *                       description: Ngày bắt đầu sự kiện
 *                       example: "2025-08-24 08:00:00.0"
 *                     end_date:
 *                       type: string
 *                       description: Ngày kết thúc sự kiện
 *                       example: "2025-08-29 17:00:00.0"
 *                     logo:
 *                       type: string
 *                       description: URL logo của sự kiện
 *                     header:
 *                       type: string
 *                       description: URL header image
 *                     banner:
 *                       type: string
 *                       description: URL banner image
 *                     footer:
 *                       type: string
 *                       description: URL footer image
 *                     favicon:
 *                       type: string
 *                       description: URL favicon của sự kiện
 *                     formFields:
 *                       type: array
 *                       description: Danh sách các field trong form đăng ký
 *                       items:
 *                         type: object
 *                         properties:
 *                           field_id:
 *                             type: string
 *                             description: ID duy nhất của field trong Zoho
 *                           sort:
 *                             type: integer
 *                             description: Thứ tự hiển thị field
 *                           label:
 *                             type: string
 *                             description: Nhãn hiển thị của field
 *                           type:
 *                             type: string
 *                             description: Loại field
 *                             enum: [Text, Select, Multi Select, Agreement, Number, Email, Phone]
 *                           placeholder:
 *                             type: string
 *                             description: Placeholder text
 *                           values:
 *                             type: array
 *                             description: Danh sách options cho Select/Multi Select
 *                             items:
 *                               type: string
 *                           required:
 *                             type: boolean
 *                             description: Field có bắt buộc không
 *                           helptext:
 *                             type: string
 *                             description: Text hướng dẫn
 *                           field_condition:
 *                             type: string
 *                             description: Điều kiện hiển thị field
 *                           section_id:
 *                             type: string
 *                             description: ID của section chứa field
 *                           section_name:
 *                             type: string
 *                             description: Tên section chứa field
 *                           section_sort:
 *                             type: integer
 *                             description: Thứ tự section
 *                           section_condition:
 *                             type: string
 *                             description: Điều kiện hiển thị section
 *                           title:
 *                             type: string
 *                             description: Tiêu đề cho Agreement field
 *                           content:
 *                             type: string
 *                             description: Nội dung HTML cho Agreement field
 *                           checkbox_label:
 *                             type: string
 *                             description: Label cho checkbox Agreement
 *                           link_text:
 *                             type: string
 *                             description: Text của link
 *                           link_url:
 *                             type: string
 *                             description: URL của link
 *                           groupmember:
 *                             type: boolean
 *                             description: Field có áp dụng cho group member không
 *                           matching_field:
 *                             type: boolean
 *                             description: Field có dùng để matching không
 *                 gallery:
 *                   type: array
 *                   description: Danh sách URL hình ảnh gallery
 *                   items:
 *                     type: string
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
