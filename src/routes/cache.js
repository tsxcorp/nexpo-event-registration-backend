const express = require('express');
const router = express.Router();
const redisService = require('../services/redisService');
const socketService = require('../services/socketService');

// Cache miss protection - prevent infinite loops
const cacheMissProtection = {
  counters: new Map(), // Track cache miss count per event
  cooldowns: new Map(), // Track cooldown periods per event
  maxMisses: 2, // Maximum consecutive cache misses before cooldown
  cooldownMs: 30000, // 30 seconds cooldown
  lastFallback: new Map() // Track last fallback time per event
};

/**
 * @swagger
 * /api/cache/status:
 *   get:
 *     summary: Get Redis cache status and statistics
 *     description: Returns comprehensive cache health information including hit rates, memory usage, and data statistics
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cache_stats:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     memory_usage:
 *                       type: string
 *                       example: "2.5MB"
 *                     hit_rate:
 *                       type: string
 *                       example: "85.2%"
 *                     total_keys:
 *                       type: integer
 *                       example: 15
 *                     events_cached:
 *                       type: integer
 *                       example: 3
 *                     registrations_cached:
 *                       type: integer
 *                       example: 3934
 *                     cache_age:
 *                       type: string
 *                       example: "0.5h"
 *                 cache_valid:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-07T11:02:50.023Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to get cache status"
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await redisService.getCacheStats();
    
    res.json({
      success: true,
      cache_stats: stats,
      cache_valid: await redisService.isCacheValid(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cache status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/populate:
 *   post:
 *     summary: Populate Redis cache from Zoho Creator
 *     description: Manually triggers cache population by fetching all data from Zoho Creator and storing in Redis
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache populated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cache populated successfully"
 *                 result:
 *                   type: object
 *                   properties:
 *                     events_loaded:
 *                       type: integer
 *                       example: 3
 *                     registrations_loaded:
 *                       type: integer
 *                       example: 3934
 *                     exhibitors_loaded:
 *                       type: integer
 *                       example: 227
 *                     cache_size:
 *                       type: string
 *                       example: "2.5MB"
 *                     duration_ms:
 *                       type: integer
 *                       example: 15420
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to populate cache"
 */
