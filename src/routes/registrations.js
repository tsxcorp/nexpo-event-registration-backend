const express = require('express');
const router = express.Router();
const { submitRegistration } = require('../utils/zohoSubmit');

/**
 * @swagger
 * /api/registrations:
 *   post:
 *     summary: Đăng ký tham gia sự kiện
 *     parameters:
 *       - in: query
 *         name: Event_Info
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sự kiện trong Zoho
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Full_Name:
 *                 type: string
 *               Email:
 *                 type: string
 *               Mobile_Number:
 *                 type: string
 *               Custom_Fields_Value:
 *                 type: object
 *             required:
 *               - Full_Name
 *               - Email
 *               - Mobile_Number
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 *       500:
 *         description: Gửi đăng ký thất bại
 */
router.post('/', async (req, res) => {
  try {
    const result = await submitRegistration(req.body);
    if (!result?.zoho_record_id) {
  return res.status(500).json({
    success: false,
    error: 'Missing Zoho record ID',
    zohoResponse: result
  });
}

res.status(200).json(result); // ✅ Trả toàn bộ object gốc luôn

  } catch (err) {
    console.error("❌ Zoho submission error:", err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form',
      details: err.message,
    });
  }
});

module.exports = router;
