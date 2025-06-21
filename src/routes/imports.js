const express = require('express');
const multer = require('multer');
const { parseExcel } = require('../utils/parseExcel');
const { submitRegistration } = require('../utils/zohoSubmit');

const router = express.Router();
const upload = multer();

/**
 * @swagger
 * /api/imports:
 *   post:
 *     summary: Import danh sách đăng ký từ Excel
 *     parameters:
 *       - in: formData
 *         name: event_id
 *         required: true
 *         type: string
 *         description: ID của sự kiện
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import thành công
 *       500:
 *         description: Import thất bại
 */

const MAX_REQUESTS_PER_SECOND = 3;
const RETRY_LIMIT = 2;
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const records = parseExcel(req.file.buffer);
    const eventId = req.body.event_id;

    const results = [];

    for (const [i, row] of records.entries()) {
      const payload = {
        Salutation: row.title || row.salutation || row.Title || row.Salutation,
        Full_Name: row.full_name || row.Full_Name || row.name || row.Name,
        Email: row.email || row.Email,
        Phone_Number: row.mobile_number || row.phone_number || row.Mobile_Number || row.Phone_Number,
        Event_Info: eventId,
        Custom_Fields_Value: Object.fromEntries(
          Object.entries(row).filter(([key, value]) => {
            const lowerKey = key.toLowerCase();
            return !['title', 'salutation', 'full_name', 'name', 'email', 'mobile_number', 'phone_number'].includes(lowerKey) && value !== undefined && value !== null;
          })
        )
      };

      let success = false;
      let attempt = 0;
      let lastError = '';

      while (attempt <= RETRY_LIMIT) {
        try {
          await submitRegistration(payload);
          results.push({ row: i + 1, status: '✅ Success', email: payload.Email });
          success = true;
          break;
        } catch (err) {
          lastError = err?.message || 'Unknown error';
          attempt++;
          await sleep(1000 / MAX_REQUESTS_PER_SECOND);
        }
      }

      if (!success) {
        results.push({ row: i + 1, status: '❌ Failed', email: payload.Email, error: lastError });
      }
    }

    res.json({ success: true, total: records.length, report: results });
  } catch (error) {
    console.error("❌ Import error:", error);
    res.status(500).json({ error: "Failed to import file", details: error.message });
  }
});

module.exports = router;
