const express = require('express');
const multer = require('multer');
const { parseExcel } = require('../utils/parseExcel');
const { submitRegistration } = require('../utils/zohoSubmit');

const router = express.Router();
const upload = multer();

const MAX_REQUESTS_PER_SECOND = 3; // Zoho Creator an toàn ~3req/s
const RETRY_LIMIT = 2;

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const records = parseExcel(req.file.buffer);
    const eventId = req.body.event_id;

    const results = [];

    for (const [i, row] of records.entries()) {
      const { title, full_name, email, mobile_number, ...custom_fields_value } = row;

      const payload = {
        title,
        full_name,
        email,
        mobile_number,
        Event_Info: eventId,
        custom_fields_value,
      };

      let success = false;
      let attempt = 0;
      let lastError = '';

      while (attempt <= RETRY_LIMIT) {
        try {
          await submitRegistration(payload);
          results.push({ row: i + 1, status: '✅ Success', email });
          success = true;
          break;
        } catch (err) {
          lastError = err?.message || 'Unknown error';
          attempt++;
          await sleep(1000 / MAX_REQUESTS_PER_SECOND);
        }
      }

      if (!success) {
        results.push({ row: i + 1, status: '❌ Failed', email, error: lastError });
      }
    }

    res.json({ success: true, total: records.length, report: results });
  } catch (error) {
    console.error("❌ Import error:", error);
    res.status(500).json({ error: "Failed to import file", details: error.message });
  }
});

module.exports = router;
