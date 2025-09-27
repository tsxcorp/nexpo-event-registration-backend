const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const syncWorker = require('../services/syncWorker');
const redisService = require('../services/redisService');

/**
 * Sync Management API
 * Controls real-time synchronization between Zoho and Redis
 */

/**
 * @swagger
 * /api/sync/start:
 *   post:
 *     summary: Start real-time synchronization
 *     tags: [Sync Management]
 *     responses:
 *       200:
 *         description: Sync started successfully
 */
router.post('/start', async (req, res) => {
  try {
    const result = await redisService.startRealTimeSync();
    res.json({
      success: true,
      message: 'Real-time synchronization started',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error starting sync:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to start synchronization',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync/stop:
 *   post:
 *     summary: Stop real-time synchronization
 *     tags: [Sync Management]
 */
router.post('/stop', async (req, res) => {
  try {
    const result = await redisService.stopRealTimeSync();
    res.json({
      success: true,
      message: 'Real-time synchronization stopped',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error stopping sync:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop synchronization',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Get synchronization status
 *     tags: [Sync Management]
 */
router.get('/status', async (req, res) => {
  try {
    const status = await redisService.getSyncStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error getting sync status:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync/trigger-full:
 *   post:
 *     summary: Trigger manual full synchronization
 *     tags: [Sync Management]
 */
router.post('/trigger-full', async (req, res) => {
  try {
    // Get all cached events and sync them
    const eventKeys = await redisService.client.keys('cache:event:*:meta');
    const results = [];
    
    for (const key of eventKeys) {
      const eventId = key.match(/cache:event:([^:]+):meta/)?.[1];
      if (eventId) {
        try {
          const result = await syncWorker.syncEventData(eventId);
          results.push({ eventId, success: true, result });
        } catch (error) {
          results.push({ eventId, success: false, error: error.message });
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Full synchronization completed',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error triggering full sync:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger full synchronization',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync/add-event:
 *   post:
 *     summary: Add event to sync monitoring
 *     tags: [Sync Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_id:
 *                 type: string
 *                 description: Event ID to monitor
 *               priority:
 *                 type: string
 *                 enum: [fast, normal, slow]
 *                 default: normal
 *                 description: Sync priority level
 */
router.post('/add-event', async (req, res) => {
  try {
    const { event_id, priority = 'normal' } = req.body;
    
    if (!event_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: event_id'
      });
    }
    
    const result = await redisService.addEventToSync(event_id, priority);
    res.json({
      success: true,
      message: `Event ${event_id} added to sync monitoring`,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error adding event to sync:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to add event to sync monitoring',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync/remove-event:
 *   delete:
 *     summary: Remove event from sync monitoring
 *     tags: [Sync Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_id:
 *                 type: string
 *                 description: Event ID to remove from monitoring
 */
router.delete('/remove-event', async (req, res) => {
  try {
    const { event_id } = req.body;
    
    if (!event_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: event_id'
      });
    }
    
    const result = await redisService.removeEventFromSync(event_id);
    res.json({
      success: true,
      message: `Event ${event_id} removed from sync monitoring`,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error removing event from sync:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove event from sync monitoring',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sync API is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;


