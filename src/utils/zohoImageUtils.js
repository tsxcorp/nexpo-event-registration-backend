const {
  ZOHO_ORG_NAME,
  ZOHO_APP_NAME,
  ZOHO_PRIVATELINK_ALL_EVENTS,
  ZOHO_PRIVATELINK_GALLERY,
  ZOHO_PRIVATELINK_EXHIBITOR_PROFILES,
  ZOHO_PRIVATELINK_SESSIONS
} = process.env;

// 🔍 Debug: Check environment variables for image utilities
console.log('🖼️ Zoho Image Utils Environment Variables:');
console.log('  ZOHO_ORG_NAME:', ZOHO_ORG_NAME ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_APP_NAME:', ZOHO_APP_NAME ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_PRIVATELINK_ALL_EVENTS:', ZOHO_PRIVATELINK_ALL_EVENTS ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_PRIVATELINK_GALLERY:', ZOHO_PRIVATELINK_GALLERY ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_PRIVATELINK_EXHIBITOR_PROFILES:', ZOHO_PRIVATELINK_EXHIBITOR_PROFILES ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_PRIVATELINK_SESSIONS:', ZOHO_PRIVATELINK_SESSIONS ? '✅ Set' : '❌ Missing');

/**
 * 🎯 Universal Zoho Image URL Builder
 * 
 * This utility function generates public URLs for images stored in Zoho Creator
 * across different table types with proper authentication via private links.
 * 
 * @param {Object} config - Image configuration object
 * @param {string} config.type - Image type: 'event', 'gallery', 'exhibitor', 'session'
 * @param {string} config.recordId - Record ID from Zoho (for event, exhibitor, session)
 * @param {string} config.fieldName - Field name in Zoho table (Banner, Logo, Company_Logo, etc.)
 * @param {string} config.filePath - File path/name of the image
 * @param {string} [config.galleryId] - Gallery ID (required for gallery type only)
 * 
 * @returns {string} Complete public image URL with authentication
 * 
 * @example
 * // Event image
 * getZohoImageUrl({ 
 *   type: 'event', 
 *   recordId: '4433256000012345678', 
 *   fieldName: 'Banner', 
 *   filePath: 'event-banner.jpg' 
 * });
 * 
 * @example
 * // Gallery image
 * getZohoImageUrl({ 
 *   type: 'gallery', 
 *   galleryId: '4433256000012345679', 
 *   filePath: 'gallery-image.jpg' 
 * });
 * 
 * @example
 * // Exhibitor logo
 * getZohoImageUrl({ 
 *   type: 'exhibitor', 
 *   recordId: '4433256000012345680', 
 *   fieldName: 'Company_Logo', 
 *   filePath: 'company-logo.png' 
 * });
 */
const getZohoImageUrl = ({ type, recordId, fieldName, filePath, galleryId }) => {
  if (!filePath) return "";
  
  const config = {
    event: {
      table: 'All_Events',
      privatelink: ZOHO_PRIVATELINK_ALL_EVENTS,
      urlPattern: (id, field) => `${id}/${field}`,
      description: 'Event images (banner, logo, header, footer, favicon)'
    },
    gallery: {
      table: 'All_Event_Libraries', 
      privatelink: ZOHO_PRIVATELINK_GALLERY,
      urlPattern: (id) => `${id}/Upload_Image`,
      requiresGalleryId: true,
      description: 'Event gallery images'
    },
    exhibitor: {
      table: 'All_Exhibitor_Profiles',
      privatelink: ZOHO_PRIVATELINK_EXHIBITOR_PROFILES,
      urlPattern: (id, field) => `${id}/${field}`,
      description: 'Exhibitor images (company logo, cover image)'
    },
    session: {
      table: 'All_Sessions',
      privatelink: ZOHO_PRIVATELINK_SESSIONS,
      urlPattern: (id, field) => `${id}/${field}`,
      description: 'Session images (banner)',
      validation: () => {
        if (!ZOHO_PRIVATELINK_SESSIONS) {
          console.warn(`⚠️ ZOHO_PRIVATELINK_SESSIONS is not defined. Session banner URL cannot be generated.`);
          return false;
        }
        return true;
      }
    }
  };
  
  const imageConfig = config[type];
  if (!imageConfig) {
    const validTypes = Object.keys(config).join(', ');
    throw new Error(`Unknown image type: "${type}". Valid types: ${validTypes}`);
  }
  
  // Type-specific validation
  if (imageConfig.validation && !imageConfig.validation()) {
    return "";
  }
  
  if (imageConfig.requiresGalleryId && !galleryId) {
    throw new Error(`Gallery ID is required for type: "${type}". Please provide galleryId parameter.`);
  }
  
  if (!imageConfig.requiresGalleryId && !recordId) {
    throw new Error(`Record ID is required for type: "${type}". Please provide recordId parameter.`);
  }
  
  const pathSegment = imageConfig.urlPattern(
    galleryId || recordId, 
    fieldName
  );
  
  const baseUrl = `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/${imageConfig.table}/${pathSegment}/image-download/${imageConfig.privatelink}`;
  
  return `${baseUrl}?filepath=/${filePath.trim()}`;
};

/**
 * 🎨 Helper function for event images
 * @param {string} recordId - Event record ID
 * @param {string} fieldName - Field name (Banner, Logo, Header, Footer, Favicon)
 * @param {string} filePath - Image file path
 * @returns {string} Event image URL
 */
const getEventImageUrl = (recordId, fieldName, filePath) => {
  return getZohoImageUrl({ type: 'event', recordId, fieldName, filePath });
};

/**
 * 🖼️ Helper function for gallery images
 * @param {string} galleryId - Gallery ID
 * @param {string} filePath - Image file path
 * @returns {string} Gallery image URL
 */
const getGalleryImageUrl = (galleryId, filePath) => {
  return getZohoImageUrl({ type: 'gallery', galleryId, filePath });
};

/**
 * 🏢 Helper function for exhibitor images
 * @param {string} recordId - Exhibitor record ID
 * @param {string} fieldName - Field name (Company_Logo, Cover_Image)
 * @param {string} filePath - Image file path
 * @returns {string} Exhibitor image URL
 */
const getExhibitorImageUrl = (recordId, fieldName, filePath) => {
  return getZohoImageUrl({ type: 'exhibitor', recordId, fieldName, filePath });
};

/**
 * 📅 Helper function for session images
 * @param {string} recordId - Session record ID
 * @param {string} fieldName - Field name (Banner)
 * @param {string} filePath - Image file path
 * @returns {string} Session image URL
 */
const getSessionImageUrl = (recordId, fieldName, filePath) => {
  return getZohoImageUrl({ type: 'session', recordId, fieldName, filePath });
};

/**
 * 📋 Get available image types and their descriptions
 * @returns {Object} Available image types with descriptions
 */
const getAvailableImageTypes = () => {
  return {
    event: 'Event images (banner, logo, header, footer, favicon)',
    gallery: 'Event gallery images',
    exhibitor: 'Exhibitor images (company logo, cover image)',
    session: 'Session images (banner)'
  };
};

module.exports = {
  // Main unified function
  getZohoImageUrl,
  
  // Helper functions for specific use cases
  getEventImageUrl,
  getGalleryImageUrl,
  getExhibitorImageUrl,
  getSessionImageUrl,
  
  // Utility function
  getAvailableImageTypes
};
