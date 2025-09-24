const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const syncWorker = require('../services/syncWorker');

/**
 * @swagger
 * components:
 *   schemas:
 *     SyncStatus:
 *       type: object
 *       properties:
 *         is_running:
 *           type: boolean
 *         config:
 *           type: object
 *         stats:
 *           type: object
 *         last_sync_time:
 *           type: string
 *     SyncResult:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         duration:
 *           type: number
 *         records_processed:
 *           type: number
 */

/**
 * @swagger
 * /api/sync-worker/status:
 *   get:
 *     summary: Get sync worker status
 *     tags: [Sync Worker]
 *     responses:
 *       200:
 *         description: Sync worker status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SyncStatus'
 */
router.get('/status', (req, res) => {
  try {
    const status = syncWorker.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting sync worker status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync worker status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-worker/start:
 *   post:
 *     summary: Start sync worker
 *     tags: [Sync Worker]
 *     responses:
 *       200:
 *         description: Sync worker started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SyncResult'
 */
router.post('/start', async (req, res) => {
  try {
    await syncWorker.start();
    
    res.json({
      success: true,
      message: 'Sync worker started successfully',
      status: syncWorker.getStatus()
    });
  } catch (error) {
    logger.error('Error starting sync worker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start sync worker',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-worker/stop:
 *   post:
 *     summary: Stop sync worker
 *     tags: [Sync Worker]
 *     responses:
 *       200:
 *         description: Sync worker stopped successfully
 */
router.post('/stop', (req, res) => {
  try {
    syncWorker.stop();
    
    res.json({
      success: true,
      message: 'Sync worker stopped successfully',
      status: syncWorker.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping sync worker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop sync worker',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-worker/full-sync:
 *   post:
 *     summary: Perform full synchronization
 *     tags: [Sync Worker]
 *     responses:
 *       200:
 *         description: Full sync completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SyncResult'
 */
router.post('/full-sync', async (req, res) => {
  try {
    logger.info('Manual full sync requested');
    const startTime = Date.now();
    
    await syncWorker.performFullSync();
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Full sync completed successfully',
      duration: duration,
      status: syncWorker.getStatus()
    });
  } catch (error) {
    logger.error('Error performing full sync:', error);
    res.status(500).json({
      success: false,
      error: 'Full sync failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-worker/incremental-sync:
 *   post:
 *     summary: Perform incremental synchronization
 *     tags: [Sync Worker]
 *     responses:
 *       200:
 *         description: Incremental sync completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SyncResult'
 */
router.post('/incremental-sync', async (req, res) => {
  try {
    logger.info('Manual incremental sync requested');
    const startTime = Date.now();
    
    await syncWorker.performIncrementalSync();
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Incremental sync completed successfully',
      duration: duration,
      status: syncWorker.getStatus()
    });
  } catch (error) {
    logger.error('Error performing incremental sync:', error);
    res.status(500).json({
      success: false,
      error: 'Incremental sync failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-worker/force-sync/{eventId}:
 *   post:
 *     summary: Force sync specific event
 *     tags: [Sync Worker]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID to sync
 *     responses:
 *       200:
 *         description: Event sync completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SyncResult'
 */
router.post('/force-sync/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    logger.info(`Manual force sync requested for event: ${eventId}`);
    
    const result = await syncWorker.forceSyncEvent(eventId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Event ${eventId} synced successfully`,
        records_processed: result.recordCount
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Failed to sync event ${eventId}`,
        details: result.error
      });
    }
  } catch (error) {
    logger.error(`Error force syncing event ${req.params.eventId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Force sync failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/sync-worker/discrepancy-check:
 *   get:
 *     summary: Check for data discrepancies between Zoho and Redis
 *     tags: [Sync Worker]
 *     responses:
 *       200:
 *         description: Discrepancy check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 discrepancies:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event_id:
 *                         type: string
 *                       redis_count:
 *                         type: number
 *                       zoho_count:
 *                         type: number
 *                       difference:
 *                         type: number
 *                       needs_sync:
 *                         type: boolean
 */
router.get('/discrepancy-check', async (req, res) => {
  try {
    logger.info('Manual discrepancy check requested');
    
    // Get all cached events
    const redisService = require('../services/redisService');
    const eventKeys = await redisService.client.keys('cache:event:*:meta');
    const discrepancies = [];

    for (const key of eventKeys) {
      const eventId = key.match(/cache:event:([^:]+):meta/)?.[1];
      if (!eventId) continue;

      try {
        // Get Redis count
        const redisCountData = await redisService.get(`cache:event:${eventId}:count`);
        const redisCount = redisCountData ? (typeof redisCountData === 'string' ? JSON.parse(redisCountData).count : redisCountData.count || redisCountData) : 0;
        
        // Get Zoho count
        const zohoCount = await syncWorker.getZohoRecordCount(eventId);
        
        const difference = zohoCount - redisCount;
        const needsSync = difference !== 0;

        discrepancies.push({
          event_id: eventId,
          redis_count: parseInt(redisCount),
          zoho_count: zohoCount,
          difference: difference,
          needs_sync: needsSync
        });

      } catch (error) {
        logger.error(`Error checking discrepancy for event ${eventId}:`, error);
        discrepancies.push({
          event_id: eventId,
          redis_count: 'error',
          zoho_count: 'error',
          difference: 'error',
          needs_sync: true
        });
      }
    }

    const eventsNeedingSync = discrepancies.filter(d => d.needs_sync);
    
    res.json({
      success: true,
      total_events: discrepancies.length,
      events_needing_sync: eventsNeedingSync.length,
      discrepancies: discrepancies
    });

  } catch (error) {
    logger.error('Error performing discrepancy check:', error);
    res.status(500).json({
      success: false,
      error: 'Discrepancy check failed',
      details: error.message
    });
  }
});

module.exports = router;
