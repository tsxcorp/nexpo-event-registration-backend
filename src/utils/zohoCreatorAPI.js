const axios = require('axios');
const logger = require('./logger');
const zohoOAuthService = require('./zohoOAuthService');
const redisService = require('../services/redisService');
const socketService = require('../services/socketService');

/**
 * Zoho Creator REST API Service
 * Provides methods to interact with Zoho Creator using REST APIs
 */
class ZohoCreatorAPI {
  constructor() {
    this.config = {
      accountOwnerName: 'tsxcorp',
      appLinkName: 'nxp',
      baseUrl: 'https://creator.zoho.com/api/v2'
    };
  }

  /**
   * Make authenticated request to Zoho Creator API with automatic token refresh
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} params - Query parameters
   * @returns {Object} API response
   */
  async makeRequest(method, endpoint, data = null, params = {}, customHeaders = {}) {
    return await zohoOAuthService.executeWithTokenRefresh(async (accessToken) => {
      const url = `${this.config.baseUrl}/${this.config.accountOwnerName}/${this.config.appLinkName}/${endpoint}`;
      
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          ...customHeaders // Merge custom headers for v2.1 features
        },
        params
      };

      if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put' || method.toLowerCase() === 'patch')) {
        config.data = data;
      }

      logger.info(`📡 Making ${method.toUpperCase()} request to:`, url);
      logger.info('📋 Params:', params);
      
      const response = await axios(config);
      
