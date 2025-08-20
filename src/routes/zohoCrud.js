const express = require('express');
const router = express.Router();
const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
const redisPopulationService = require('../services/redisPopulationService');
const redisService = require('../services/redisService');
const socketService = require('../services/socketService');

/**
 * Comprehensive CRUD API for Zoho data management with Redis sync
 * This router handles all CRUD operations and ensures Redis cache is updated
 */

/**
 * @swagger
 * /api/zoho-crud/create:
 *   post:
 *     summary: Create new record in Zoho and update Redis
 *     tags: [Zoho CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report_name:
 *                 type: string
 *                 example: "All_Registrations"
 *               data:
 *                 type: object
 *                 description: Record data to create
 *               update_cache:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to update Redis cache after creation
 */
router.post('/create', async (req, res) => {
  try {
    const { report_name, data, update_cache = true } = req.body;
    
    console.log(`📝 Creating new record in ${report_name}:`, data);
    
    // Validate required fields
    if (!report_name || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: report_name and data are required'
      });
    }
    
    // Create record in Zoho
    const zohoResponse = await zohoCreatorAPI.createRecord(report_name, data);
    
    if (!zohoResponse.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create record in Zoho',
        details: zohoResponse.error
      });
    }
    
    const newRecord = zohoResponse.data;
    console.log(`✅ Record created in Zoho:`, newRecord);
    
    // Update Redis cache if requested
    if (update_cache && newRecord) {
      try {
        await redisPopulationService.updateCache(newRecord);
        console.log(`🔄 Redis cache updated with new record: ${newRecord.ID}`);
        
        // Broadcast real-time update
        await socketService.broadcastToAll('record_created', {
          record_id: newRecord.ID,
          event_id: newRecord.Event_Info?.ID,
          data: newRecord,
          timestamp: new Date().toISOString()
        });
        
      } catch (cacheError) {
        console.error('❌ Cache update error:', cacheError);
        // Don't fail the entire operation, just log the error
      }
    }
    
    res.json({
      success: true,
      message: 'Record created successfully',
      data: newRecord,
      zoho_record_id: newRecord.ID,
      cache_updated: update_cache,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Create record error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-crud/read:
 *   get:
 *     summary: Read records from Zoho or Redis cache
 *     tags: [Zoho CRUD]
 *     parameters:
 *       - in: query
 *         name: report_name
 *         required: true
 *         schema:
 *           type: string
 *           example: "All_Registrations"
 *       - in: query
 *         name: record_id
 *         schema:
 *           type: string
 *           description: Specific record ID (optional)
 *       - in: query
 *         name: event_id
 *         schema:
 *           type: string
 *           description: Filter by event ID
 *       - in: query
 *         name: use_cache
 *         schema:
 *           type: boolean
 *           default: true
 *           description: Whether to use Redis cache
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 */
router.get('/read', async (req, res) => {
  try {
    const { 
      report_name, 
      record_id, 
      event_id, 
      use_cache = true,
      limit = 100 
    } = req.query;
    
    if (!report_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: report_name'
      });
    }
    
    console.log(`📖 Reading data from ${report_name}:`, {
      record_id,
      event_id,
      use_cache,
      limit
    });
    
    let result;
    let dataSource = 'zoho';
    
    // If specific record ID requested, always fetch from Zoho
    if (record_id) {
      result = await zohoCreatorAPI.getRecord(report_name, record_id);
      result.data = [result.data]; // Wrap in array for consistency
    }
    // If event_id and cache enabled, try Redis first
    else if (event_id && use_cache) {
      try {
        const cachedData = await redisPopulationService.getEventRegistrations(event_id, { limit });
        if (cachedData.success && cachedData.data.length > 0) {
          result = cachedData;
          dataSource = 'redis_cache';
        } else {
          // Fallback to Zoho if cache miss
          result = await zohoCreatorAPI.getReportRecords(report_name, {
            criteria: `Event_Info.ID == "${event_id}"`,
            max_records: limit
          });
          dataSource = 'zoho_fallback';
        }
      } catch (cacheError) {
        console.error('❌ Cache read error:', cacheError);
        // Fallback to Zoho
        result = await zohoCreatorAPI.getReportRecords(report_name, {
          criteria: event_id ? `Event_Info.ID == "${event_id}"` : undefined,
          max_records: limit
        });
        dataSource = 'zoho_fallback';
      }
    }
    // Default: fetch from Zoho
    else {
      result = await zohoCreatorAPI.getReportRecords(report_name, {
        criteria: event_id ? `Event_Info.ID == "${event_id}"` : undefined,
        max_records: limit
      });
    }
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to read data',
        details: result.error
      });
    }
    
    console.log(`✅ Data read successfully from ${dataSource}: ${result.data.length} records`);
    
    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      metadata: {
        source: dataSource,
        report_name,
        event_id,
        record_id,
        limit,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Read records error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-crud/update:
 *   put:
 *     summary: Update record in Zoho and sync to Redis
 *     tags: [Zoho CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report_name:
 *                 type: string
 *                 example: "All_Registrations"
 *               record_id:
 *                 type: string
 *                 description: ID of record to update
 *               data:
 *                 type: object
 *                 description: Updated data
 *               update_cache:
 *                 type: boolean
 *                 default: true
 */
router.put('/update', async (req, res) => {
  try {
    const { report_name, record_id, data, update_cache = true } = req.body;
    
    console.log(`📝 Updating record ${record_id} in ${report_name}:`, data);
    
    // Validate required fields
    if (!report_name || !record_id || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: report_name, record_id, and data are required'
      });
    }
    
    // Update record in Zoho
    const zohoResponse = await zohoCreatorAPI.updateRecord(report_name, record_id, data);
    
    if (!zohoResponse.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update record in Zoho',
        details: zohoResponse.error
      });
    }
    
    const updatedRecord = zohoResponse.data;
    console.log(`✅ Record updated in Zoho:`, updatedRecord);
    
    // Update Redis cache if requested
    if (update_cache && updatedRecord) {
      try {
        await redisPopulationService.updateSingleRecord(record_id, updatedRecord);
        console.log(`🔄 Redis cache updated for record: ${record_id}`);
        
        // Broadcast real-time update
        await socketService.broadcastToAll('record_updated', {
          record_id: record_id,
          event_id: updatedRecord.Event_Info?.ID,
          data: updatedRecord,
          timestamp: new Date().toISOString()
        });
        
      } catch (cacheError) {
        console.error('❌ Cache update error:', cacheError);
        // Don't fail the entire operation
      }
    }
    
    res.json({
      success: true,
      message: 'Record updated successfully',
      data: updatedRecord,
      record_id: record_id,
      cache_updated: update_cache,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Update record error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-crud/delete:
 *   delete:
 *     summary: Delete record from Zoho and Redis
 *     tags: [Zoho CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report_name:
 *                 type: string
 *                 example: "All_Registrations"
 *               record_id:
 *                 type: string
 *                 description: ID of record to delete
 *               event_id:
 *                 type: string
 *                 description: Event ID (optional, for cache optimization)
 *               update_cache:
 *                 type: boolean
 *                 default: true
 */
router.delete('/delete', async (req, res) => {
  try {
    const { report_name, record_id, event_id, update_cache = true } = req.body;
    
    console.log(`🗑️ Deleting record ${record_id} from ${report_name}`);
    
    // Validate required fields
    if (!report_name || !record_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: report_name and record_id are required'
      });
    }
    
    // Delete record from Zoho
    const zohoResponse = await zohoCreatorAPI.deleteRecord(report_name, record_id);
    
    if (!zohoResponse.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete record from Zoho',
        details: zohoResponse.error
      });
    }
    
    console.log(`✅ Record deleted from Zoho: ${record_id}`);
    
    // Update Redis cache if requested
    if (update_cache) {
      try {
        await redisPopulationService.handleRecordDelete(record_id, event_id);
        console.log(`🔄 Redis cache updated - record removed: ${record_id}`);
        
        // Broadcast real-time update
        await socketService.broadcastToAll('record_deleted', {
          record_id: record_id,
          event_id: event_id,
          timestamp: new Date().toISOString()
        });
        
      } catch (cacheError) {
        console.error('❌ Cache update error:', cacheError);
        // Don't fail the entire operation
      }
    }
    
    res.json({
      success: true,
      message: 'Record deleted successfully',
      record_id: record_id,
      cache_updated: update_cache,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Delete record error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-crud/bulk-sync:
 *   post:
 *     summary: Perform bulk synchronization between Zoho and Redis
 *     tags: [Zoho CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report_name:
 *                 type: string
 *                 example: "All_Registrations"
 *               event_id:
 *                 type: string
 *                 description: Sync specific event (optional)
 *               force_refresh:
 *                 type: boolean
 *                 default: false
 *                 description: Force full cache refresh
 */
router.post('/bulk-sync', async (req, res) => {
  try {
    const { report_name = 'All_Registrations', event_id, force_refresh = false } = req.body;
    
    console.log(`🔄 Starting bulk sync for ${report_name}:`, { event_id, force_refresh });
    
    let result;
    
    if (force_refresh || !await redisPopulationService.isCacheValid()) {
      // Full cache refresh
      console.log('🔄 Performing full cache refresh...');
      result = await redisPopulationService.populateFromZoho();
    } else {
      // Integrity check and conditional refresh
      console.log('🔍 Performing integrity check...');
      const integrityCheck = await redisPopulationService.validateCacheIntegrity();
      
      if (!integrityCheck.valid) {
        console.log('⚠️ Cache integrity failed, refreshing...');
        result = await redisPopulationService.populateFromZoho();
      } else {
        console.log('✅ Cache integrity OK, no refresh needed');
        result = {
          success: true,
          message: 'Cache is already up to date',
          integrity_check: integrityCheck
        };
      }
    }
    
    // Broadcast sync completion
    await socketService.broadcastToAll('bulk_sync_completed', {
      report_name,
      event_id,
      result,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Bulk synchronization completed',
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Bulk sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk synchronization failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-crud/sync-status:
 *   get:
 *     summary: Get synchronization status between Zoho and Redis
 *     tags: [Zoho CRUD]
 */
router.get('/sync-status', async (req, res) => {
  try {
    const cacheStats = await redisPopulationService.getCacheStats();
    const integrityCheck = await redisPopulationService.validateCacheIntegrity();
    
    res.json({
      success: true,
      data: {
        cache_stats: cacheStats,
        integrity_check: integrityCheck,
        redis_connected: redisService.isReady(),
        last_check: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
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
    message: 'Zoho CRUD API is healthy',
    redis_connected: redisService.isReady(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;


