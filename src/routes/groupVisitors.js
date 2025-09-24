const express = require('express');
const logger = require('../utils/logger');
const axios = require('axios');
const https = require('https');
const { exec } = require('child_process');
const router = express.Router();

/**
 * GET /api/group-visitors
 * Fetch group visitors from custom Zoho API
 */
router.get('/', async (req, res) => {
  try {
    logger.info("Fetching group visitors from custom Zoho API...");
    
    // Get query parameters
    const { event_id, group_id, grp_id, limit } = req.query;
    
    const params = {
      publickey: 'yNCkueSrUthmff4ZKzKUAwjJu'
    };
    
    // Add optional parameters
    if (event_id) params.event_id = event_id;
    if (group_id) params.grp_id = group_id; // Map group_id to grp_id
    if (grp_id) params.grp_id = grp_id; // Direct grp_id parameter
    if (limit) params.limit = limit;
    
    logger.info('📋 API params:', params);
    
    logger.info('📡 Making request to:', 'https://www.zohoapis.com/creator/custom/tsxcorp/getGroupVisitors');
    logger.info('📋 Request params:', params);
    
    // Use axios with same config as zohoVisitorUtils.js
    const response = await axios.get('https://www.zohoapis.com/creator/custom/tsxcorp/getGroupVisitors', {
      headers: { Accept: 'application/json' },
      params,
      timeout: 30000,
      responseType: 'text' // 🛑 tránh mất số khi parse
    });
    
    logger.info('📋 Raw response:', response.data);
    
    // Parse response like zohoVisitorUtils.js
    const data = JSON.parse(response.data);
    logger.info('📋 Parsed response data:', JSON.stringify(data, null, 2));
    
    // Update response object to match expected structure
    response.data = data;
    
    logger.info("Group visitors fetched successfully: ${response.data.result?.length || 0} visitors");
    
    res.json({
      success: true,
      data: response.data.result || [],
      count: response.data.result?.length || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error("Error fetching group visitors:", error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/group-visitors/:groupId
 * Fetch visitors for specific group
 */
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    logger.info("Fetching group visitors for group: ${groupId}");
    
    const response = await axios.get('https://www.zohoapis.com/creator/custom/tsxcorp/getGroupVisitors', {
      headers: {
        'Content-Type': 'application/json'
      },
      params: {
        publickey: 'yNCkueSrUthmff4ZKzKUAwjJu'
      }
    });
    
    // Filter by group_id
    const groupVisitors = response.data.result.filter(visitor => visitor.group_id === groupId);
    
    logger.info("Group visitors for ${groupId}: ${groupVisitors.length} visitors");
    
    res.json({
      success: true,
      group_id: groupId,
      data: groupVisitors,
      count: groupVisitors.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error("Error fetching group visitors:", error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/group-visitors/event/:eventId
 * Fetch group visitors for specific event
 */
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    logger.info("Fetching group visitors for event: ${eventId}");
    
    const response = await axios.get('https://www.zohoapis.com/creator/custom/tsxcorp/getGroupVisitors', {
      headers: {
        'Content-Type': 'application/json'
      },
      params: {
        publickey: 'yNCkueSrUthmff4ZKzKUAwjJu'
      }
    });
    
    // Filter by event_id
    const eventGroupVisitors = response.data.result.filter(visitor => visitor.event_id === eventId);
    
    logger.info("Group visitors for event ${eventId}: ${eventGroupVisitors.length} visitors");
    
    res.json({
      success: true,
      event_id: eventId,
      data: eventGroupVisitors,
      count: eventGroupVisitors.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error("Error fetching group visitors:", error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/group-visitors/head/:groupId
 * Fetch head visitor for specific group
 */
router.get('/head/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    logger.info("Fetching head visitor for group: ${groupId}");
    
    const response = await axios.get('https://www.zohoapis.com/creator/custom/tsxcorp/getGroupVisitors', {
      headers: {
        'Content-Type': 'application/json'
      },
      params: {
        publickey: 'yNCkueSrUthmff4ZKzKUAwjJu'
      }
    });
    
    // Filter by group_id and head_mark = true
    const headVisitor = response.data.result.find(visitor => 
      visitor.group_id === groupId && visitor.head_mark === true
    );
    
    if (headVisitor) {
      logger.info("Head visitor found for group ${groupId}: ${headVisitor.full_name}");
      
      res.json({
        success: true,
        group_id: groupId,
        data: headVisitor,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.info("⚠️ No head visitor found for group ${groupId}");
      
      res.status(404).json({
        success: false,
        message: 'Head visitor not found for this group',
        group_id: groupId,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error("Error fetching head visitor:", error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
