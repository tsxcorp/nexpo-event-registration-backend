
const express = require('express');
const router = express.Router();
const { fetchEventDetails } = require('../utils/zohoEventUtils');

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lấy thông tin sự kiện từ Zoho
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sự kiện
 *     responses:
 *       200:
 *         description: Dữ liệu sự kiện thành công
 */

router.get('/', async (req, res) => {
  const eventId = req.query.eventId;
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

  try {
    const result = await fetchEventDetails(eventId);

    // // ✨ In ra log để xác định rõ ID dạng gì
    // console.log("👉 Zoho trả về event.id =", result?.event?.id, "typeof =", typeof result?.event?.id);

    res.status(200).json(result); // hoặc .send nếu cần
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event data', details: err.message });
  }
});


module.exports = router;
