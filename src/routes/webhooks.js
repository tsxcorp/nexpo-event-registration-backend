const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const crypto = require('crypto');
// redisService removed - functionality integrated into redisService
const redisService = require('../services/redisService');
const socketService = require('../services/socketService');

/**
 * Enhanced Zoho Webhook Endpoint
 * Receives real-time notifications when Zoho data changes
 * Supports comprehensive CRUD operations with enhanced validation
 */
router.post('/zoho-changes', async (req, res) => {
  try {
    logger.info('📡 Zoho webhook received:', req.body);
    
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
        logger.error("Invalid webhook signature");
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
        logger.info("⚠️ Unknown event type: ${event_type}, using bulk_change");
    }
    
    logger.info("Processing Zoho webhook: ${changeType} for record ${recordId} in ${report_name}");
    
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
    logger.error("Zoho webhook error:", error);
    
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
    logger.info('📡 Zoho Creator function webhook received:', req.body);
    
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
        logger.info("⚠️ Unknown function: ${function_name}, using bulk_change");
    }
    
    logger.info("Processing Zoho Creator function: ${changeType} for record ${recordId}");
    
    // Handle the change
    await redisService.handleZohoDataChange(changeType, recordId, eventId);
    
    res.json({
      success: true,
      message: `Zoho Creator function processed: ${changeType}`,
      function_name,
      record_id,
      event_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error("Zoho Creator function webhook error:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Zoho Creator function',
      details: error.message
    });
  }
});

/**
 * Enhanced webhook change handler with better error recovery
 */
async function handleWebhookChange(changeType, recordId, eventId, data, reportName) {
  try {
    logger.info("Processing webhook change: ${changeType} for record ${recordId}");
    
    let result = { success: false, method: 'webhook', changeType };
    
    switch (changeType) {
      case 'create':
        // New record created - add to cache
        if (recordId) {
          const newRecord = await redisService.fetchSingleRecord(recordId);
          if (newRecord) {
            await redisService.updateSingleRecord(recordId, newRecord);
            result.success = true;
            result.action = 'record_added';
            logger.info("New record ${recordId} added to cache via webhook");
          }
        }
        break;
        
      case 'edit':
        // Record updated - update in cache
        if (recordId) {
          const updatedRecord = await redisService.fetchSingleRecord(recordId);
          if (updatedRecord) {
            await redisService.updateSingleRecord(recordId, updatedRecord);
            result.success = true;
            result.action = 'record_updated';
            logger.info("Record ${recordId} updated in cache via webhook");
          }
        }
        break;
        
      case 'delete':
        // Record deleted - remove from cache
        if (recordId) {
          await redisService.handleRecordDelete(recordId, eventId);
          result.success = true;
          result.action = 'record_deleted';
          logger.info("Record ${recordId} removed from cache via webhook");
        }
        break;
        
      case 'bulk_change':
        // Bulk operation - trigger lightweight sync instead of full refresh
        logger.info("Bulk change detected, performing lightweight sync...");
        const syncResult = await redisService.lightweightSync();
        result.success = syncResult.success;
        result.action = 'bulk_sync';
        result.sync_method = syncResult.method;
        logger.info("Bulk change handled via ${syncResult.method}");
        break;
        
      default:
        logger.info("⚠️ Unknown change type: ${changeType}");
        result.success = false;
        result.error = `Unknown change type: ${changeType}`;
    }
    
    // Broadcast real-time update if successful
    if (result.success && eventId) {
      try {
        await socketService.pushRegistrationData(eventId, {
          type: 'webhook_update',
          change_type: changeType,
          record_id: recordId,
          timestamp: new Date().toISOString()
        }, 'webhook_update');
        logger.info(`📡 Real-time update broadcasted for event ${eventId}`);
      } catch (broadcastError) {
        logger.warn("Real-time broadcast failed:", broadcastError.message);
        // Don't fail the webhook for broadcast errors
      }
    }
    
    return result;
    
  } catch (error) {
    logger.error("Webhook change handler error:", error);
    return {
      success: false,
      method: 'webhook',
      changeType,
      error: error.message
    };
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
    logger.error("Signature validation error:", error);
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
    logger.error("Error logging webhook metrics:", error);
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
    logger.error("Error getting webhook metrics:", error);
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
    logger.info("🧪 Test webhook received:", req.body);
    
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
    logger.error("Test webhook error:", error);
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
