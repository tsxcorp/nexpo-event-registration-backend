const express = require('express');
const router = express.Router();
const redisPopulationService = require('../services/redisPopulationService');

/**
 * Zoho Webhook Endpoint
 * Receives real-time notifications when Zoho data changes
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
      data 
    } = req.body;
    
    // Validate webhook signature (if Zoho provides)
    // if (!validateWebhookSignature(req)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }
    
    let changeType = 'bulk_change';
    let recordId = null;
    let eventId = null;
    
    // Map Zoho event types to our change types
    switch (event_type) {
      case 'record_created':
        changeType = 'edit';
        recordId = record_id;
        eventId = event_id;
        break;
        
      case 'record_updated':
        changeType = 'edit';
        recordId = record_id;
        eventId = event_id;
        break;
        
      case 'record_deleted':
        changeType = 'delete';
        recordId = record_id;
        eventId = event_id;
        break;
        
      case 'bulk_operation':
        changeType = 'bulk_change';
        break;
        
      default:
        changeType = 'bulk_change';
        console.log(`⚠️ Unknown event type: ${event_type}, using bulk_change`);
    }
    
    console.log(`🔄 Processing Zoho webhook: ${changeType} for record ${recordId}`);
    
    // Handle the change
    await redisPopulationService.handleZohoDataChange(changeType, recordId, eventId);
    
    res.json({
      success: true,
      message: `Zoho change processed: ${changeType}`,
      event_type,
      record_id,
      event_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Zoho webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Zoho webhook',
      details: error.message
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
 * Health check for webhook endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Zoho webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
