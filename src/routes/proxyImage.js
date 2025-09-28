const express = require('express');
const axios = require('axios');
const sharp = require('sharp'); // Fast image processing
const router = express.Router();
const zohoOAuthService = require('../utils/zohoOAuthService');
const logger = require('../utils/logger');

// Enhanced proxy image endpoint with WebP conversion
router.get('/proxy-image', async (req, res) => {
  try {
    const { recordId, fieldName, filename, quality = 80, width, format = 'webp', directUrl } = req.query;
    
    // Support both direct URL and parameter-based URLs
    if (!directUrl && (!recordId || !fieldName || !filename)) {
      return res.status(400).json({ error: 'Missing required parameters: either directUrl or (recordId, fieldName, filename)' });
    }

    let downloadUrl;
    let token = null;
    
    if (directUrl) {
      // Use direct URL from Custom API
      // Handle double encoding from Next.js Image component
      let decodedUrl = decodeURIComponent(directUrl);
      // If still encoded, decode again (double encoding)
      if (decodedUrl.includes('%')) {
        decodedUrl = decodeURIComponent(decodedUrl);
      }
      downloadUrl = decodedUrl;
      logger.info(`🖼️ Enhanced proxy image request: Direct URL (${format}, quality: ${quality})`);
      logger.info(`Proxying direct image: ${downloadUrl}`);
    } else {
      // Build REST API URL
      logger.info(`🖼️ Enhanced proxy image request: ${recordId}/${fieldName}/${filename} (${format}, quality: ${quality})`);

      // Get valid OAuth token with timeout
      token = await Promise.race([
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
      
      downloadUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/API_Events/${recordId}/${fieldName}/download?filepath=${encodeURIComponent(filename)}`;
      
      logger.info(`Proxying image: ${downloadUrl}`);
    }

    // Fetch image from Zoho Creator as buffer (more reliable than stream)
    const requestConfig = {
      headers: {
        'User-Agent': 'NEXPO-Backend/1.0'
      },
      responseType: 'arraybuffer', // Use buffer instead of stream
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 0, // Prevent redirect issues
      maxContentLength: 20 * 1024 * 1024 // 20MB max image size
    };
    
    // Only add Authorization header for REST API URLs
    if (!directUrl) {
      requestConfig.headers['Authorization'] = `Zoho-oauthtoken ${token}`;
    }
    
    const response = await axios.get(downloadUrl, requestConfig);

    let processedBuffer = Buffer.from(response.data);
    const originalSize = processedBuffer.length;
    
            // Process image with Sharp for optimization
            try {
              const sharpInstance = sharp(processedBuffer);
              
              // Get image metadata first to check if format is supported
              const metadata = await sharpInstance.metadata();
              
              // Check if image format is supported by Sharp
              const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg', 'tiff', 'bmp', 'ico'];
              if (!metadata.format || !supportedFormats.includes(metadata.format.toLowerCase())) {
                logger.warn(`⚠️ Unsupported image format: ${metadata.format || 'unknown'}, using original`);
                // Keep original buffer for unsupported formats
              } else {
                logger.info(`📊 Original image: ${metadata.width}x${metadata.height}, ${metadata.format}, ${originalSize} bytes`);
                
                // Apply transformations
                if (width && parseInt(width) > 0) {
                  sharpInstance.resize(parseInt(width), null, {
                    withoutEnlargement: true, // Don't enlarge smaller images
                    fit: 'inside' // Maintain aspect ratio
                  });
                }
                
                // Convert to requested format with quality
                switch (format.toLowerCase()) {
                  case 'webp':
                    sharpInstance.webp({ 
                      quality: parseInt(quality),
                      effort: 6 // Higher effort = better compression
                    });
                    break;
                  case 'jpeg':
                  case 'jpg':
                    sharpInstance.jpeg({ 
                      quality: parseInt(quality),
                      progressive: true
                    });
                    break;
                  case 'png':
                    sharpInstance.png({ 
                      quality: parseInt(quality),
                      compressionLevel: 9
                    });
                    break;
                  case 'avif':
                    sharpInstance.avif({ 
                      quality: parseInt(quality)
                    });
                    break;
                  default:
                    // Keep original format if not specified
                    break;
                }
                
                processedBuffer = await sharpInstance.toBuffer();
                const processedSize = processedBuffer.length;
                const compressionRatio = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
                
                logger.info(`✅ Processed image: ${processedSize} bytes (${compressionRatio}% reduction)`);
              }
              
            } catch (sharpError) {
              logger.warn(`⚠️ Sharp processing failed, using original: ${sharpError.message}`);
              // Fallback to original image
            }

    // Set appropriate headers
    const contentType = format.toLowerCase() === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': processedBuffer.length,
      'Cache-Control': 'public, max-age=3600, immutable',
      'X-Image-Format': format,
      'X-Original-Size': originalSize,
      'X-Processed-Size': processedBuffer.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Send the processed image buffer
    res.send(processedBuffer);

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