router.post('/populate', async (req, res) => {
  try {
    console.log('🚀 Manual cache population requested');
    
    // Get parameters from request body
    const { force_refresh = false, max_records = 50000, include_all_events = true } = req.body;
    
    console.log(`📊 Population params: force_refresh=${force_refresh}, max_records=${max_records}, include_all_events=${include_all_events}`);
    
    const result = await redisService.populateFromZoho({
      force_refresh,
      max_records,
      include_all_events
    });
    
    res.json({
      success: true,
      message: 'Cache populated successfully',
      result
    });
  } catch (error) {
    console.error('❌ Cache population error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to populate cache',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/refresh:
 *   post:
 *     summary: Refresh Redis cache from Zoho Creator
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache refreshed successfully
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual cache refresh requested');
    
    const result = await redisService.populateFromZoho();
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      result
    });
  } catch (error) {
    console.error('❌ Cache refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/clear:
 *   post:
 *     summary: Clear Redis cache
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/clear', async (req, res) => {
  try {
    console.log('🧹 Manual cache clear requested');
    
    const result = await redisService.clearCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      result
    });
  } catch (error) {
    console.error('❌ Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/clean-duplicates:
 *   post:
 *     summary: Clean duplicate cache entries
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Duplicate cache entries cleaned successfully
 */
router.post('/clean-duplicates', async (req, res) => {
  try {
    console.log('🧹 Manual duplicate cache clean requested');
    
    const result = await redisService.cleanDuplicateCache();
    
    res.json({
      success: true,
      message: 'Duplicate cache entries cleaned successfully',
      result
    });
  } catch (error) {
    console.error('❌ Duplicate cache clean error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean duplicate cache',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/reset-protection:
 *   post:
 *     summary: Reset cache miss protection
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache miss protection reset successfully
 */
router.post('/reset-protection', async (req, res) => {
  try {
    console.log('🔄 Manual cache miss protection reset requested');
    
    // Clear all protection data
    cacheMissProtection.counters.clear();
    cacheMissProtection.cooldowns.clear();
    cacheMissProtection.lastFallback.clear();
    
    res.json({
      success: true,
      message: 'Cache miss protection reset successfully',
      result: {
        counters_cleared: true,
        cooldowns_cleared: true,
        last_fallback_cleared: true
      }
    });
  } catch (error) {
    console.error('❌ Cache protection reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset cache protection',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/events/{eventId}:
 *   get:
 *     summary: Get event registrations from Redis cache
 *     description: Retrieves visitor registrations for a specific event from Redis cache with filtering options
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Zoho Creator Event ID
 *         example: "4433256000012557772"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, checked_in, not_yet]
 *         description: Filter by check-in status
 *         example: "all"
 *       - in: query
 *         name: group_only
 *         schema:
 *           type: boolean
 *         description: Filter for group registrations only
 *         example: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of records to return
 *         example: 10000
 *     responses:
 *       200:
 *         description: Event registrations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ID:
 *                         type: string
 *                         example: "4433256000012345678"
 *                       Name:
 *                         type: string
 *                         example: "Nguyen Van A"
 *                       Email:
 *                         type: string
 *                         example: "nguyenvana@example.com"
 *                       Check_In_Status:
 *                         type: string
 *                         example: "Checked In"
 *                       Event_Info:
 *                         type: object
 *                         properties:
 *                           ID:
 *                             type: string
 *                             example: "4433256000012557772"
 *                           Name:
 *                             type: string
 *                             example: "VIET NAM INTERNATIONAL LOGISTICS EXHIBITION 2025"
 *                 count:
 *                   type: integer
 *                   example: 150
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_for_event:
 *                       type: integer
 *                       example: 150
 *                     checked_in:
 *                       type: integer
 *                       example: 45
 *                     not_yet:
 *                       type: integer
 *                       example: 105
 *                     group_registrations:
 *                       type: integer
 *                       example: 12
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                       example: "redis_cache"
 *                     cached:
 *                       type: boolean
 *                       example: true
 *                     source:
 *                       type: string
 *                       example: "redis"
 *                     cache_age:
 *                       type: string
 *                       example: "0.5h"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve event registrations"
 */
router.get('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, group_only, limit } = req.query;
    
    const filters = {
      status: status || 'all',
      group_only: group_only || false,
      limit: limit || 10000
    };
    
    // Get event registrations from Redis
    const result = await redisService.getEventRegistrations(eventId, filters);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Get event registrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event registrations',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/events/{eventId}/stats:
 *   get:
 *     summary: Get event-specific statistics from cache
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event statistics from cache
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_for_event:
 *                       type: integer
 *                     checked_in:
 *                       type: integer
 *                     not_yet:
 *                       type: integer
 *                     group_registrations:
 *                       type: integer
 *                     group_quantity:
 *                       type: integer
 *                 metadata:
 *                   type: object
 */
router.get('/events/:eventId/stats', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log(`📊 Getting stats for event: ${eventId}`);
    
    // Get event registrations from cache with no limit to get full stats
    const result = await redisService.getEventRegistrations(eventId, { 
      status: 'all',
      group_only: false,
      limit: 999999 // No limit for stats calculation
    });
    
    if (result.success) {
      // Extract just the stats part for the response
      const statsResponse = {
        success: true,
        stats: result.stats,
        metadata: {
          method: result.metadata?.method || 'redis_cache',
          cached: result.metadata?.cached || true,
          source: result.metadata?.source || 'redis',
          event_id: eventId,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log(`✅ Event ${eventId} stats: ${result.stats.total_for_event} total, ${result.stats.checked_in} checked in`);
      res.json(statsResponse);
    } else {
      console.log(`❌ Failed to get stats for event ${eventId}`);
      res.status(404).json({
        success: false,
        error: 'Failed to get event statistics',
        event_id: eventId
      });
    }
    
  } catch (error) {
    console.error('❌ Get event stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event statistics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/zoho-change:
 *   post:
 *     summary: Handle Zoho data changes (edit/delete)
 *     tags: [Cache Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - changeType
 *               - recordId
 *             properties:
 *               changeType:
 *                 type: string
 *                 enum: [edit, delete, bulk_change]
 *               recordId:
 *                 type: string
 *               eventId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Zoho change handled successfully
 */
router.post('/zoho-change', async (req, res) => {
  try {
    const { changeType, recordId, eventId } = req.body;
    
    if (!changeType || !recordId) {
      return res.status(400).json({
        success: false,
        error: 'changeType and recordId are required'
      });
    }
    
    console.log(`🔄 Manual Zoho change request: ${changeType} for record ${recordId}`);
    
    await redisService.handleZohoDataChange(changeType, recordId, eventId);
    
    res.json({
      success: true,
      message: `Zoho change handled successfully: ${changeType}`,
      changeType,
      recordId,
      eventId
    });
  } catch (error) {
    console.error('❌ Handle Zoho change error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle Zoho change',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/integrity:
 *   get:
 *     summary: Validate cache integrity
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache integrity validation result
 */
router.get('/integrity', async (req, res) => {
  try {
    console.log('🔍 Manual cache integrity check requested');
    
    const integrity = await redisService.validateCacheIntegrity();
    
    res.json({
      success: true,
      integrity
    });
  } catch (error) {
    console.error('❌ Cache integrity check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate cache integrity',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/force-refresh:
 *   post:
 *     summary: Force cache refresh with integrity check
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache refreshed with integrity check
 */
router.post('/force-refresh', async (req, res) => {
  try {
    console.log('🔄 Manual force refresh with integrity check requested');
    
    const integrity = await redisService.forceRefreshWithIntegrityCheck();
    
    res.json({
      success: true,
      message: 'Cache refreshed with integrity check',
      integrity
    });
  } catch (error) {
    console.error('❌ Force refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force refresh cache',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/health-check:
 *   post:
 *     summary: Manual cache health check
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Health check completed
 */
router.post('/health-check', async (req, res) => {
  try {
    console.log('🔍 Manual cache health check requested');
    
    const isHealthy = await redisService.checkCacheHealth();
    
    if (isHealthy) {
      res.json({
        success: true,
        message: 'Cache is healthy',
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⚠️ Manual health check failed, triggering recovery...');
      const recovery = await redisService.handleCacheFailure();
      
      res.json({
        success: true,
        message: 'Cache recovered',
        status: 'recovered',
        recovery_method: recovery.method,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Manual health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/events/{eventId}/per-record:
 *   get:
 *     summary: Get event registrations using per-record schema (optimized for large events)
 *     description: Uses individual record keys for better performance with large datasets
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [checked_in, not_yet]
 *         description: Filter by check-in status
 *       - in: query
 *         name: group_only
 *         schema:
 *           type: boolean
 *         description: Filter for group registrations only
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *         description: Maximum number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Event registrations retrieved successfully using per-record schema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *                 cached:
 *                   type: boolean
 *                 source:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.get('/events/:eventId/per-record', async (req, res) => {
  try {
    const { eventId } = req.params;
    const options = {
      status: req.query.status,
      group_only: req.query.group_only === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };

    console.log(`🔍 Per-record schema request for event: ${eventId}`);
    
    const result = await redisService.getEventRegistrationsPerRecord(eventId, options);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Per-record schema error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/records/{recordId}:
 *   get:
 *     summary: Get individual record by ID
 *     description: Retrieve a single registration record using per-record schema
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: Record ID
 *     responses:
 *       200:
 *         description: Record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 cached:
 *                   type: boolean
 *       404:
 *         description: Record not found
 *       500:
 *         description: Internal server error
 */
router.get('/records/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;

    console.log(`🔍 Individual record request: ${recordId}`);
    
    const record = await redisService.getIndividualRecord(recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
        recordId
      });
    }
    
    res.json({
      success: true,
      data: record,
      cached: true
    });

  } catch (error) {
    console.error('❌ Individual record error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/records/{recordId}:
 *   put:
 *     summary: Update individual record (for check-in operations)
 *     description: Update a single record using per-record schema for optimal performance
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: Record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Check_in_Status:
 *                 type: string
 *                 enum: [checked_in, not_yet]
 *               Check_in_Time:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request body
 *       404:
 *         description: Record not found
 *       500:
 *         description: Internal server error
 */
router.put('/records/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const updates = req.body;

    console.log(`🔍 Update individual record: ${recordId}`, updates);
    
    const success = await redisService.updateIndividualRecord(recordId, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Record not found or update failed',
        recordId
      });
    }
    
    res.json({
      success: true,
      message: 'Record updated successfully',
      recordId
    });

  } catch (error) {
    console.error('❌ Update individual record error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
