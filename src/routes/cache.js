const express = require('express');
const router = express.Router();
const redisPopulationService = require('../services/redisPopulationService');

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
    
    // Try to get from cache first
    let result = await redisPopulationService.getEventRegistrations(eventId, filters);
    
    // If cache is empty, fallback to direct Zoho API
    if (!result.data || result.data.length === 0 || result.count === 0) {
      console.log(`🔄 Cache empty for event ${eventId}, falling back to Zoho API`);
      
      try {
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
            filtered_at: new Date().toISOString()
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
            error: fallbackError.message
          }
        };
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
