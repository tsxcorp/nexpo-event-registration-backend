
const express = require('express');
const router = express.Router();
const { submitRegistration } = require('../utils/zohoSubmit');

// Route: POST /api/register
router.post('/', async (req, res) => {
  try {
    const result = await submitRegistration(req.body);

    const zohoRecordId = result?.data?.ID;

    if (!zohoRecordId) {
      return res.status(500).json({
        success: false,
        error: 'Missing Zoho record ID',
        zohoResponse: result
      });
    }

    res.status(200).json({
      success: true,
      zoho_record_id: zohoRecordId
    });
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