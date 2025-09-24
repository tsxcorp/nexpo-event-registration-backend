const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const socketService = require('../services/socketService');
const redisService = require('../services/redisService');
const zohoCreatorAPI = require('../utils/zohoCreatorAPI');

/**
 * @swagger
 * /api/realtime/push/test:
 *   post:
 *     summary: Test real-time push notification
 *     tags: [Real-time]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               room:
 *                 type: string
 *                 description: Room to broadcast to
 *               event:
 *                 type: string
 *                 description: Event name
 *               data:
 *                 type: object
 *                 description: Data to send
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
router.post('/push/test', (req, res) => {
  try {
    const { room, event = 'test_message', data } = req.body;
    
    if (!room) {
      return res.status(400).json({
        success: false,
        error: 'Room is required'
      });
    }

    const result = socketService.broadcastToRoom(room, event, {
      message: 'Test message from API',
      ...data
    });

    res.json({
      success: true,
      message: `Broadcast sent to room: ${room}`,
      event,
      delivered: result
    });
  } catch (error) {
    logger.error("Test push error:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test message',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/realtime/registrations/refresh:
 *   post:
 *     summary: Force refresh registration data và push to clients
 *     tags: [Real-time]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_id:
 *                 type: string
 *                 description: Event ID to filter
 *               clear_cache:
 *                 type: boolean
 *                 description: Clear cache before refresh
 *     responses:
 *       200:
 *         description: Data refreshed and pushed
 */
router.post('/registrations/refresh', async (req, res) => {
  try {
    const { event_id, clear_cache = true } = req.body;
    
    let criteria = null;
    if (event_id) {
      criteria = `Event_Info.ID = "${event_id}"`;
    }

    // Clear cache if requested
    if (clear_cache) {
      await zohoCreatorAPI.clearCache('Registrations', { criteria });
    }

    // Get fresh data
    const result = await zohoCreatorAPI.forceRefresh('Registrations', {
      criteria,
      limit: 200,
      from: 1
    });

    // Push to real-time clients
    await socketService.pushRegistrationData(event_id, result.data, 'manual_refresh');

    res.json({
      success: true,
      message: 'Registration data refreshed and pushed',
      event_id,
      count: result.count,
      cached: result.metadata.cached,
      pushed_to_sockets: true
    });
  } catch (error) {
    logger.error("Registration refresh error:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh registration data',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/realtime/checkin/simulate:
 *   post:
 *     summary: Simulate check-in event (for testing)
 *     tags: [Real-time]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registration_id:
 *                 type: string
 *                 description: Registration ID
 *               event_id:
 *                 type: string
 *                 description: Event ID
 *               full_name:
 *                 type: string
 *                 description: Attendee name
 *               status:
 *                 type: string
 *                 enum: [true, false]
 *                 description: Check-in status
 *     responses:
 *       200:
 *         description: Check-in event simulated
 */
router.post('/checkin/simulate', async (req, res) => {
  try {
    const { registration_id, event_id, full_name, status = true } = req.body;
    
    if (!registration_id || !full_name) {
      return res.status(400).json({
        success: false,
        error: 'registration_id and full_name are required'
      });
    }

    const mockRegistration = {
      ID: registration_id,
      Full_Name: full_name,
      Event_Info: event_id ? { ID: event_id } : '',
      Check_In_Status: status ? 'Checked In' : 'Not Yet',
      Updated_Time: new Date().toISOString()
    };

    // Push check-in update
    await socketService.pushCheckInUpdate(event_id, registration_id, status, mockRegistration);

    res.json({
      success: true,
      message: 'Check-in event simulated and pushed',
      data: mockRegistration,
      pushed_to_sockets: true
    });
  } catch (error) {
    logger.error("Check-in simulation error:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate check-in',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/realtime/status:
 *   get:
 *     summary: Get real-time service status
 *     tags: [Real-time]
 *     responses:
 *       200:
 *         description: Service status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: socketService.getStatus(),
    clients: socketService.getClientsInfo(),
    redis: {
      connected: redisService.isReady(),
      config: redisService.isReady() ? 'connected' : 'not_connected'
    }
  });
});

/**
 * @swagger
 * /api/realtime/cache/clear:
 *   post:
 *     summary: Clear specific cache entries
 *     tags: [Real-time]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report:
 *                 type: string
 *                 description: Report name to clear
 *               filters:
 *                 type: object
 *                 description: Specific filters to clear
 *     responses:
 *       200:
 *         description: Cache cleared
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const { report, filters = {} } = req.body;
    
    if (!report) {
      return res.status(400).json({
        success: false,
        error: 'Report name is required'
      });
    }

    const cleared = await zohoCreatorAPI.clearCache(report, filters);
    
    res.json({
      success: true,
      message: `Cache cleared for report: ${report}`,
      cleared,
      redis_connected: redisService.isReady()
    });
  } catch (error) {
    logger.error("Cache clear error:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

module.exports = router;
