const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { fetchEventDetails } = require('../utils/zohoEventUtils');
const { fetchEventDetailsREST } = require('../utils/zohoEventUtilsREST');

/**
 * Convert direct Zoho URLs to proxy URLs for consistency
 */
const convertToProxyUrl = (url, recordId, fieldName) => {
  if (!url || typeof url !== 'string') return url;
  
  // If already a proxy URL, return as is
  if (url.includes('/api/proxy-image')) return url;
  
  // Extract filename from URL (handle both full Zoho URLs and relative URLs)
  let filename = null;
  
  // Try to extract from filepath parameter
  const filepathMatch = url.match(/filepath=([^&]+)/);
  if (filepathMatch) {
    filename = filepathMatch[1];
    // Decode URL encoding if present
    filename = decodeURIComponent(filename);
  } else {
    // For relative URLs like "/api/v2.1/...", extract the last part
    const pathParts = url.split('/');
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart;
        // Decode URL encoding if present
        filename = decodeURIComponent(filename);
      }
    }
  }
  
  
  if (!filename) return url;
  
  // Build proxy URL with WebP optimization
  let baseUrl = process.env.BACKEND_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
  
  // Ensure HTTPS protocol for production URLs
  if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  // Don't double encode - filename is already extracted from URL
  return `${baseUrl}/api/proxy-image?recordId=${recordId}&fieldName=${fieldName}&filename=${filename}&format=webp&quality=80`;
};

/**
 * Normalize image URLs in event data to use proxy URLs
 * Only applies to REST API responses, not Custom API (which already has direct URLs)
 */
