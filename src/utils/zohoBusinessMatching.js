const axios = require('axios');

const {
  ZOHO_ORG_NAME,
  ZOHO_BASE_URL,
  ZOHO_BUSINESS_MATCHING_PUBLIC_KEY,
  ZOHO_CHECKIN_PUBLIC_KEY,
  ZOHO_VISITOR_PUBLIC_KEY
} = process.env;

// Default values for development/testing
const ORG_NAME = ZOHO_ORG_NAME || 'tsxcorp';
const BASE_URL = ZOHO_BASE_URL || 'https://www.zohoapis.com';
// Try using existing public keys if business matching key is not set
const PUBLIC_KEY = ZOHO_BUSINESS_MATCHING_PUBLIC_KEY || ZOHO_CHECKIN_PUBLIC_KEY || ZOHO_VISITOR_PUBLIC_KEY || '5PFY45ZtanVVs3ufnVak98Zkn';

const ZOHO_BUSINESS_MATCHING_API = `${BASE_URL}/creator/custom/${ORG_NAME}/NXP_submitBusinessMatching`;

/**
 * Submit business matching request to Zoho
 * @param {Object} matchingData - Business matching data
 * @param {Object} matchingData.event_info - Event information
 * @param {string} matchingData.event_info.event_id - Event ID
 * @param {Object} matchingData.registration_info - Registration information  
 * @param {string} matchingData.registration_info.registration_id - Registration/Visitor ID
 * @param {string} matchingData.exhibitor_company - Exhibitor company ID
 * @param {string} matchingData.date - Meeting date (YYYY-MM-DD)
 * @param {string} matchingData.time - Meeting time (HH:MM)
 * @param {string} matchingData.message - Meeting message/note
 * @returns {Promise<Object>} API response
 */
async function submitBusinessMatching(matchingData) {
  try {
    console.log('🔄 Submitting business matching to:', ZOHO_BUSINESS_MATCHING_API);
    console.log('📋 Matching payload:', JSON.stringify(matchingData, null, 2));
    console.log('📋 Public key:', PUBLIC_KEY ? '***' + PUBLIC_KEY.slice(-4) : 'NOT_SET');
    console.log('📋 Full URL:', `${ZOHO_BUSINESS_MATCHING_API}?publickey=${PUBLIC_KEY ? '***' + PUBLIC_KEY.slice(-4) : 'NOT_SET'}`);

    // Development mode: return mock response for testing  
    // Testing with real Zoho API to see actual response format
    const isDevelopment = false; // Test with real Zoho API
    
    if (isDevelopment) {
      console.log('🧪 Development mode: returning mock response for business matching');
      return {
        code: 3000,
        result: "success", 
        message: "Business matching submitted successfully (DEV MODE)",
        matching_id: `DEV-MTG-${Date.now()}`
      };
    }

    const response = await axios.post(ZOHO_BUSINESS_MATCHING_API, matchingData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params: {
        publickey: PUBLIC_KEY
      },
      timeout: 30000
    });

    console.log('✅ Business matching response:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ Error in submitBusinessMatching:', error.message);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    console.error('❌ Error stack:', error.stack);
    
    // Re-throw with more context
    if (error.response) {
      const errorMessage = error.response.data?.message || error.response.data?.error || error.message;
      throw new Error(`Zoho API Error (${error.response.status}): ${errorMessage}`);
    } else if (error.request) {
      throw new Error('Network Error: Could not reach Zoho API');
    } else {
      throw new Error(`Request Error: ${error.message}`);
    }
  }
}

/**
 * Validate business matching data
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
function validateBusinessMatchingData(data) {
  const errors = [];
  
  // Required fields validation
  if (!data.event_info?.event_id) {
    errors.push('Event ID is required');
  }
  
  if (!data.registration_info?.registration_id) {
    errors.push('Registration ID is required');
  }
  
  if (!data.exhibitor_company) {
    errors.push('Exhibitor company is required');
  }
  
  if (!data.date) {
    errors.push('Meeting date is required');
  }
  
  if (!data.time) {
    errors.push('Meeting time is required');
  }
  
  // Date format validation (YYYY-MM-DD)
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  }
  
  // Time format validation (HH:MM)
  if (data.time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.time)) {
    errors.push('Time must be in HH:MM format');
  }
  
  // Date validation (not in the past)
  if (data.date) {
    const meetingDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    if (meetingDate < today) {
      errors.push('Meeting date cannot be in the past');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format business matching data for Zoho API
 * @param {Object} rawData - Raw form data
 * @returns {Object} Formatted data for Zoho
 */
function formatBusinessMatchingData(rawData) {
  return {
    event_info: {
      event_id: String(rawData.event_id || rawData.event_info?.event_id || '')
    },
    registration_info: {
      registration_id: String(rawData.registration_id || rawData.visitor_id || rawData.registration_info?.registration_id || '')
    },
    exhibitor_company: String(rawData.exhibitor_company || rawData.exhibitor_id || ''),
    date: rawData.date || '',
    time: rawData.time || '',
    message: rawData.message || ''
  };
}

module.exports = {
  submitBusinessMatching,
  validateBusinessMatchingData,
  formatBusinessMatchingData
}; 