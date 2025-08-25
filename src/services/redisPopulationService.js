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
   * Populate Redis cache from Zoho API
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
      const limit = parseInt(filters.limit) || 10000;
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
   * Check if cache is valid (both time and data)
   */
  async isCacheValid() {
    try {
      const timestamp = await redisService.get(this.cacheKeys.cacheTimestamp);
      if (!timestamp) {
        console.log('🔍 Cache invalid: No timestamp');
        return false;
      }
      
      // Check time validity
      const age = Date.now() - timestamp;
      const timeValid = age < (this.cacheTTL.allRegistrations * 1000);
      
      if (!timeValid) {
        console.log('🔍 Cache invalid: Time expired');
        return false;
      }
      
      // Check data validity - cache should have data
      const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
      const eventIndex = await redisService.get(this.cacheKeys.eventIndex) || {};
      
      const hasData = Array.isArray(allRecords) && allRecords.length > 0 && Object.keys(eventIndex).length > 0;
      
      if (!hasData) {
        console.log('🔍 Cache invalid: No data (records:', allRecords.length, ', events:', Object.keys(eventIndex).length, ')');
        return false;
      }
      
      console.log('🔍 Cache valid: Time OK, Data OK');
      return true;
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
   * Start scheduled cache refresh with smart validation
   */
  startScheduledRefresh(intervalMinutes = 30) {
    console.log(`⏰ Starting lightweight health check every ${intervalMinutes} minutes`);
    
    // Lightweight health check (thay vì full refresh)
    setInterval(async () => {
      try {
        console.log('🔍 Performing cache health check...');
        const isHealthy = await this.checkCacheHealth();
        
        if (!isHealthy) {
          console.log('⚠️ Cache health check failed, triggering recovery...');
          await this.handleCacheFailure();
        } else {
          console.log('✅ Cache health check passed');
        }
      } catch (error) {
        console.error('❌ Cache health check error:', error);
      }
    }, intervalMinutes * 60 * 1000);
    
    // Remove the aggressive 5-minute validation check
    console.log('✅ Removed aggressive cache validation - using webhook-based updates instead');
  }

  /**
   * Lightweight cache health check
   */
  async checkCacheHealth() {
    try {
      // 1. Check Redis connection
      if (!redisService.isReady()) {
        console.log('❌ Redis not ready');
        return false;
      }
      
      // 2. Check cache structure exists
      const hasData = await redisService.exists(this.cacheKeys.allRegistrations);
      const hasIndex = await redisService.exists(this.cacheKeys.eventIndex);
      
      if (!hasData || !hasIndex) {
        console.log('❌ Cache structure missing');
        return false;
      }
      
      // 3. Optional: Lightweight count check (allow small difference)
      try {
        const recordCount = await this.getZohoRecordCount();
        const allRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
        const cacheCount = allRecords.length;
        
        const difference = Math.abs(recordCount - cacheCount);
        const isCountValid = difference < 10; // Allow 10 records difference
        
        if (!isCountValid) {
          console.log(`⚠️ Count mismatch: Cache=${cacheCount}, Zoho=${recordCount}, Diff=${difference}`);
          return false;
        }
      } catch (countError) {
        console.warn('⚠️ Count check failed, continuing with structure check only:', countError.message);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Cache health check error:', error);
      return false;
    }
  }

  /**
   * Handle cache failure with smart recovery
   */
  async handleCacheFailure() {
    try {
      console.log('🔄 Starting cache failure recovery...');
      
      // 1. Try webhook-based recovery first (lightweight)
      const webhookRecovery = await this.recoverFromWebhooks();
      if (webhookRecovery.success) {
        console.log('✅ Cache recovered via webhook data');
        return webhookRecovery;
      }
      
      // 2. If webhook recovery failed, do lightweight sync
      console.log('🔄 Webhook recovery failed, trying lightweight sync...');
      const lightweightSync = await this.lightweightSync();
      if (lightweightSync.success) {
        console.log('✅ Cache recovered via lightweight sync');
        return lightweightSync;
      }
      
      // 3. Last resort: full refresh
      console.log('🔄 Lightweight sync failed, performing full refresh...');
      const fullRefresh = await this.populateFromZoho();
      console.log('✅ Cache recovered via full refresh');
      return fullRefresh;
      
    } catch (error) {
      console.error('❌ Cache failure recovery error:', error);
      throw error;
    }
  }

  /**
   * Try to recover cache from webhook data
   */
  async recoverFromWebhooks() {
    try {
      // This would check if we have recent webhook data to reconstruct cache
      // For now, return false to trigger next recovery method
      return { success: false, method: 'webhook_recovery' };
    } catch (error) {
      console.error('❌ Webhook recovery error:', error);
      return { success: false, method: 'webhook_recovery', error: error.message };
    }
  }

  /**
   * Lightweight sync - only fetch recent records
   */
  async lightweightSync() {
    try {
      console.log('🔄 Performing lightweight sync...');
      
      // Get last sync timestamp
      const lastSync = await redisService.get(this.cacheKeys.cacheTimestamp) || 0;
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      // Only sync if last sync was more than 1 hour ago
      if (lastSync > oneHourAgo) {
        console.log('✅ Cache is recent enough, skipping lightweight sync');
        return { success: true, method: 'skip_sync' };
      }
      
      // Fetch only recent records (last 24 hours)
      const recentRecords = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        max_records: 200,
        criteria: `(Created_Time > '${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}')`,
        useCache: false
      });
      
      if (recentRecords.data && recentRecords.data.length > 0) {
        // Merge with existing cache
        const existingRecords = await redisService.get(this.cacheKeys.allRegistrations) || [];
        const mergedRecords = this.mergeRecords(existingRecords, recentRecords.data);
        
        await redisService.set(this.cacheKeys.allRegistrations, mergedRecords, this.cacheTTL.allRegistrations);
        await redisService.set(this.cacheKeys.cacheTimestamp, Date.now(), this.cacheTTL.metadata);
        
        console.log(`✅ Lightweight sync completed: ${recentRecords.data.length} recent records merged`);
        return { success: true, method: 'lightweight_sync', records_added: recentRecords.data.length };
      }
      
      return { success: false, method: 'lightweight_sync', reason: 'no_recent_records' };
      
    } catch (error) {
      console.error('❌ Lightweight sync error:', error);
      return { success: false, method: 'lightweight_sync', error: error.message };
    }
  }

  /**
   * Merge new records with existing cache
   */
  mergeRecords(existingRecords, newRecords) {
    const existingMap = new Map(existingRecords.map(record => [record.ID, record]));
    
    // Add/update new records
    newRecords.forEach(record => {
      existingMap.set(record.ID, record);
    });
    
    return Array.from(existingMap.values());
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
      const response = await zohoCreatorAPI.getRecord('All_Registrations', recordId);
      
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