      logger.info("API request successful");
      return response.data;
    });
  }

  /**
   * Get records from a report with Redis caching
   * @param {string} reportLinkName - Report link name
   * @param {Object} options - Query options (from, limit, criteria, sortBy, sortOrder, useCache)
   * @returns {Object} Report data
   */
  async getReportRecords(reportLinkName, options = {}) {
    const {
      from = 1,
      limit = 200,
      max_records = 1000, // v2.1 supports up to 1000, but we can use higher for pagination
      criteria = null,
      sortBy = null,
      sortOrder = 'asc',
      useCache = true,
      record_cursor = null, // v2.1 pagination cursor
      field_config = 'quick_view', // v2.1 field configuration
      fetchAll = false // Helper to fetch all records across pages
    } = options;

    // Use v2.1 parameters
    const params = {
      max_records
    };

    if (criteria) {
      params.criteria = criteria;
    }

    if (field_config) {
      params.field_config = field_config;
    }

    // v2.1: sortBy causes errors, so we'll comment it out
    // if (sortBy) {
    //   params.sortBy = sortBy;
    //   params.sortOrder = sortOrder;
    // }

    // Try to get from cache first
    let cached = null;
    if (useCache && redisService.isReady()) {
      cached = await redisService.getCachedZohoData(reportLinkName, params);
      if (cached) {
        logger.info(`Returning cached data for report: ${reportLinkName}`);
        return {
          ...cached.data,
          metadata: {
            ...(cached.data.metadata || {}),
            cached: true,
            cached_at: cached.cached_at
          }
        };
      }
    }

    logger.info(`Getting records from report: ${reportLinkName} (max_records: ${max_records})`);

    // Set up headers for v2.1 API
    const headers = {};
    if (record_cursor) {
      headers.record_cursor = record_cursor;
      logger.info(`Using pagination cursor: ${record_cursor}`);
    }

    let allData = [];
    let hasMore = true;
    let currentCursor = record_cursor;
    let totalFetched = 0;

    // If fetchAll is true, automatically paginate through all records
    if (fetchAll) {
      logger.info(`Fetching ALL records from ${reportLinkName}...`);
      
      while (hasMore && totalFetched < 200000) { // Very high safety limit for extremely large datasets
        try {
          // Build direct axios config to properly capture response headers
          const config = {
            method: 'GET',
            url: `https://www.zohoapis.com/creator/v2.1/data/tsxcorp/nxp/report/${reportLinkName}`,
            headers: {
              'Authorization': `Zoho-oauthtoken ${zohoOAuthService.tokenStore.accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            params
          };
          
          // Add cursor header if we have one
          if (currentCursor) {
            config.headers.record_cursor = currentCursor;
            logger.info(`Using cursor: ${currentCursor.substring(0, 20)}...`);
          }
          
          const response = await axios(config);
          
          if (response.data?.data && response.data.data.length > 0) {
            allData.push(...response.data.data);
            totalFetched += response.data.data.length;
            logger.info(`Fetched batch: ${response.data.data.length} records (total: ${totalFetched})`);
            
            // Check for next cursor in response headers
            currentCursor = response.headers?.record_cursor || response.headers?.['record_cursor'];
            hasMore = !!currentCursor; // Continue as long as there's a cursor, regardless of batch size
            
            if (currentCursor) {
              logger.info(`Next cursor found: ${currentCursor.substring(0, 20)}..., continuing`);
            } else {
              logger.info("No more cursor, pagination complete");
            }
          } else {
            logger.info(`📄 No more data returned, stopping pagination`);
            hasMore = false;
          }
        } catch (error) {
          logger.error("Error fetching batch at cursor ${currentCursor}:", error.message);
          logger.error("Full error:", error.response?.data || error);
          hasMore = false;
        }
      }

      logger.info(`Total records fetched: ${totalFetched}`);
    } else {
      // Single request
      const response = await this.makeRequest('GET', `report/${reportLinkName}`, null, params, headers);
      allData = response.data || [];
      currentCursor = response.headers?.record_cursor;
    }

    const result = {
      success: true,
      data: allData,
      count: allData.length,
      metadata: {
        max_records,
        total: allData.length,
        reportName: reportLinkName,
        cached: false,
        next_cursor: currentCursor,
        has_more: fetchAll ? false : !!currentCursor,
        api_version: 'v2.1'
      }
    };

    // Cache the result
    if (useCache && redisService.isReady()) {
      await redisService.cacheZohoData(reportLinkName, params, result, 300); // 5 minutes TTL
    }

    // Push real-time update
    const eventId = this.extractEventIdFromCriteria(criteria);
    if (socketService.io) {
      await socketService.pushRegistrationData(eventId, result.data, 'data_refresh');
    }

    return result;
  }

  /**
   * Get specific record by ID
   * @param {string} reportLinkName - Report link name
   * @param {string} recordId - Record ID
   * @returns {Object} Record data
   */
  async getRecord(reportLinkName, recordId) {
    logger.info(`📋 Getting record ${recordId} from report: ${reportLinkName}`);
    
    const response = await this.makeRequest('GET', `report/${reportLinkName}/${recordId}`);
    
    return {
      success: true,
      data: response.data,
      recordId
    };
  }

  /**
   * Create new record in a form
   * @param {string} formLinkName - Form link name
   * @param {Object} recordData - Record data to create
   * @returns {Object} Created record response
   */
  async createRecord(formLinkName, recordData) {
    logger.info(`Creating record in form: ${formLinkName}`);
    
    const response = await this.makeRequest('POST', `form/${formLinkName}`, {
      data: recordData
    });
    
    return {
      success: true,
      data: response.data,
      recordId: response.data?.ID,
      formName: formLinkName
    };
  }

  /**
   * Update existing record
   * @param {string} reportLinkName - Report link name
   * @param {string} recordId - Record ID to update
   * @param {Object} updateData - Data to update
   * @returns {Object} Update response
   */
  async updateRecord(reportLinkName, recordId, updateData) {
    logger.info("✏️ Updating record ${recordId} in report: ${reportLinkName}");
    
    const response = await this.makeRequest('PATCH', `report/${reportLinkName}/${recordId}`, {
      data: updateData
    });
    
    return {
      success: true,
      data: response.data,
      recordId,
      updated: true
    };
  }

  /**
   * Delete record
   * @param {string} reportLinkName - Report link name
   * @param {string} recordId - Record ID to delete
   * @returns {Object} Delete response
   */
  async deleteRecord(reportLinkName, recordId) {
    logger.info(`🗑️ Deleting record ${recordId} from report: ${reportLinkName}`);
    
    await this.makeRequest('DELETE', `report/${reportLinkName}/${recordId}`);
    
    return {
      success: true,
      recordId,
      deleted: true
    };
  }

  /**
   * Get form metadata
   * @param {string} formLinkName - Form link name
   * @returns {Object} Form metadata
   */
  async getFormMetadata(formLinkName) {
    logger.info(`📋 Getting metadata for form: ${formLinkName}`);
    
    const response = await this.makeRequest('GET', `meta/form/${formLinkName}`);
    
    return {
      success: true,
      data: response,
      formName: formLinkName
    };
  }

  /**
   * Search records with criteria
   * @param {string} reportLinkName - Report link name
   * @param {string} searchCriteria - Search criteria
   * @param {Object} options - Additional options
   * @returns {Object} Search results
   */
  async searchRecords(reportLinkName, searchCriteria, options = {}) {
    const {
      from = 1,
      limit = 50,
      sortBy = null,
      sortOrder = 'asc'
    } = options;

    logger.info(`Searching records in report: ${reportLinkName}`);
    logger.info("Search criteria:", searchCriteria);
    
    return await this.getReportRecords(reportLinkName, {
      from,
      limit,
      criteria: searchCriteria,
      sortBy,
      sortOrder
    });
  }

  /**
   * Bulk operations helper
   * @param {string} operation - Operation type (create, update, delete)
   * @param {string} targetName - Form/Report link name
   * @param {Array} records - Array of records to process
   * @returns {Object} Bulk operation results
   */
  async bulkOperation(operation, targetName, records) {
    logger.info(`Performing bulk ${operation} operation on ${records.length} records`);
    
    const results = {
      success: [],
      failed: [],
      total: records.length
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        let result;
        switch (operation) {
          case 'create':
            result = await this.createRecord(targetName, record);
            break;
          case 'update':
            result = await this.updateRecord(targetName, record.id, record.data);
            break;
          case 'delete':
            result = await this.deleteRecord(targetName, record.id);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        results.success.push({ index: i, record, result });
      } catch (error) {
        results.failed.push({ index: i, record, error: error.message });
      }
    }

    logger.info(`Bulk operation completed: ${results.success.length} success, ${results.failed.length} failed`);
    
    return {
      success: true,
      results,
      summary: {
        total: results.total,
        successful: results.success.length,
        failed: results.failed.length,
        successRate: `${((results.success.length / results.total) * 100).toFixed(1)}%`
      }
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Extract event ID from search criteria
   * @param {string} criteria - Search criteria string
   * @returns {string|null} Event ID or null
   */
  extractEventIdFromCriteria(criteria) {
    if (!criteria) return null;
    
    // Look for patterns like Event_Info = "eventId" or Event_Info.ID = "eventId"
    const patterns = [
      /Event_Info\.ID\s*=\s*"([^"]+)"/,
      /Event_Info\s*=\s*"([^"]+)"/,
      /event_id\s*=\s*"([^"]+)"/i
    ];
    
    for (const pattern of patterns) {
      const match = criteria.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Clear cache for specific report/filters
   * @param {string} reportLinkName - Report name
   * @param {Object} filters - Filter parameters
   */
  async clearCache(reportLinkName, filters = {}) {
    if (!redisService.isReady()) return false;
    
    const cacheKey = redisService.generateZohoCacheKey(reportLinkName, filters);
    return await redisService.del(cacheKey);
  }

  /**
   * Force refresh data (skip cache)
   * @param {string} reportLinkName - Report name
   * @param {Object} options - Query options
   */
  async forceRefresh(reportLinkName, options = {}) {
    return await this.getReportRecords(reportLinkName, { ...options, useCache: false });
  }
}

// Export singleton instance
const zohoCreatorAPI = new ZohoCreatorAPI();
module.exports = zohoCreatorAPI;
