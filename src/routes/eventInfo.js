const express = require('express');
const router = express.Router();
const { fetchEventDetails } = require('../utils/zohoEventUtils');

router.get('/event-info', async (req, res) => {
  const eventId = req.query.eventId;
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

  try {
    const data = await fetchEventDetails(eventId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event data', details: err.message });
  }
});

module.exports = router;
