const logger = require('../utils/logger');
const redisService = require('./redisService');
const zohoCreatorAPI = require('../utils/zohoCreatorAPI');

/**
 * Sync Worker Service
 * Continuously monitors and syncs data between Zoho Creator and Redis
 * Detects discrepancies and performs incremental updates
 */
class SyncWorker {
  constructor() {
    this.isRunning = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.syncStats = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      records_added: 0,
      records_updated: 0,
      records_removed: 0,
      last_sync_duration: 0
    };
    
    // Configuration
    this.config = {
      syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS) || 5 * 60 * 1000, // 5 minutes default
      batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100,
      maxRetries: parseInt(process.env.SYNC_MAX_RETRIES) || 3,
      enableAutoSync: process.env.ENABLE_AUTO_SYNC !== 'false',
      enableDiscrepancyDetection: process.env.ENABLE_DISCREPANCY_DETECTION !== 'false'
    };
    
    logger.info('Sync Worker initialized', {
      syncIntervalMs: this.config.syncIntervalMs,
      batchSize: this.config.batchSize,
      enableAutoSync: this.config.enableAutoSync
    });
  }

  /**
   * Start the sync worker
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Sync worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting sync worker...');

    // Initial sync
    await this.performFullSync();

    // Schedule periodic sync
    if (this.config.enableAutoSync) {
      this.syncInterval = setInterval(async () => {
        await this.performIncrementalSync();
      }, this.config.syncIntervalMs);
      
      logger.info(`Scheduled incremental sync every ${this.config.syncIntervalMs}ms`);
    }
  }

  /**
   * Stop the sync worker
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Sync worker is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    logger.info('Sync worker stopped');
  }

  /**
   * Perform full synchronization
   */
  async performFullSync() {
    const startTime = Date.now();
    logger.info('Starting full sync...');

    try {
      // Get all events from Zoho
      const events = await this.getAllEventsFromZoho();
      logger.info(`Found ${events.length} events in Zoho`);

      let totalRecords = 0;
      let syncedEvents = 0;

      for (const event of events) {
        try {
          const eventId = event.ID || event.id;
          const recordCount = await this.syncEventData(eventId);
          totalRecords += recordCount;
          syncedEvents++;
          
          logger.info(`Synced event ${eventId}: ${recordCount} records`);
        } catch (error) {
          logger.error(`Failed to sync event ${event.ID}:`, error.message);
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata({
        last_full_sync: new Date().toISOString(),
        total_events: events.length,
        synced_events: syncedEvents,
        total_records: totalRecords
      });

      const duration = Date.now() - startTime;
      this.syncStats.total_syncs++;
      this.syncStats.successful_syncs++;
      this.syncStats.last_sync_duration = duration;

      logger.info(`Full sync completed in ${duration}ms: ${syncedEvents}/${events.length} events, ${totalRecords} records`);

    } catch (error) {
      this.syncStats.failed_syncs++;
      logger.error('Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Perform incremental synchronization
   */
  async performIncrementalSync() {
    if (!this.config.enableDiscrepancyDetection) {
      logger.debug('Discrepancy detection disabled, skipping incremental sync');
      return;
    }

    const startTime = Date.now();
    logger.info('Starting incremental sync...');

    try {
      // Get events that need sync
      const eventsToSync = await this.getEventsNeedingSync();
      
      if (eventsToSync.length === 0) {
        logger.info('No events need incremental sync');
        return;
      }

      logger.info(`Found ${eventsToSync.length} events needing sync`);

      let totalChanges = 0;

      for (const eventId of eventsToSync) {
        try {
          const changes = await this.syncEventIncremental(eventId);
          totalChanges += changes;
        } catch (error) {
          logger.error(`Failed incremental sync for event ${eventId}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;
      this.syncStats.total_syncs++;
      this.syncStats.successful_syncs++;
      this.syncStats.last_sync_duration = duration;

      logger.info(`Incremental sync completed in ${duration}ms: ${totalChanges} changes across ${eventsToSync.length} events`);

    } catch (error) {
      this.syncStats.failed_syncs++;
      logger.error('Incremental sync failed:', error);
    }
  }

  /**
   * Sync specific event data
   */
  async syncEventData(eventId) {
    try {
      // Get records from Zoho for this event
      const zohoRecords = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info = ${eventId}`,
        max_records: 1000,
        fetchAll: true
      });

      if (!zohoRecords.success || !zohoRecords.data) {
        logger.warn(`No records found in Zoho for event ${eventId}`);
        return 0;
      }

      const records = Array.isArray(zohoRecords.data) ? zohoRecords.data : [zohoRecords.data];
      logger.info(`Found ${records.length} records in Zoho for event ${eventId}`);

      // Store in Redis using per-record schema
      for (const record of records) {
        await redisService.storeIndividualRecord(record.ID, record);
      }

      // Update event metadata
      await redisService.set(`cache:event:${eventId}:record_ids`, records.map(r => r.ID), -1);
      await redisService.set(`cache:event:${eventId}:count`, records.length, -1);
      await redisService.set(`cache:event:${eventId}:meta`, {
        total_records: records.length,
        last_updated: new Date().toISOString(),
        source: 'sync_worker'
      }, -1);

      return records.length;

    } catch (error) {
      logger.error(`Error syncing event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Perform incremental sync for specific event (timestamp-based)
   */
  async syncEventIncremental(eventId) {
    try {
      // Get last sync timestamp for this event
      const lastSyncData = await redisService.get(`cache:event:${eventId}:last_sync`);
      const lastSyncTime = lastSyncData ? new Date(lastSyncData) : new Date(0);
      
      logger.info(`Event ${eventId}: Last sync at ${lastSyncTime.toISOString()}`);

      // Fetch only records created/modified after last sync
      const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info = ${eventId} AND (Created_Time > "${lastSyncTime.toISOString()}" OR Modified_Time > "${lastSyncTime.toISOString()}")`,
        max_records: 1000,
        fetchAll: true
      });

      if (!response.success || !response.data || response.data.length === 0) {
        logger.debug(`Event ${eventId}: No new records since last sync`);
        return 0;
      }

      const newRecords = response.data;
      logger.info(`Event ${eventId}: Found ${newRecords.length} new/updated records`);

      // Sync only the new records
      let syncedCount = 0;
      for (const record of newRecords) {
        try {
          await redisService.updateEventRecord(eventId, record);
          syncedCount++;
        } catch (error) {
          logger.error(`Error syncing record ${record.ID}:`, error);
        }
      }

      // Update last sync timestamp
      await redisService.set(`cache:event:${eventId}:last_sync`, new Date().toISOString(), -1);

      logger.info(`Event ${eventId}: Incremental sync completed - ${syncedCount} records synced`);
      return syncedCount;

    } catch (error) {
      logger.error(`Error in incremental sync for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get all events from Zoho
   */
  async getAllEventsFromZoho() {
    try {
      const response = await zohoCreatorAPI.getReportRecords('Events', {
        max_records: 1000,
        fetchAll: true
      });

      if (!response.success || !response.data) {
        logger.warn('No events found in Zoho');
        return [];
      }

      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      logger.error('Error fetching events from Zoho:', error);
      throw error;
    }
  }

  /**
   * Get Zoho record count for specific event
   */
  async getZohoRecordCount(eventId) {
    try {
      const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info = ${eventId}`,
        max_records: 1000,
        fetchAll: true
      });

      if (!response.success || !response.data) {
        return 0;
      }

      // Count actual records returned
      const records = Array.isArray(response.data) ? response.data : [response.data];
      return records.length;

    } catch (error) {
      logger.error(`Error getting Zoho count for event ${eventId}:`, error);
      return 0;
    }
  }

  /**
   * Get events that need synchronization (timestamp-based)
   */
  async getEventsNeedingSync() {
    try {
      // Get all cached events
      const eventKeys = await redisService.client.keys('cache:event:*:meta');
      const eventsToSync = [];

      for (const key of eventKeys) {
        const eventId = key.match(/cache:event:([^:]+):meta/)?.[1];
        if (!eventId) continue;

        // Check last sync timestamp (not meta last_updated)
        const lastSyncData = await redisService.get(`cache:event:${eventId}:last_sync`);
        const lastSyncTime = lastSyncData ? new Date(lastSyncData) : new Date(0);
        const now = new Date();
        const timeDiff = now - lastSyncTime;

        // Sync if more than 15 minutes since last sync (configurable)
        const syncThreshold = parseInt(process.env.SYNC_THRESHOLD_MINUTES) || 15;
        if (timeDiff > syncThreshold * 60 * 1000) {
          eventsToSync.push(eventId);
        }
      }

      return eventsToSync;

    } catch (error) {
      logger.error('Error getting events needing sync:', error);
      return [];
    }
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(data) {
    try {
      const metadata = {
        ...data,
        sync_stats: this.syncStats,
        worker_status: {
          is_running: this.isRunning,
          last_sync_time: new Date().toISOString()
        }
      };

      await redisService.set('sync:metadata', metadata, -1);
    } catch (error) {
      logger.error('Error updating sync metadata:', error);
    }
  }

  /**
   * Get sync status and statistics
   */
  getStatus() {
    return {
      is_running: this.isRunning,
      config: this.config,
      stats: this.syncStats,
      last_sync_time: this.lastSyncTime
    };
  }

  /**
   * Force sync for specific event
   */
  async forceSyncEvent(eventId) {
    logger.info(`Force syncing event ${eventId}...`);
    
    try {
      const recordCount = await this.syncEventData(eventId);
      logger.info(`Force sync completed for event ${eventId}: ${recordCount} records`);
      return { success: true, recordCount };
    } catch (error) {
      logger.error(`Force sync failed for event ${eventId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const syncWorker = new SyncWorker();

module.exports = syncWorker;
