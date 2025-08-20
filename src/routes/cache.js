const express = require('express');
const router = express.Router();
const redisPopulationService = require('../services/redisPopulationService');
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
 *     summary: Get cache status and statistics
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache status information
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await redisPopulationService.getCacheStats();
    
    res.json({
      success: true,
      cache_stats: stats,
      cache_valid: await redisPopulationService.isCacheValid(),
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
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache populated successfully
 */
router.post('/populate', async (req, res) => {
  try {
    console.log('🚀 Manual cache population requested');
    
    const result = await redisPopulationService.populateFromZoho();
    
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
    
    const result = await redisPopulationService.populateFromZoho();
    
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
    
    const result = await redisPopulationService.clearCache();
    
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
 *     summary: Get event registrations from cache
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, checked_in, not_yet]
 *       - in: query
 *         name: group_only
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event registrations from cache
 */
router.get('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, group_only, limit } = req.query;
    
    const filters = {
      status: status || 'all',
      group_only: group_only || false,
      limit: limit || 5000
    };
    
    // Check cache miss protection
    const now = Date.now();
    const eventKey = `${eventId}_${JSON.stringify(filters)}`;
    
    // Check if in cooldown
    const cooldownUntil = cacheMissProtection.cooldowns.get(eventKey);
    if (cooldownUntil && now < cooldownUntil) {
      console.log(`⏳ Cache miss cooldown active for event ${eventId}, returning empty result`);
      return res.json({
        success: true,
        data: [],
        count: 0,
        stats: { total_for_event: 0, checked_in: 0, not_yet: 0, group_registrations: 0 },
        metadata: { 
          method: 'cooldown_protection', 
          cached: false,
          source: 'protection',
          cooldown_until: new Date(cooldownUntil).toISOString(),
          message: 'Cache miss protection active'
        }
      });
    }
    
    // Try to get from cache first
    let result = await redisPopulationService.getEventRegistrations(eventId, filters);
    
    // Check if cache miss
    const isCacheMiss = !result.success || result.metadata?.method !== 'redis_cache';
    
    if (isCacheMiss) {
      // Increment cache miss counter
      const currentCount = cacheMissProtection.counters.get(eventKey) || 0;
      const newCount = currentCount + 1;
      cacheMissProtection.counters.set(eventKey, newCount);
      
      console.log(`⚠️ Cache miss #${newCount} for event ${eventId}`);
      
      // Check if we should trigger cooldown
      if (newCount >= cacheMissProtection.maxMisses) {
        const cooldownEnd = now + cacheMissProtection.cooldownMs;
        cacheMissProtection.cooldowns.set(eventKey, cooldownEnd);
        cacheMissProtection.counters.set(eventKey, 0); // Reset counter
        
        console.log(`🛡️ Cache miss protection triggered for event ${eventId}, cooldown until ${new Date(cooldownEnd).toISOString()}`);
        
        return res.json({
          success: true,
          data: [],
          count: 0,
          stats: { total_for_event: 0, checked_in: 0, not_yet: 0, group_registrations: 0 },
          metadata: { 
            method: 'cache_miss_protection', 
            cached: false,
            source: 'protection',
            cooldown_until: new Date(cooldownEnd).toISOString(),
            message: 'Cache miss protection triggered'
          }
        });
      }
      
      // Check if we should skip fallback (rate limiting)
      const lastFallback = cacheMissProtection.lastFallback.get(eventKey) || 0;
      const timeSinceLastFallback = now - lastFallback;
      const minFallbackInterval = 10000; // 10 seconds between fallbacks
      
      if (timeSinceLastFallback < minFallbackInterval) {
        console.log(`⏳ Rate limiting fallback for event ${eventId}, last fallback was ${Math.round(timeSinceLastFallback/1000)}s ago`);
        return res.json({
          success: true,
          data: [],
          count: 0,
          stats: { total_for_event: 0, checked_in: 0, not_yet: 0, group_registrations: 0 },
          metadata: { 
            method: 'rate_limited', 
            cached: false,
            source: 'protection',
            last_fallback: new Date(lastFallback).toISOString(),
            message: 'Fallback rate limited'
          }
        });
      }
      
      console.log(`🔄 Cache invalid/empty for event ${eventId}, falling back to Zoho API (miss #${newCount})`);
      
      try {
        // Update last fallback time
        cacheMissProtection.lastFallback.set(eventKey, now);
        
        const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
        const allRegistrations = await zohoCreatorAPI.getReportRecords('All_Registrations', {
          max_records: 1000,
          fetchAll: true,
          useCache: false
        });
        
        // Filter by event
        let filteredData = allRegistrations.data.filter(record => {
          if (!record.Event_Info || !record.Event_Info.ID) {
            return false;
          }
          return record.Event_Info.ID === eventId;
        });
        
        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          filteredData = filteredData.filter(record => {
            const isCheckedIn = record.Check_In_Status === 'Checked In';
            if (filters.status === 'checked_in') return isCheckedIn;
            if (filters.status === 'not_yet') return !isCheckedIn;
            return true;
          });
        }
        
        // Apply group registration filter
        if (filters.group_only === 'true' || filters.group_only === true) {
          filteredData = filteredData.filter(record => {
            return record.Group_Registration === 'true';
          });
        }
        
        // Apply limit
        const limitedResults = filteredData.slice(0, parseInt(filters.limit));
        
        // Calculate statistics
        const stats = {
          total_for_event: filteredData.length,
          checked_in: filteredData.filter(r => r.Check_In_Status === 'Checked In').length,
          not_yet: filteredData.filter(r => r.Check_In_Status === 'Not Yet').length,
          group_registrations: filteredData.filter(r => r.Group_Registration === 'true').length,
          returned: limitedResults.length
        };
        
        result = {
          success: true,
          data: limitedResults,
          count: limitedResults.length,
          stats,
          metadata: { 
            method: 'zoho_api_fallback', 
            cached: false,
            source: 'zoho',
            filtered_at: new Date().toISOString(),
            cache_miss_count: newCount
          }
        };
        
      } catch (fallbackError) {
        console.error('❌ Fallback to Zoho API failed:', fallbackError);
        // Return empty result if both cache and fallback fail
        result = {
          success: true,
          data: [],
          count: 0,
          stats: { total_for_event: 0, checked_in: 0, not_yet: 0, group_registrations: 0 },
          metadata: { 
            method: 'fallback_failed', 
            cached: false,
            source: 'none',
            error: fallbackError.message,
            cache_miss_count: newCount
          }
        };
      }
    } else {
      // Cache hit - reset counter
      cacheMissProtection.counters.set(eventKey, 0);
      
      // Cache hit - even if 0 records, this is valid
      if (result.count === 0) {
        console.log(`✅ Cache hit for event ${eventId}: 0 registrations (valid empty event)`);
      } else {
        console.log(`✅ Cache hit for event ${eventId}: ${result.count} registrations`);
      }
    }
    
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
    const result = await redisPopulationService.getEventRegistrations(eventId, { 
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
    
    await redisPopulationService.handleZohoDataChange(changeType, recordId, eventId);
    
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
    
    const integrity = await redisPopulationService.validateCacheIntegrity();
    
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
    
    const integrity = await redisPopulationService.forceRefreshWithIntegrityCheck();
    
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

module.exports = router;