const normalizeEventImages = (eventData, eventId, source) => {
  if (!eventData || !eventId) return eventData;
  
  // Custom API provides direct Zoho URLs but they need authentication
  // So we still use proxy URLs for better performance and WebP optimization
  // if (source === 'custom_api') {
  //   return eventData;
  // }
  
  // Handle single event mode
  if (eventData.event) {
    const event = eventData.event;
    
    // Convert all image fields to proxy URLs
    if (event.logo) event.logo = convertToProxyUrl(event.logo, eventId, 'Logo');
    if (event.banner) event.banner = convertToProxyUrl(event.banner, eventId, 'Banner');
    if (event.header) event.header = convertToProxyUrl(event.header, eventId, 'Header');
    if (event.footer) event.footer = convertToProxyUrl(event.footer, eventId, 'Footer');
    if (event.favicon) event.favicon = convertToProxyUrl(event.favicon, eventId, 'Favicon');
    if (event.floor_plan_pdf) event.floor_plan_pdf = convertToProxyUrl(event.floor_plan_pdf, eventId, 'Floor_Plan_PDF');
    
    // Convert exhibitor images
    if (event.exhibitors && Array.isArray(event.exhibitors)) {
      event.exhibitors = event.exhibitors.map(exhibitor => ({
        ...exhibitor,
        company_logo: exhibitor.company_logo ? convertToProxyUrl(exhibitor.company_logo, exhibitor.exhibitor_profile_id, 'Company_Logo') : exhibitor.company_logo,
        cover_image: exhibitor.cover_image ? convertToProxyUrl(exhibitor.cover_image, exhibitor.exhibitor_profile_id, 'Cover_Image') : exhibitor.cover_image
      }));
    }
  }
  
  // Handle list mode (multiple events)
  if (eventData.events && Array.isArray(eventData.events)) {
    eventData.events = eventData.events.map(event => ({
      ...event,
      logo: event.logo ? convertToProxyUrl(event.logo, event.id, 'Logo') : event.logo,
      banner: event.banner ? convertToProxyUrl(event.banner, event.id, 'Banner') : event.banner
    }));
  }
  
  // Handle direct events array (no wrapper object)
  if (Array.isArray(eventData) && eventData.length > 0 && eventData[0].id) {
    return eventData.map(event => ({
      ...event,
      logo: event.logo ? convertToProxyUrl(event.logo, event.id, 'Logo') : event.logo,
      banner: event.banner ? convertToProxyUrl(event.banner, event.id, 'Banner') : event.banner
    }));
  }
  
  return eventData;
};

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lấy thông tin sự kiện với automatic fallback và image optimization
 *     description: |
 *       **Unified API với conditional API selection:**
 *       
 *       **Frontend Mode** (`source=frontend`):
 *       1. **Primary**: REST API với WebP proxy images (tối ưu nhất)
 *       2. **Fallback**: Custom API với URL normalization (stable backup)
 *       
 *       **Insight/Admin Mode** (`source=insight` hoặc `source=admin`):
 *       1. **Primary**: Custom API cho stability (tốt nhất cho admin)
 *       2. **Fallback**: REST API với WebP optimization (backup)
 *       
 *       **Ưu điểm:**
 *       - ✅ Conditional API selection based on request source
 *       - ✅ WebP optimization cho tất cả images
 *       - ✅ Consistent proxy URLs (no Mixed Content)
 *       - ✅ Single endpoint cho tất cả clients
 *       - ✅ Optimal performance cho từng use case
 *       
 *       **Modes:**
 *       - **Single Event**: Truyền eventId cụ thể (ví dụ: "4433256000012332047")
 *       - **List All Events**: Truyền "NEXPO" để lấy danh sách tất cả events
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           ID của sự kiện trong Zoho Creator hoặc "NEXPO" để lấy tất cả events
 *         examples:
 *           single_event:
 *             summary: Single Event
 *             value: "4433256000012332047"
 *           all_events:
 *             summary: List All Events
 *             value: "NEXPO"
 *       - in: query
 *         name: source
 *         required: false
 *         schema:
 *           type: string
 *           enum: [frontend, insight, admin]
 *           default: frontend
 *         description: |
 *           Request source để chọn API strategy phù hợp
 *         examples:
 *           frontend:
 *             summary: Frontend (REST API priority)
 *             value: "frontend"
 *           insight:
 *             summary: Insight (Custom API priority)
 *             value: "insight"
 *           admin:
 *             summary: Admin (Custom API priority)
 *             value: "admin"
 *     responses:
 *       200:
 *         description: Dữ liệu sự kiện thành công với optimized images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   type: object
 *                   description: Thông tin chi tiết sự kiện
 *                 source:
 *                   type: string
 *                   description: Nguồn dữ liệu (rest_api hoặc custom_api)
 *                   example: "rest_api"
 *                 fallback_used:
 *                   type: boolean
 *                   description: Có sử dụng fallback không
 *                   example: false
 *                 performance:
 *                   type: object
 *                   properties:
 *                     api_used:
 *                       type: string
 *                       example: "rest_api"
 *                     fallback_triggered:
 *                       type: boolean
 *                       example: false
 *                     image_optimization:
 *                       type: string
 *                       example: "webp_proxy"
 *       400:
 *         description: Thiếu eventId parameter
 *       500:
 *         description: Cả REST API và Custom API đều lỗi
 */

