const express = require('express');
const axios = require('axios');
const router = express.Router();
const zohoOAuthService = require('../utils/zohoOAuthService');
const logger = require('../utils/logger');

// Proxy image endpoint to handle Zoho Creator images
router.get('/proxy-image', async (req, res) => {
  try {
    const { recordId, fieldName, filename } = req.query;
    
    if (!recordId || !fieldName || !filename) {
      return res.status(400).json({ error: 'Missing required parameters: recordId, fieldName, filename' });
    }

    logger.info(`🖼️ Proxy image request: ${recordId}/${fieldName}/${filename}`);

    // Get valid OAuth token with timeout
    const token = await Promise.race([
      zohoOAuthService.getValidAccessToken(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Token timeout')), 5000))
    ]);
    
    if (!token) {
      logger.error('❌ Failed to get valid OAuth token');
      return res.status(401).json({ error: 'Failed to get valid OAuth token' });
    }

    // Build Zoho Creator REST API download URL
    const ZOHO_BASE_URL = process.env.ZOHO_BASE_URL || 'https://www.zohoapis.com';
    const ZOHO_ORG_NAME = process.env.ZOHO_ORG_NAME;
    
    const downloadUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/API_Events/${recordId}/${fieldName}/download?filepath=${encodeURIComponent(filename)}`;
    
    logger.info(`Proxying image: ${downloadUrl}`);

    // Fetch image from Zoho Creator as buffer (more reliable than stream)
    const response = await axios.get(downloadUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'User-Agent': 'NEXPO-Backend/1.0'
      },
      responseType: 'arraybuffer', // Use buffer instead of stream
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 0, // Prevent redirect issues
      maxContentLength: 10 * 1024 * 1024 // 10MB max image size
    });

    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Content-Length': response.data.length,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Send the image buffer
    res.send(Buffer.from(response.data));

  } catch (error) {
    logger.error(`Error proxying image:`, error.message);
    
    if (error.response) {
      // Zoho API error
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      
      if (status === 401) {
        return res.status(401).json({ error: 'Unauthorized - invalid or expired token' });
      } else if (status === 404) {
        return res.status(404).json({ error: 'Image not found' });
      } else {
        return res.status(status).json({ error: `Zoho API error: ${message}` });
      }
    } else if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timeout' });
    } else {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;
