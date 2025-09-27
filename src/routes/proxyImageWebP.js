const express = require('express');
const axios = require('axios');
const sharp = require('sharp'); // Fast image processing
const router = express.Router();
const zohoOAuthService = require('../utils/zohoOAuthService');
const logger = require('../utils/logger');

/**
 * Enhanced Proxy Image Endpoint with WebP Conversion
 * 
 * Features:
 * - WebP conversion for better performance
 * - Quality optimization
 * - Resize on-the-fly
 * - Caching headers
 * - Fallback to original format
 */

// Cache for processed images (in-memory)
const imageCache = new Map();
const CACHE_MAX_SIZE = 100; // Max 100 images in cache
const CACHE_TTL = 3600000; // 1 hour

// Clean up cache periodically
setInterval(() => {
  if (imageCache.size > CACHE_MAX_SIZE) {
    const oldestKey = imageCache.keys().next().value;
    imageCache.delete(oldestKey);
  }
}, 300000); // Clean every 5 minutes

router.get('/proxy-image-webp', async (req, res) => {
  try {
    const { recordId, fieldName, filename, quality = 80, width, format = 'webp' } = req.query;
    
    if (!recordId || !fieldName || !filename) {
      return res.status(400).json({ error: 'Missing required parameters: recordId, fieldName, filename' });
    }

    // Create cache key
    const cacheKey = `${recordId}-${fieldName}-${filename}-${quality}-${width}-${format}`;
    
    // Check cache first
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info(`📦 Serving from cache: ${cacheKey}`);
        
        res.set({
          'Content-Type': `image/${format}`,
          'Content-Length': cached.buffer.length,
          'Cache-Control': 'public, max-age=3600',
          'X-Image-Cache': 'HIT',
          'X-Image-Format': format,
          'Access-Control-Allow-Origin': '*'
        });
        
        return res.send(cached.buffer);
      } else {
        imageCache.delete(cacheKey);
      }
    }

    logger.info(`🖼️ Processing image: ${recordId}/${fieldName}/${filename} (${format}, quality: ${quality})`);

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
    
    if (!ZOHO_ORG_NAME) {
      return res.status(500).json({ error: 'ZOHO_ORG_NAME not configured' });
    }
    
    const downloadUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/API_Events/${recordId}/${fieldName}/download?filepath=${encodeURIComponent(filename)}`;
    
    logger.info(`📥 Fetching image from Zoho: ${downloadUrl}`);

    // Fetch image from Zoho Creator as buffer
    const response = await axios.get(downloadUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'User-Agent': 'NEXPO-Backend/1.0'
      },
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 0,
      maxContentLength: 20 * 1024 * 1024 // 20MB max image size
    });

    let processedBuffer = Buffer.from(response.data);
    const originalSize = processedBuffer.length;
    
    // Process image with Sharp
    try {
      const sharpInstance = sharp(processedBuffer);
      
      // Get image metadata
      const metadata = await sharpInstance.metadata();
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
          // Keep original format
          break;
      }
      
      processedBuffer = await sharpInstance.toBuffer();
      const processedSize = processedBuffer.length;
      const compressionRatio = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
      
      logger.info(`✅ Processed image: ${processedSize} bytes (${compressionRatio}% reduction)`);
      
    } catch (sharpError) {
      logger.warn(`⚠️ Sharp processing failed, using original: ${sharpError.message}`);
      // Fallback to original image
    }

    // Cache the processed image
    imageCache.set(cacheKey, {
      buffer: processedBuffer,
      timestamp: Date.now()
    });

    // Set appropriate headers
    const contentType = format.toLowerCase() === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': processedBuffer.length,
      'Cache-Control': 'public, max-age=3600, immutable',
      'X-Image-Cache': 'MISS',
      'X-Image-Format': format,
      'X-Original-Size': originalSize,
      'X-Processed-Size': processedBuffer.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.send(processedBuffer);

  } catch (error) {
    logger.error(`❌ Error processing image:`, error.message);
    
    if (res.headersSent) {
      logger.error('Headers already sent, cannot send error response');
      return;
    }
    
    if (error.response) {
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

// Health check endpoint
router.get('/proxy-image-webp/health', (req, res) => {
  res.json({
    status: 'healthy',
    cache: {
      size: imageCache.size,
      maxSize: CACHE_MAX_SIZE
    },
    supportedFormats: ['webp', 'jpeg', 'png', 'avif'],
    features: [
      'WebP conversion',
      'Quality optimization', 
      'Resize on-the-fly',
      'In-memory caching',
      'Compression statistics'
    ]
  });
});

module.exports = router;
