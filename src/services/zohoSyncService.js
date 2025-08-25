const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
const redisPopulationService = require('./redisPopulationService');
const redisService = require('./redisService');
const socketService = require('./socketService');

/**
 * Zoho Sync Service - Real-time synchronization mechanism
 * Handles automated synchronization between Zoho and Redis with change detection
 */
class ZohoSyncService {
  constructor() {
    this.syncIntervals = new Map();
    this.changeDetectionInterval = null;
    this.lastSyncTimestamps = new Map();
    this.syncLocks = new Map();
    
    // Configuration - Tối ưu intervals
    this.config = {
      // Sync intervals (in minutes) - Tăng lên để giảm API calls
      fastSync: 30,       // For high-priority events (từ 5 → 30)
      normalSync: 60,     // For normal events (từ 15 → 60)
      slowSync: 120,      // For low-priority events (từ 60 → 120)
      
      // Change detection - Tăng lên để giảm checks
      changeDetectionInterval: 15, // Check for changes every 15 minutes (từ 2 → 15)
      
      // Batch processing
      batchSize: 50,
      maxConcurrentSyncs: 3,
      
      // Retry configuration
      maxRetries: 3,
      retryDelay: 5000,
      
      // Cache TTL
      syncMetadataTTL: 24 * 60 * 60, // 24 hours
    };
    
    console.log('🔄 Zoho Sync Service initialized with optimized intervals');
  }

  /**
   * Start real-time synchronization
   */
  async startRealTimeSync() {
    try {
      console.log('🚀 Starting real-time Zoho synchronization...');
      
      // Start change detection
      await this.startChangeDetection();
      
      // Start event-specific sync intervals
      await this.startEventSyncIntervals();
      
      // Start integrity monitoring
      await this.startIntegrityMonitoring();
      
      console.log('✅ Real-time synchronization started successfully');
      return { success: true, message: 'Real-time sync started' };
      
    } catch (error) {
      console.error('❌ Error starting real-time sync:', error);
      throw error;
    }
  }

  /**
   * Stop real-time synchronization
   */
  async stopRealTimeSync() {
    try {
      console.log('🛑 Stopping real-time synchronization...');
      
      // Stop change detection
      if (this.changeDetectionInterval) {
        clearInterval(this.changeDetectionInterval);
        this.changeDetectionInterval = null;
      }
      
      // Stop all event sync intervals
      for (const [eventId, intervalId] of this.syncIntervals) {
        clearInterval(intervalId);
        console.log(`🛑 Stopped sync for event: ${eventId}`);
      }
      this.syncIntervals.clear();
      
      console.log('✅ Real-time synchronization stopped');
      return { success: true, message: 'Real-time sync stopped' };
      
    } catch (error) {
      console.error('❌ Error stopping real-time sync:', error);
      throw error;
    }
  }

  /**
   * Start change detection mechanism
   */
  async startChangeDetection() {
    console.log(`⏰ Starting change detection (every ${this.config.changeDetectionInterval} minutes)`);
    
    this.changeDetectionInterval = setInterval(async () => {
      try {
        await this.detectAndSyncChanges();
      } catch (error) {
        console.error('❌ Change detection error:', error);
      }
    }, this.config.changeDetectionInterval * 60 * 1000);
  }

  /**
   * Detect changes using timestamps and sync
   */
  async detectAndSyncChanges() {
    try {
      console.log('🔍 Detecting changes in Zoho data...');
      
      // Get last sync timestamp
      const lastSyncTime = await this.getLastSyncTimestamp('global');
      const currentTime = new Date();
      
      // Check for modified records since last sync
      const modifiedRecords = await this.getModifiedRecords(lastSyncTime);
      
      if (modifiedRecords.length > 0) {
        console.log(`📝 Found ${modifiedRecords.length} modified records`);
        
        // Process changes in batches
        await this.processBatchChanges(modifiedRecords);
        
        // Update last sync timestamp
        await this.setLastSyncTimestamp('global', currentTime);
        
        // Log sync metrics
        await this.logSyncMetrics('change_detection', modifiedRecords.length, true);
      } else {
        console.log('✅ No changes detected');
      }
      
    } catch (error) {
      console.error('❌ Error detecting changes:', error);
      await this.logSyncMetrics('change_detection', 0, false, error.message);
    }
  }

