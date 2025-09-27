const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { fetchEventDetailsREST } = require('../utils/zohoEventUtilsREST');

/**
 * @swagger
 * /api/events-proxy:
 *   get:
 *     summary: Lấy thông tin sự kiện với proxy images (REST API)
 *     description: |
 *       API sử dụng REST API để lấy thông tin sự kiện với proxy image URLs.
 *       Tất cả images sẽ được proxy qua backend để tránh Mixed Content issues.
 *       
 *       **Ưu điểm:**
 *       - Không có Mixed Content warnings
 *       - Images được cache qua backend
 *       - Hoạt động ổn định với HTTPS
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
 *         description: Dữ liệu sự kiện thành công với proxy image URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   type: object
 *                   description: Thông tin chi tiết sự kiện
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID của sự kiện
 *                     name:
 *                       type: string
 *                       description: Tên sự kiện
 *                     logo:
 *                       type: string
 *                       description: URL logo sự kiện (proxy)
 *                       example: "https://nexpo-event-registration-backend-production.up.railway.app/api/proxy-image?recordId=123&fieldName=Logo&filename=logo.png"
 *                     banner:
 *                       type: string
 *                       description: URL banner sự kiện (proxy)
 *                 source:
 *                   type: string
 *                   description: Nguồn dữ liệu
 *                   example: "rest_api"
 *       400:
 *         description: Thiếu eventId parameter
 *       500:
 *         description: Lỗi khi lấy dữ liệu từ Zoho
 */

router.get('/', async (req, res) => {
  const eventId = req.query.eventId;
  
  if (!eventId) {
    return res.status(400).json({
      success: false,
      error: 'Missing eventId parameter',
      message: 'eventId is required (use "NEXPO" for all events)'
    });
  }

  try {
    logger.info(`🔍 Fetching event data via REST API (Proxy) for: ${eventId}`);
    
    // Use REST API which returns proxy URLs
    const result = await fetchEventDetailsREST(eventId);
    
    logger.info(`✅ Event data fetched successfully via REST API (Proxy) for: ${eventId}`);
    
    // Add source identifier
    if (result && typeof result === 'object') {
      result.source = 'rest_api_proxy';
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error(`❌ Error fetching event data via REST API (Proxy) for ${eventId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event data',
      message: error.message,
      source: 'rest_api_proxy'
    });
  }
});

module.exports = router;
