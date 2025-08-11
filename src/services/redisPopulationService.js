const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
const redisService = require('./redisService');
const socketService = require('./socketService');

/**
 * Redis Population Service
 * Manages Redis cache population and updates to minimize Zoho API calls
 */
class RedisPopulationService {
  constructor() {
    this.cacheKeys = {
      allRegistrations: 'zoho:all_registrations',
      eventIndex: 'zoho:event_index',
      cacheTimestamp: 'zoho:cache_timestamp',
      cacheVersion: 'zoho:cache_version'
    };
    
    // Smart TTL strategy - different for different data types
    this.cacheTTL = {
      // High-frequency data
      eventData: 900,        // 15 minutes
      statistics: 300,       // 5 minutes
      
      // Medium-frequency data  
      allRegistrations: 1800, // 30 minutes
      eventIndex: 1800,       // 30 minutes
      
      // Low-frequency data
      metadata: 3600,         // 1 hour
      configuration: 7200     // 2 hours
    };
    
    // Default TTL for backward compatibility
    this.defaultTTL = 1800; // 30 minutes
  }

  /**
   * Populate Redis cache from Zoho Creator API
   */
  async populateFromZoho() {
    try {
      console.log('🔄 Initial Redis population from Zoho...');
      
      // Fetch ALL data từ Zoho (1 lần duy nhất)
      const allRegistrations = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        max_records: 1000,
        fetchAll: true,
        useCache: false
      });
      
      console.log(`📦 Fetched ${allRegistrations.data.length} records from Zoho`);
      
      // Store vào Redis với smart TTL
      await redisService.set(this.cacheKeys.allRegistrations, allRegistrations.data, this.cacheTTL.allRegistrations);
      
      // Index theo event_id để query nhanh
      const eventIndex = {};
      allRegistrations.data.forEach(record => {
        if (record.Event_Info && record.Event_Info.ID) {
          const eventId = record.Event_Info.ID;
          if (!eventIndex[eventId]) {
            eventIndex[eventId] = [];
          }
          eventIndex[eventId].push(record);
        }
      });
      
      // Store event index với smart TTL
      await redisService.set(this.cacheKeys.eventIndex, eventIndex, this.cacheTTL.eventIndex);
      
      // Store cache metadata với longer TTL
      await redisService.set(this.cacheKeys.cacheTimestamp, Date.now(), this.cacheTTL.metadata);
      await redisService.set(this.cacheKeys.cacheVersion, Date.now(), this.cacheTTL.metadata);
      
      console.log('✅ Redis populated with', allRegistrations.data.length, 'records');
      console.log('📊 Event index created for', Object.keys(eventIndex).length, 'events');
      
      // Push real-time update to all connected clients
      await this.broadcastCacheUpdate('cache_refreshed', {
        total_records: allRegistrations.data.length,
        total_events: Object.keys(eventIndex).length,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        total_records: allRegistrations.data.length,
        total_events: Object.keys(eventIndex).length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Redis population error:', error);
      throw error;
    }
  }