  /**
   * Get modified records from Zoho since last sync
   */
  async getModifiedRecords(sinceTimestamp) {
    try {
      const since = sinceTimestamp || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours default
      
      // Use Zoho API to get records modified since timestamp
      const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Modified_Time > "${since.toISOString()}"`,
        max_records: 1000,
        sort: 'Modified_Time:asc'
      });
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error getting modified records:', error);
      return [];
    }
  }

  /**
   * Process changes in batches
   */
  async processBatchChanges(records) {
    try {
      console.log(`🔄 Processing ${records.length} records in batches of ${this.config.batchSize}`);
      
      const batches = this.chunkArray(records, this.config.batchSize);
      const results = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} records)`);
        
        try {
          const batchResult = await this.processBatch(batch);
          results.push(batchResult);
          
          // Add delay between batches to avoid overwhelming the system
          if (i < batches.length - 1) {
            await this.sleep(1000);
          }
        } catch (batchError) {
          console.error(`❌ Error processing batch ${i + 1}:`, batchError);
          results.push({ success: false, error: batchError.message });
        }
      }
      
      const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
      console.log(`✅ Batch processing completed: ${totalProcessed} records processed`);
      
      return results;
    } catch (error) {
      console.error('❌ Error processing batch changes:', error);
      throw error;
    }
  }

  /**
   * Process a single batch of records
   */
  async processBatch(records) {
    try {
      let processed = 0;
      let updated = 0;
      let created = 0;
      
      for (const record of records) {
        try {
          // Check if record exists in cache
          const exists = await this.recordExistsInCache(record.ID);
          
          if (exists) {
            // Update existing record
            await redisPopulationService.updateSingleRecord(record.ID, record);
            updated++;
            
            // Broadcast update
            await socketService.broadcastToAll('record_updated', {
              record_id: record.ID,
              event_id: record.Event_Info?.ID,
              data: record,
              source: 'sync_service',
              timestamp: new Date().toISOString()
            });
          } else {
            // Add new record
            await redisPopulationService.updateCache(record);
            created++;
            
            // Broadcast creation
            await socketService.broadcastToAll('record_created', {
              record_id: record.ID,
              event_id: record.Event_Info?.ID,
              data: record,
              source: 'sync_service',
              timestamp: new Date().toISOString()
            });
          }
          
          processed++;
          
        } catch (recordError) {
          console.error(`❌ Error processing record ${record.ID}:`, recordError);
        }
      }
      
      console.log(`✅ Batch processed: ${processed} total, ${updated} updated, ${created} created`);
      
      return {
        success: true,
        processed,
        updated,
        created
      };
      
    } catch (error) {
      console.error('❌ Error processing batch:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if record exists in cache
   */
  async recordExistsInCache(recordId) {
    try {
      const allRecords = await redisService.get('zoho:all_registrations') || [];
      return allRecords.some(record => record.ID === recordId);
    } catch (error) {
      console.error('❌ Error checking record existence:', error);
      return false;
    }
  }

  /**
   * Start event-specific sync intervals
   */
  async startEventSyncIntervals() {
    try {
      console.log('⏰ Starting event-specific sync intervals...');
      
      // Get active events from cache
      const eventIndex = await redisService.get('zoho:event_index') || {};
      const activeEvents = Object.keys(eventIndex);
      
      for (const eventId of activeEvents) {
        await this.startEventSync(eventId);
      }
      
      console.log(`✅ Started sync intervals for ${activeEvents.length} events`);
    } catch (error) {
      console.error('❌ Error starting event sync intervals:', error);
    }
  }

  /**
   * Start sync for specific event
   */
  async startEventSync(eventId, priority = 'normal') {
    try {
      // Avoid duplicate intervals
      if (this.syncIntervals.has(eventId)) {
        return;
      }
      
      const interval = this.getSyncInterval(priority);
      console.log(`⏰ Starting ${priority} sync for event ${eventId} (every ${interval} minutes)`);
      
      const intervalId = setInterval(async () => {
        try {
          await this.syncEvent(eventId);
        } catch (error) {
          console.error(`❌ Event sync error for ${eventId}:`, error);
        }
      }, interval * 60 * 1000);
      
      this.syncIntervals.set(eventId, intervalId);
      
    } catch (error) {
      console.error(`❌ Error starting event sync for ${eventId}:`, error);
    }
  }

  /**
   * Sync specific event
   */
  async syncEvent(eventId) {
    try {
      // Check if sync is already in progress
      if (this.syncLocks.has(eventId)) {
        console.log(`⏳ Sync already in progress for event: ${eventId}`);
        return;
      }
      
      this.syncLocks.set(eventId, true);
      console.log(`🔄 Syncing event: ${eventId}`);
      
      // Get event data from Zoho
      const eventData = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info.ID == "${eventId}"`,
        max_records: 10000
      });
      
      if (eventData.success && eventData.data) {
        // Update cache for this event
        await this.updateEventInCache(eventId, eventData.data);
        
        console.log(`✅ Event ${eventId} synced: ${eventData.data.length} records`);
        
        // Log sync metrics
        await this.logSyncMetrics('event_sync', eventData.data.length, true, null, eventId);
      }
      
    } catch (error) {
      console.error(`❌ Error syncing event ${eventId}:`, error);
      await this.logSyncMetrics('event_sync', 0, false, error.message, eventId);
    } finally {
      this.syncLocks.delete(eventId);
    }
  }

  /**
   * Update event data in cache
   */
  async updateEventInCache(eventId, eventRecords) {
    try {
      // Get current cache
      const allRecords = await redisService.get('zoho:all_registrations') || [];
      const eventIndex = await redisService.get('zoho:event_index') || {};
      
      // Remove old records for this event
      const filteredRecords = allRecords.filter(record => 
        record.Event_Info?.ID !== eventId
      );
      
      // Add new records
      const updatedRecords = [...filteredRecords, ...eventRecords];
      
      // Update event index
      eventIndex[eventId] = eventRecords;
      
      // Save to Redis
      await redisService.set('zoho:all_registrations', updatedRecords, 30 * 60); // 30 minutes TTL
      await redisService.set('zoho:event_index', eventIndex, 30 * 60);
      await redisService.set('zoho:cache_timestamp', Date.now(), 60 * 60);
      
      console.log(`✅ Event ${eventId} cache updated: ${eventRecords.length} records`);
      
    } catch (error) {
      console.error(`❌ Error updating event cache for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Start integrity monitoring
   */
  async startIntegrityMonitoring() {
    console.log('🔍 Starting integrity monitoring...');
    
    // Check integrity every hour
    setInterval(async () => {
      try {
        const integrity = await redisPopulationService.validateCacheIntegrity();
        
        if (!integrity.valid) {
          console.log('⚠️ Cache integrity issue detected, triggering full sync');
          await redisPopulationService.populateFromZoho();
          
          // Broadcast integrity issue
          await socketService.broadcastToAll('integrity_issue_resolved', {
            integrity_check: integrity,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('❌ Integrity monitoring error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Get sync interval based on priority
   */
  getSyncInterval(priority) {
    switch (priority) {
      case 'fast': return this.config.fastSync;
      case 'slow': return this.config.slowSync;
      default: return this.config.normalSync;
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(key) {
    try {
      const timestamp = await redisService.get(`sync:timestamp:${key}`);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error('❌ Error getting last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTimestamp(key, timestamp) {
    try {
      await redisService.set(`sync:timestamp:${key}`, timestamp.toISOString(), this.config.syncMetadataTTL);
    } catch (error) {
      console.error('❌ Error setting last sync timestamp:', error);
    }
  }

  /**
   * Log sync metrics
   */
  async logSyncMetrics(syncType, recordCount, success, error = null, eventId = null) {
    try {
      if (!redisService.isReady()) return;
      
      const today = new Date().toISOString().split('T')[0];
      const metricsKey = `sync:metrics:${today}`;
      
      const metrics = await redisService.get(metricsKey) || {
        total_syncs: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        total_records_synced: 0,
        by_sync_type: {},
        by_event: {},
        last_sync: null
      };
      
      metrics.total_syncs++;
      if (success) {
        metrics.successful_syncs++;
        metrics.total_records_synced += recordCount;
      } else {
        metrics.failed_syncs++;
      }
      
      metrics.by_sync_type[syncType] = (metrics.by_sync_type[syncType] || 0) + 1;
      
      if (eventId) {
        metrics.by_event[eventId] = (metrics.by_event[eventId] || 0) + 1;
      }
      
      metrics.last_sync = new Date().toISOString();
      
      await redisService.set(metricsKey, metrics, 7 * 24 * 60 * 60); // 7 days TTL
      
    } catch (error) {
      console.error('❌ Error logging sync metrics:', error);
    }
  }

  /**
   * Get sync status and metrics
   */
  async getSyncStatus() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const metrics = await redisService.get(`sync:metrics:${today}`) || {};
      
      return {
        is_running: this.changeDetectionInterval !== null,
        active_intervals: this.syncIntervals.size,
        active_events: Array.from(this.syncIntervals.keys()),
        last_change_detection: await this.getLastSyncTimestamp('global'),
        metrics,
        config: this.config
      };
    } catch (error) {
      console.error('❌ Error getting sync status:', error);
      return { error: error.message };
    }
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for full sync
   */
  async triggerFullSync() {
    try {
      console.log('🔄 Manual full sync triggered...');
      
      const result = await redisPopulationService.populateFromZoho();
      
      // Broadcast full sync completion
      await socketService.broadcastToAll('full_sync_completed', {
        result,
        triggered_by: 'manual',
        timestamp: new Date().toISOString()
      });
      
      await this.logSyncMetrics('full_sync', result.total_records || 0, result.success);
      
      return result;
    } catch (error) {
      console.error('❌ Manual full sync error:', error);
      await this.logSyncMetrics('full_sync', 0, false, error.message);
      throw error;
    }
  }

  /**
   * Add event to sync monitoring
   */
  async addEventToSync(eventId, priority = 'normal') {
    try {
      console.log(`➕ Adding event ${eventId} to sync monitoring (${priority} priority)`);
      
      await this.startEventSync(eventId, priority);
      
      return {
        success: true,
        message: `Event ${eventId} added to sync monitoring`,
        priority,
        interval: this.getSyncInterval(priority)
      };
    } catch (error) {
      console.error(`❌ Error adding event ${eventId} to sync:`, error);
      throw error;
    }
  }

  /**
   * Remove event from sync monitoring
   */
  async removeEventFromSync(eventId) {
    try {
      console.log(`➖ Removing event ${eventId} from sync monitoring`);
      
      if (this.syncIntervals.has(eventId)) {
        clearInterval(this.syncIntervals.get(eventId));
        this.syncIntervals.delete(eventId);
        
        return {
          success: true,
          message: `Event ${eventId} removed from sync monitoring`
        };
      } else {
        return {
          success: false,
          message: `Event ${eventId} was not being monitored`
        };
      }
    } catch (error) {
      console.error(`❌ Error removing event ${eventId} from sync:`, error);
      throw error;
    }
  }
}

// Export singleton instance
const zohoSyncService = new ZohoSyncService();
module.exports = zohoSyncService;