router.get('/', async (req, res) => {
  const eventId = req.query.eventId;
  const requestSource = req.query.source || 'frontend'; // Default to frontend
  
  if (!eventId) {
    return res.status(400).json({
      success: false,
      error: 'Missing eventId parameter',
      message: 'eventId is required (use "NEXPO" for all events)'
    });
  }

  let result = null;
  let source = null;
  let fallbackUsed = false;
  let primaryError = null;

  try {
    logger.info(`🔍 Fetching event data for: ${eventId} (source: ${requestSource})`);

    // === CONDITIONAL API SELECTION BASED ON REQUEST SOURCE ===
    if (requestSource === 'insight' || requestSource === 'admin') {
      // === INSIGHT/ADMIN: Prefer Custom API for stability ===
      try {
        logger.info(`📡 Attempting Custom API for: ${eventId} (insight/admin mode)`);
        result = await fetchEventDetails(eventId);
        source = 'custom_api';
        logger.info(`✅ Custom API success for: ${eventId}`);
        
        // === NORMALIZE: Convert Custom API direct URLs to proxy URLs ===
        logger.info(`🖼️ Normalizing Custom API image URLs to proxy format`);
        result = normalizeEventImages(result, eventId, source);
        logger.info(`✅ Image URLs normalized for consistent WebP optimization`);
        
      } catch (customError) {
        primaryError = customError;
        logger.warn(`⚠️ Custom API failed for ${eventId}: ${customError.message}`);
        
        // === FALLBACK: Try REST API ===
        try {
          logger.info(`🔄 Falling back to REST API for: ${eventId}`);
          result = await fetchEventDetailsREST(eventId);
          source = 'rest_api';
          fallbackUsed = true;
          logger.info(`✅ REST API fallback success for: ${eventId}`);
          
        } catch (restError) {
          logger.error(`❌ Both Custom API and REST API failed for ${eventId}`);
          logger.error(`Custom API error: ${primaryError.message}`);
          logger.error(`REST API error: ${restError.message}`);
          
          return res.status(500).json({
            success: false,
            error: 'All APIs failed',
            message: 'Both Custom API and REST API are unavailable',
            details: {
              custom_api_error: primaryError.message,
              rest_api_error: restError.message
            },
            source: 'none',
            fallback_used: false
          });
        }
      }
    } else {
      // === FRONTEND: Prefer REST API for WebP optimization ===
      try {
        logger.info(`📡 Attempting REST API for: ${eventId} (frontend mode)`);
        result = await fetchEventDetailsREST(eventId);
        source = 'rest_api';
        logger.info(`✅ REST API success for: ${eventId}`);
        
      } catch (restError) {
        primaryError = restError;
        logger.warn(`⚠️ REST API failed for ${eventId}: ${restError.message}`);
        
        // === FALLBACK: Try Custom API ===
        try {
          logger.info(`🔄 Falling back to Custom API for: ${eventId}`);
          result = await fetchEventDetails(eventId);
          source = 'custom_api';
          fallbackUsed = true;
          logger.info(`✅ Custom API fallback success for: ${eventId}`);
          
          // === NORMALIZE: Convert Custom API direct URLs to proxy URLs ===
          logger.info(`🖼️ Normalizing Custom API image URLs to proxy format`);
          result = normalizeEventImages(result, eventId, source);
          logger.info(`✅ Image URLs normalized for consistent WebP optimization`);
          
        } catch (customError) {
          logger.error(`❌ Both REST API and Custom API failed for ${eventId}`);
          logger.error(`REST API error: ${primaryError.message}`);
          logger.error(`Custom API error: ${customError.message}`);
          
          return res.status(500).json({
            success: false,
            error: 'All APIs failed',
            message: 'Both REST API and Custom API are unavailable',
            details: {
              rest_api_error: primaryError.message,
              custom_api_error: customError.message
            },
            source: 'none',
            fallback_used: false
          });
        }
      }
    }
    
    // === NORMALIZE: Always normalize image URLs for consistency ===
    logger.info(`🖼️ Normalizing image URLs for consistent WebP optimization`);
    result = normalizeEventImages(result, eventId, source);
    logger.info(`✅ Image URLs normalized for consistent WebP optimization`);

    // Add metadata to response
    if (result && typeof result === 'object') {
      result.source = source;
      result.fallback_used = fallbackUsed;
      result.performance = {
        api_used: source,
        fallback_triggered: fallbackUsed,
        image_optimization: 'webp_proxy' // Always WebP proxy now
      };
    }

    logger.info(`🎉 Event data fetched successfully for ${eventId} via ${source}${fallbackUsed ? ' (fallback)' : ''}`);
    res.json(result);
    
  } catch (error) {
    logger.error(`❌ Unexpected error fetching event data for ${eventId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Unexpected server error',
      message: error.message,
      source: 'none',
      fallback_used: false
    });
  }
});

module.exports = router;