  /**
   * Update Redis cache with new registration
   */
  async updateCache(newRecord) {
    try {
      console.log('🔄 Updating Redis cache with new registration...');
      
      // Get current cache
      const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex) || {};
      
      // Add new record
      allRecords.push(newRecord);
      
      // Update event index
      if (newRecord.Event_Info && newRecord.Event_Info.ID) {
        const eventId = newRecord.Event_Info.ID;
        if (!eventIndex[eventId]) {
          eventIndex[eventId] = [];
        }
        eventIndex[eventId].push(newRecord);
      }
      
      // Update Redis with smart TTL
      await redisService.set(this.cacheKeys.allRegistrations, allRecords, this.cacheTTL.allRegistrations);
      await redisService.set(this.cacheKeys.eventIndex, eventIndex, this.cacheTTL.eventIndex);
      await redisService.set(this.cacheKeys.cacheTimestamp, Date.now(), this.cacheTTL.metadata);
      
      console.log('✅ Redis cache updated with new registration');
      
      // Push real-time update for specific event
      if (newRecord.Event_Info && newRecord.Event_Info.ID) {
        const eventId = newRecord.Event_Info.ID;
        await socketService.pushRegistrationData(eventId, [newRecord], 'new_registration');
      }
      
      return {
        success: true,
        total_records: allRecords.length,
        event_id: newRecord.Event_Info?.ID
      };
      
    } catch (error) {
      console.error('❌ Cache update error:', error);
      throw error;
    }
  }

  /**
   * Get event registrations from Redis cache
   */
  async getEventRegistrations(eventId, filters = {}) {
    try {
      console.log(`🎯 Getting event registrations from Redis cache: ${eventId}`);
      
      // Get from Redis cache (NO Zoho API call)
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex);
      
      if (!eventIndex || !eventIndex[eventId]) {
        console.log(`📭 No data found for event: ${eventId}`);
        return {
          success: true,
          data: [],
          count: 0,
          stats: { total_for_event: 0, checked_in: 0, not_yet: 0, group_registrations: 0 },
          metadata: { method: 'redis_cache', cached: true, source: 'redis' }
        };
      }
      
      // Get event data
      let filteredData = eventIndex[eventId];
      
      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        filteredData = filteredData.filter(record => {
          const isCheckedIn = record.Check_In_Status === 'Checked In';
          if (filters.status === 'checked_in') return isCheckedIn;
          if (filters.status === 'not_yet') return !isCheckedIn;
          return true;
        });
      }
      
      // Apply group registration filter
      if (filters.group_only === 'true' || filters.group_only === true) {
        filteredData = filteredData.filter(record => {
          return record.Group_Registration === 'true';
        });
      }
      
      // Apply limit
      const limit = parseInt(filters.limit) || 5000;
      const limitedResults = filteredData.slice(0, limit);
      
      // Calculate statistics
      const stats = {
        total_for_event: eventIndex[eventId].length,
        checked_in: eventIndex[eventId].filter(r => r.Check_In_Status === 'Checked In').length,
        not_yet: eventIndex[eventId].filter(r => r.Check_In_Status === 'Not Yet').length,
        group_registrations: eventIndex[eventId].filter(r => r.Group_Registration === 'true').length,
        returned: limitedResults.length
      };
      
      console.log(`✅ Retrieved ${limitedResults.length} registrations for event ${eventId} from cache`);
      
      return {
        success: true,
        data: limitedResults,
        count: limitedResults.length,
        stats,
        metadata: { 
          method: 'redis_cache', 
          cached: true,
          source: 'redis',
          filtered_at: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Get event registrations error:', error);
      throw error;
    }
  }

  /**
   * Check if cache is valid
   */
  async isCacheValid() {
    try {
      const timestamp = await redisService.get(this.cacheKeys.cacheTimestamp);
      if (!timestamp) {
        return false;
      }
      
      const age = Date.now() - timestamp;
      return age < (this.cacheTTL.allRegistrations * 1000); // Convert to milliseconds
    } catch (error) {
      console.error('❌ Cache validation error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex) || {};
      const timestamp = await redisService.get(this.cacheKeys.cacheTimestamp);
      
      console.log('🔍 Cache stats debug:');
      console.log(`   - allRecords type: ${typeof allRecords}`);
      console.log(`   - allRecords length: ${Array.isArray(allRecords) ? allRecords.length : 'not array'}`);
      console.log(`   - eventIndex type: ${typeof eventIndex}`);
      console.log(`   - eventIndex keys: ${Object.keys(eventIndex).length}`);
      
      return {
        total_records: Array.isArray(allRecords) ? allRecords.length : 0,
        total_events: Object.keys(eventIndex).length,
        cache_age: timestamp ? Date.now() - timestamp : null,
        cache_valid: await this.isCacheValid(),
        events: Object.keys(eventIndex).map(eventId => ({
          event_id: eventId,
          registrations: Array.isArray(eventIndex[eventId]) ? eventIndex[eventId].length : 0
        }))
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return {
        total_records: 0,
        total_events: 0,
        cache_age: null,
        cache_valid: false,
        events: []
      };
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      console.log('🧹 Clearing Redis cache...');
      
      await redisService.del(this.cacheKeys.allRegistrations);
      await redisService.del(this.cacheKeys.eventIndex);
      await redisService.del(this.cacheKeys.cacheTimestamp);
      await redisService.del(this.cacheKeys.cacheVersion);
      
      console.log('✅ Redis cache cleared');
      
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      console.error('❌ Clear cache error:', error);
      throw error;
    }
  }

  /**
   * Broadcast cache update to all connected clients
   */
  async broadcastCacheUpdate(type, data) {
    try {
      if (socketService.io) {
        socketService.broadcastToAll('cache_update', {
          type,
          data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Broadcast error:', error);
    }
  }

  /**
   * Start scheduled cache refresh
   */
  startScheduledRefresh(intervalMinutes = 30) {
    console.log(`⏰ Starting scheduled cache refresh every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      try {
        console.log('🔄 Scheduled Redis cache refresh...');
        await this.populateFromZoho();
      } catch (error) {
        console.error('❌ Scheduled refresh error:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Handle Zoho data changes (edit/delete)
   * This method should be called when we detect changes in Zoho
   */
  async handleZohoDataChange(changeType, recordId, eventId = null) {
    try {
      console.log(`🔄 Handling Zoho data change: ${changeType} for record ${recordId}`);
      
      switch (changeType) {
        case 'edit':
          await this.handleRecordEdit(recordId, eventId);
          break;
        case 'delete':
          await this.handleRecordDelete(recordId, eventId);
          break;
        case 'bulk_change':
          await this.handleBulkChange();
          break;
        default:
          console.log(`⚠️ Unknown change type: ${changeType}`);
      }
    } catch (error) {
      console.error('❌ Handle Zoho data change error:', error);
      throw error;
    }
  }

  /**
   * Handle record edit in Zoho
   */
  async handleRecordEdit(recordId, eventId = null) {
    try {
      console.log(`📝 Handling record edit: ${recordId}`);
      
      // Option 1: Fetch updated record from Zoho
      const updatedRecord = await this.fetchSingleRecord(recordId);
      if (updatedRecord) {
        await this.updateSingleRecord(recordId, updatedRecord);
        console.log(`✅ Record ${recordId} updated in cache`);
      } else {
        // Record might be deleted, remove from cache
        await this.handleRecordDelete(recordId, eventId);
      }
    } catch (error) {
      console.error('❌ Handle record edit error:', error);
      // Fallback to full refresh if single record update fails
      await this.handleBulkChange();
    }
  }

  /**
   * Handle record delete in Zoho
   */
  async handleRecordDelete(recordId, eventId = null) {
    try {
      console.log(`🗑️ Handling record delete: ${recordId}`);
      
      // Get current cache
      const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex) || {};
      
      // Remove record from all records
      const updatedAllRecords = allRecords.filter(record => record.ID !== recordId);
      
      // Remove record from event index
      if (eventId && eventIndex[eventId]) {
        eventIndex[eventId] = eventIndex[eventId].filter(record => record.ID !== recordId);
      } else {
        // If eventId not provided, search all events
        Object.keys(eventIndex).forEach(eId => {
          eventIndex[eId] = eventIndex[eId].filter(record => record.ID !== recordId);
        });
      }
      
      // Update Redis with smart TTL
      await redisService.set(this.cacheKeys.allRegistrations, updatedAllRecords, this.cacheTTL.allRegistrations);
      await redisService.set(this.cacheKeys.eventIndex, eventIndex, this.cacheTTL.eventIndex);
      await redisService.set(this.cacheKeys.cacheTimestamp, Date.now(), this.cacheTTL.metadata);
      
      console.log(`✅ Record ${recordId} removed from cache`);
      
      // Push real-time update
      if (eventId) {
        await socketService.pushRegistrationData(eventId, [], 'record_deleted', { recordId });
      }
      
    } catch (error) {
      console.error('❌ Handle record delete error:', error);
      // Fallback to full refresh
      await this.handleBulkChange();
    }
  }

  /**
   * Handle bulk changes (multiple edits/deletes)
   */
  async handleBulkChange() {
    try {
      console.log('🔄 Handling bulk changes - performing full cache refresh');
      
      // Perform full cache refresh
      await this.populateFromZoho();
      
      // Broadcast to all clients
      await this.broadcastCacheUpdate('bulk_change', {
        message: 'Cache refreshed due to bulk changes',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Handle bulk change error:', error);
      throw error;
    }
  }

  /**
   * Fetch single record from Zoho
   */
  async fetchSingleRecord(recordId) {
    try {
      console.log(`📥 Fetching single record: ${recordId}`);
      
      // Use Zoho Creator API to fetch single record
      const response = await zohoCreatorAPI.getRecord('Registrations', recordId);
      
      if (response && response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Fetch single record error:', error);
      return null;
    }
  }

  /**
   * Update single record in cache
   */
  async updateSingleRecord(recordId, updatedRecord) {
    try {
      console.log(`🔄 Updating single record in cache: ${recordId}`);
      
      // Get current cache
      const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex) || {};
      
      // Find and update record in all records
      const recordIndex = allRecords.findIndex(record => record.ID === recordId);
      if (recordIndex !== -1) {
        allRecords[recordIndex] = updatedRecord;
      } else {
        // Record not found, add it
        allRecords.push(updatedRecord);
      }
      
      // Update event index
      if (updatedRecord.Event_Info && updatedRecord.Event_Info.ID) {
        const eventId = updatedRecord.Event_Info.ID;
        
        if (!eventIndex[eventId]) {
          eventIndex[eventId] = [];
        }
        
        // Find and update record in event index
        const eventRecordIndex = eventIndex[eventId].findIndex(record => record.ID === recordId);
        if (eventRecordIndex !== -1) {
          eventIndex[eventId][eventRecordIndex] = updatedRecord;
        } else {
          // Record not found in this event, add it
          eventIndex[eventId].push(updatedRecord);
        }
      }
      
      // Update Redis with smart TTL
      await redisService.set(this.cacheKeys.allRegistrations, allRecords, this.cacheTTL.allRegistrations);
      await redisService.set(this.cacheKeys.eventIndex, eventIndex, this.cacheTTL.eventIndex);
      await redisService.set(this.cacheKeys.cacheTimestamp, Date.now(), this.cacheTTL.metadata);
      
      console.log(`✅ Single record ${recordId} updated in cache`);
      
      // Push real-time update
      if (updatedRecord.Event_Info && updatedRecord.Event_Info.ID) {
        await socketService.pushRegistrationData(updatedRecord.Event_Info.ID, [updatedRecord], 'record_updated');
      }
      
    } catch (error) {
      console.error('❌ Update single record error:', error);
      throw error;
    }
  }

  /**
   * Check for data inconsistencies between Zoho and cache
   */
  async validateCacheIntegrity() {
    try {
      console.log('🔍 Validating cache integrity...');
      
      const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex) || {};
      
      // Get record count from Zoho (lightweight check)
      const zohoCount = await this.getZohoRecordCount();
      
      if (zohoCount !== allRecords.length) {
        console.log(`⚠️ Cache inconsistency detected: Cache=${allRecords.length}, Zoho=${zohoCount}`);
        return {
          valid: false,
          cache_count: allRecords.length,
          zoho_count: zohoCount,
          difference: Math.abs(zohoCount - allRecords.length)
        };
      }
      
      console.log('✅ Cache integrity validated');
      return {
        valid: true,
        cache_count: allRecords.length,
        zoho_count: zohoCount
      };
      
    } catch (error) {
      console.error('❌ Cache integrity validation error:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get record count from Zoho (lightweight)
   */
  async getZohoRecordCount() {
    try {
      // Use a lightweight API call to get count
      const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        max_records: 1,
        field_config: 'quick_view'
      });
      
      return response.count || 0;
    } catch (error) {
      console.error('❌ Get Zoho record count error:', error);
      return 0;
    }
  }

  /**
   * Force cache refresh with integrity check
   */
  async forceRefreshWithIntegrityCheck() {
    try {
      console.log('🔄 Force refresh with integrity check...');
      
      // First check integrity
      const integrity = await this.validateCacheIntegrity();
      
      if (!integrity.valid) {
        console.log('⚠️ Cache integrity check failed, performing full refresh');
        await this.populateFromZoho();
      } else {
        console.log('✅ Cache integrity check passed');
      }
      
      return integrity;
    } catch (error) {
      console.error('❌ Force refresh error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const redisPopulationService = new RedisPopulationService();
module.exports = redisPopulationService;
