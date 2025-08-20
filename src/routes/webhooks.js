const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const redisPopulationService = require('../services/redisPopulationService');
const redisService = require('../services/redisService');
const socketService = require('../services/socketService');

/**
 * Enhanced Zoho Webhook Endpoint
 * Receives real-time notifications when Zoho data changes
 * Supports comprehensive CRUD operations with enhanced validation
 */
router.post('/zoho-changes', async (req, res) => {
  try {
    console.log('📡 Zoho webhook received:', req.body);
    
    const { 
      event_type, 
      record_id, 
      event_id, 
      action, 
      timestamp,
      data,
      report_name = 'All_Registrations',
      signature
    } = req.body;
    
    // Enhanced webhook signature validation
    if (process.env.ZOHO_WEBHOOK_SECRET && signature) {
      if (!validateWebhookSignature(req, signature)) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ 
          success: false,
          error: 'Invalid webhook signature' 
        });
      }
    }
    
    // Validate required fields
    if (!event_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: event_type'
      });
    }
    
    let changeType = 'bulk_change';
    let recordId = record_id;
    let eventId = event_id;
    
    // Enhanced mapping of Zoho event types
    switch (event_type) {
      case 'record_created':
      case 'record.created':
      case 'CREATE':
        changeType = 'create';
        break;
        
      case 'record_updated':
      case 'record.updated':
      case 'UPDATE':
        changeType = 'edit';
        break;
        
      case 'record_deleted':
      case 'record.deleted':
      case 'DELETE':
        changeType = 'delete';
        break;
        
      case 'bulk_operation':
      case 'bulk.operation':
      case 'BULK_UPDATE':
        changeType = 'bulk_change';
        break;
        
      default:
        changeType = 'bulk_change';
        console.log(`⚠️ Unknown event type: ${event_type}, using bulk_change`);
    }
    
    console.log(`🔄 Processing Zoho webhook: ${changeType} for record ${recordId} in ${report_name}`);
    
    // Enhanced change handling with detailed logging
    const processingResult = await handleWebhookChange(changeType, recordId, eventId, data, report_name);
    
    // Log webhook processing metrics
    await logWebhookMetrics(event_type, changeType, recordId, eventId, processingResult.success);
    
    res.json({
      success: true,
      message: `Zoho change processed: ${changeType}`,
      event_type,
      record_id: recordId,
      event_id: eventId,
      report_name,
      processing_result: processingResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Zoho webhook error:', error);
    
    // Log error metrics
    await logWebhookMetrics(req.body.event_type, 'error', req.body.record_id, req.body.event_id, false);
    
    res.status(500).json({
      success: false,
      error: 'Failed to process Zoho webhook',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Zoho Creator Custom Function Webhook
 * For custom functions that trigger on data changes
 */
router.post('/zoho-creator-function', async (req, res) => {
  try {
    console.log('📡 Zoho Creator function webhook received:', req.body);
    
    const { 
      function_name,
      record_id,
      event_id,
      action,
      data 
    } = req.body;
    
    let changeType = 'bulk_change';
    let recordId = record_id;
    let eventId = event_id;
    
    // Map function names to change types
    switch (function_name) {
      case 'NXP_RecordUpdated':
        changeType = 'edit';
        break;
        
      case 'NXP_RecordDeleted':
        changeType = 'delete';
        break;
        
      case 'NXP_BulkOperation':
        changeType = 'bulk_change';
        break;
        
      default:
        changeType = 'bulk_change';
        console.log(`⚠️ Unknown function: ${function_name}, using bulk_change`);
    }
    
    console.log(`🔄 Processing Zoho Creator function: ${changeType} for record ${recordId}`);
    
    // Handle the change
    await redisPopulationService.handleZohoDataChange(changeType, recordId, eventId);
    
    res.json({
      success: true,
      message: `Zoho Creator function processed: ${changeType}`,
      function_name,
      record_id,
      event_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Zoho Creator function webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Zoho Creator function',
      details: error.message
    });
  }
});

/**
 * Enhanced webhook change handler
 * Handles different types of changes with improved error handling
 */
async function handleWebhookChange(changeType, recordId, eventId, data, reportName) {
  try {
    console.log(`🔄 Handling webhook change: ${changeType}`, { recordId, eventId, reportName });
    
    switch (changeType) {
      case 'create':
        return await handleRecordCreate(recordId, eventId, data, reportName);
      case 'edit':
        return await handleRecordEdit(recordId, eventId, data, reportName);
      case 'delete':
        return await handleRecordDelete(recordId, eventId, reportName);
      case 'bulk_change':
        return await handleBulkChange(reportName);
      default:
        console.log(`⚠️ Unknown change type: ${changeType}, falling back to bulk change`);
        return await handleBulkChange(reportName);
    }
  } catch (error) {
    console.error(`❌ Error handling webhook change:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle record creation
 */
async function handleRecordCreate(recordId, eventId, data, reportName) {
  try {
    console.log(`✨ Handling record creation: ${recordId}`);
    
    // If we have the data in webhook, use it. Otherwise fetch from Zoho
    let newRecord = data;
    if (!newRecord && recordId) {
      const fetchResult = await redisPopulationService.fetchSingleRecord(recordId);
      newRecord = fetchResult;
    }
    
    if (newRecord) {
      await redisPopulationService.updateCache(newRecord);
      
      // Broadcast real-time update
      await socketService.broadcastToAll('record_created', {
        record_id: recordId,
        event_id: eventId,
        data: newRecord,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Record creation handled: ${recordId}`);
      return { success: true, action: 'created', recordId };
    } else {
      console.log(`⚠️ No data found for created record: ${recordId}`);
      return { success: false, error: 'Record data not found' };
    }
  } catch (error) {
    console.error(`❌ Error handling record creation:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle record edit
 */
async function handleRecordEdit(recordId, eventId, data, reportName) {
  try {
    console.log(`📝 Handling record edit: ${recordId}`);
    
    // Use webhook data if available, otherwise fetch from Zoho
    let updatedRecord = data;
    if (!updatedRecord && recordId) {
      updatedRecord = await redisPopulationService.fetchSingleRecord(recordId);
    }
    
    if (updatedRecord) {
      await redisPopulationService.updateSingleRecord(recordId, updatedRecord);
      
      // Broadcast real-time update
      await socketService.broadcastToAll('record_updated', {
        record_id: recordId,
        event_id: eventId,
        data: updatedRecord,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Record edit handled: ${recordId}`);
      return { success: true, action: 'updated', recordId };
    } else {
      console.log(`⚠️ Record not found, might be deleted: ${recordId}`);
      // Handle as deletion
      return await handleRecordDelete(recordId, eventId, reportName);
    }
  } catch (error) {
    console.error(`❌ Error handling record edit:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle record deletion
 */
async function handleRecordDelete(recordId, eventId, reportName) {
  try {
    console.log(`🗑️ Handling record deletion: ${recordId}`);
    
    await redisPopulationService.handleRecordDelete(recordId, eventId);
    
    // Broadcast real-time update
    await socketService.broadcastToAll('record_deleted', {
      record_id: recordId,
      event_id: eventId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Record deletion handled: ${recordId}`);
    return { success: true, action: 'deleted', recordId };
  } catch (error) {
    console.error(`❌ Error handling record deletion:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle bulk changes
 */
async function handleBulkChange(reportName) {
  try {
    console.log(`🔄 Handling bulk change for: ${reportName}`);
    
    const result = await redisPopulationService.populateFromZoho();
    
    // Broadcast bulk update
    await socketService.broadcastToAll('bulk_update', {
      report_name: reportName,
      result,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Bulk change handled for: ${reportName}`);
    return { success: true, action: 'bulk_update', result };
  } catch (error) {
    console.error(`❌ Error handling bulk change:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate webhook signature for security
 */
function validateWebhookSignature(req, signature) {
  try {
    const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
    if (!webhookSecret) return true; // Skip validation if no secret configured
    
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Signature validation error:', error);
    return false;
  }
}

/**
 * Log webhook processing metrics to Redis
 */
async function logWebhookMetrics(eventType, changeType, recordId, eventId, success) {
  try {
    if (!redisService.isReady()) return;
    
    const today = new Date().toISOString().split('T')[0];
    const metricsKey = `webhook:metrics:${today}`;
    
    const metrics = await redisService.get(metricsKey) || {
      total_webhooks: 0,
      successful: 0,
      failed: 0,
      by_event_type: {},
      by_change_type: {},
      by_event_id: {}
    };
    
    metrics.total_webhooks++;
    if (success) {
      metrics.successful++;
    } else {
      metrics.failed++;
    }
    
    metrics.by_event_type[eventType] = (metrics.by_event_type[eventType] || 0) + 1;
    metrics.by_change_type[changeType] = (metrics.by_change_type[changeType] || 0) + 1;
    
    if (eventId) {
      metrics.by_event_id[eventId] = (metrics.by_event_id[eventId] || 0) + 1;
    }
    
    await redisService.set(metricsKey, metrics, 7 * 24 * 60 * 60); // 7 days TTL
    
  } catch (error) {
    console.error('❌ Error logging webhook metrics:', error);
  }
}

/**
 * Get webhook processing metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const metricsKey = `webhook:metrics:${date}`;
    
    const metrics = await redisService.get(metricsKey) || {
      total_webhooks: 0,
      successful: 0,
      failed: 0,
      by_event_type: {},
      by_change_type: {},
      by_event_id: {}
    };
    
    res.json({
      success: true,
      date,
      metrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting webhook metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook metrics',
      details: error.message
    });
  }
});

/**
 * Test webhook endpoint for development
 */
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Test webhook received:', req.body);
    
    const testData = {
      event_type: req.body.event_type || 'record_updated',
      record_id: req.body.record_id || 'test_record_123',
      event_id: req.body.event_id || 'test_event_456',
      data: req.body.data || { test: true },
      report_name: req.body.report_name || 'All_Registrations'
    };
    
    const processingResult = await handleWebhookChange(
      testData.event_type === 'record_updated' ? 'edit' : 'bulk_change',
      testData.record_id,
      testData.event_id,
      testData.data,
      testData.report_name
    );
    
    res.json({
      success: true,
      message: 'Test webhook processed',
      test_data: testData,
      processing_result: processingResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Test webhook failed',
      details: error.message
    });
  }
});

/**
 * Health check for webhook endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Zoho webhook endpoint is healthy',
    redis_connected: redisService.isReady(),
    webhook_secret_configured: !!process.env.ZOHO_WEBHOOK_SECRET,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
