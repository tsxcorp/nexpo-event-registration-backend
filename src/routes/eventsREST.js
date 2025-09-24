const express = require('express');
// Temporarily use console.log instead of logger to avoid production crash
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};
const router = express.Router();
const { fetchEventDetailsREST } = require('../utils/zohoEventUtilsREST');

/**
 * @swagger
 * /api/events-rest:
 *   get:
 *     summary: Lấy thông tin chi tiết sự kiện từ Zoho Creator REST API v2.1
 *     description: |
 *       API trả về thông tin đầy đủ của sự kiện sử dụng REST API v2.1 thay vì Custom API.
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
 *       400:
 *         description: Thiếu eventId parameter
 *       500:
 *         description: Lỗi khi lấy dữ liệu từ Zoho
 */

router.get('/', async (req, res) => {
  const eventId = req.query.eventId;
  const detailed = req.query.detailed === 'true';
  
  if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

  try {
    logger.info(`🔍 Fetching event data via REST API for ID: ${eventId}`);
    
    // If detailed=true and eventId=NEXPO, fetch detailed info for each event
    if (detailed && eventId === 'NEXPO') {
      logger.info("Fetching detailed events list via REST API...");
      
      // First get the basic list
      const basicResult = await fetchEventDetailsREST(eventId);
      
      if (basicResult.mode === 'list' && basicResult.events) {
        // Fetch detailed info for each event
        const detailedEvents = [];
        
        for (const event of basicResult.events) {
          try {
            logger.info(`📋 Fetching detailed info for event: ${event.id}`);
            const detailedEvent = await fetchEventDetailsREST(event.id);
            
            if (detailedEvent.mode === 'single' && detailedEvent.event) {
              detailedEvents.push({
                id: event.id,
                name: event.name,
                description: event.description,
                start_date: event.start_date,
                end_date: event.end_date,
                logo: event.logo,
                banner: event.banner,
                email: event.email,
                location: event.location,
                badge_size: detailedEvent.event.badge_size,
                badge_printing: detailedEvent.event.badge_printing,
                ticket_mode: detailedEvent.event.ticket_mode,
                badge_custom_content: detailedEvent.event.badge_custom_content
              });
            } else {
              // Fallback to basic info if detailed fetch fails
              detailedEvents.push(event);
            }
          } catch (error) {
            logger.warn(`Failed to fetch detailed info for event ${event.id}:`, error.message);
            // Fallback to basic info
            detailedEvents.push(event);
          }
        }
        
        return res.status(200).json({
          events: detailedEvents,
          total: detailedEvents.length,
          mode: "detailed_list",
          source: "rest_api"
        });
      }
    }
    
    // Default behavior
    const result = await fetchEventDetailsREST(eventId);
    logger.info(`Event data fetched successfully via REST API for ID: ${eventId}`);
    
    res.status(200).json(result);
  } catch (err) {
    logger.error("Error fetching event data via REST API:", err.message);
    res.status(500).json({ error: 'Failed to fetch event data via REST API', details: err.message });
  }
});

module.exports = router;
