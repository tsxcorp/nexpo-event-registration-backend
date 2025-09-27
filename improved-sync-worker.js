/**
 * Improved Sync Worker with Verification and Discrepancy Detection
 * Đề xuất cải tiến cơ chế sync để đảm bảo data integrity
 */

class ImprovedSyncWorker {
  constructor() {
    this.config = {
      // Sync thresholds
      maxDiscrepancyPercent: 5, // Cho phép sai lệch tối đa 5%
      forceResyncThreshold: 10, // Force resync nếu sai lệch > 10%
      
      // Pagination settings
      batchSize: 500, // Tăng batch size
      maxRetries: 3,
      retryDelay: 2000,
      
      // Verification settings
      enableCountVerification: true,
      enableDataIntegrityCheck: true,
      enableMissingRecordDetection: true
    };
  }

  /**
   * Enhanced sync với verification
   */
  async syncEventWithVerification(eventId) {
    logger.info(`🔄 Starting verified sync for event ${eventId}`);

    try {
      // 1. Get actual count from Zoho first
      const zohoCount = await this.getZohoRecordCount(eventId);
      logger.info(`📊 Zoho has ${zohoCount} records for event ${eventId}`);

      // 2. Get current Redis count
      const redisCount = await this.getRedisRecordCount(eventId);
      logger.info(`💾 Redis has ${redisCount} records for event ${eventId}`);

      // 3. Calculate discrepancy
      const discrepancy = Math.abs(zohoCount - redisCount);
      const discrepancyPercent = (discrepancy / zohoCount) * 100;

      logger.info(`📈 Discrepancy: ${discrepancy} records (${discrepancyPercent.toFixed(2)}%)`);

      // 4. Decide sync strategy based on discrepancy
      if (discrepancyPercent > this.config.forceResyncThreshold) {
        logger.warn(`⚠️ High discrepancy detected, performing full resync`);
        return await this.performFullResync(eventId);
      } else if (discrepancyPercent > this.config.maxDiscrepancyPercent) {
        logger.info(`🔄 Moderate discrepancy, performing incremental sync`);
        return await this.performIncrementalSync(eventId);
      } else {
        logger.info(`✅ Data is in sync, no action needed`);
        return { action: 'none', records: 0 };
      }

    } catch (error) {
      logger.error(`❌ Error in verified sync for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get accurate record count from Zoho
   */
  async getZohoRecordCount(eventId) {
    try {
      // Use count-only query to get accurate count
      const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info = ${eventId}`,
        max_records: 1, // Minimal fetch just to get count
        fetchAll: false
      });

      if (!response.success) {
        throw new Error('Failed to get count from Zoho');
      }

      // For accurate count, we need to fetch all and count
      // Zoho doesn't provide count endpoint, so we fetch with minimal data
      const countResponse = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info = ${eventId}`,
        max_records: 1000,
        fetchAll: true,
        field_config: 'id_only' // Only fetch IDs to minimize data transfer
      });

      return countResponse.data?.length || 0;

    } catch (error) {
      logger.error(`Error getting Zoho count for event ${eventId}:`, error);
      return 0;
    }
  }

  /**
   * Get Redis record count
   */
  async getRedisRecordCount(eventId) {
    try {
      const recordIdsData = await redisService.get(`cache:event:${eventId}:record_ids`);
      if (!recordIdsData) return 0;
      
      const recordIds = JSON.parse(recordIdsData);
      return recordIds.length;

    } catch (error) {
      logger.error(`Error getting Redis count for event ${eventId}:`, error);
      return 0;
    }
  }

  /**
   * Full resync với integrity check
   */
  async performFullResync(eventId) {
    logger.info(`🔄 Performing full resync for event ${eventId}`);

    try {
      // 1. Clear existing data for this event
      await this.clearEventData(eventId);

      // 2. Fetch all records from Zoho with retry logic
      const zohoRecords = await this.fetchAllRecordsWithRetry(eventId);

      // 3. Store records in batches
      const batchSize = this.config.batchSize;
      let storedCount = 0;

      for (let i = 0; i < zohoRecords.length; i += batchSize) {
        const batch = zohoRecords.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            await redisService.storeIndividualRecord(record.ID, record);
            storedCount++;
          } catch (error) {
            logger.error(`Failed to store record ${record.ID}:`, error);
          }
        }

        // Log progress
        const progress = ((i + batch.length) / zohoRecords.length * 100).toFixed(1);
        logger.info(`📊 Progress: ${progress}% (${storedCount}/${zohoRecords.length} records stored)`);
      }

      // 4. Update event metadata
      await this.updateEventMetadata(eventId, storedCount);

      // 5. Verify final count
      const finalCount = await this.getRedisRecordCount(eventId);
      logger.info(`✅ Full resync completed: ${finalCount} records stored`);

      return { action: 'full_resync', records: finalCount };

    } catch (error) {
      logger.error(`❌ Full resync failed for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all records with retry logic
   */
  async fetchAllRecordsWithRetry(eventId, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`📡 Fetching records for event ${eventId} (attempt ${attempt}/${maxRetries})`);
        
        const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
          criteria: `Event_Info = ${eventId}`,
          max_records: 1000,
          fetchAll: true
        });

        if (!response.success || !response.data) {
          throw new Error('No data returned from Zoho');
        }

        const records = Array.isArray(response.data) ? response.data : [response.data];
        logger.info(`✅ Successfully fetched ${records.length} records`);
        
        return records;

      } catch (error) {
        lastError = error;
        logger.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * attempt;
          logger.info(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to fetch records after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Clear all data for specific event
   */
  async clearEventData(eventId) {
    try {
      // Get all record IDs for this event
      const recordIdsData = await redisService.get(`cache:event:${eventId}:record_ids`);
      if (recordIdsData) {
        const recordIds = JSON.parse(recordIdsData);
        
        // Delete individual records
        for (const recordId of recordIds) {
          await redisService.del(`cache:record:${recordId}`);
        }
      }

      // Delete event-specific keys
      await redisService.del(`cache:event:${eventId}:record_ids`);
      await redisService.del(`cache:event:${eventId}:count`);
      await redisService.del(`cache:event:${eventId}:meta`);
      await redisService.del(`cache:event:${eventId}:last_sync`);

      logger.info(`🗑️ Cleared all data for event ${eventId}`);

    } catch (error) {
      logger.error(`Error clearing data for event ${eventId}:`, error);
    }
  }

  /**
   * Update event metadata
   */
  async updateEventMetadata(eventId, recordCount) {
    const recordIds = [];
    
    // Get all record IDs from stored records
    const keys = await redisService.client.keys(`cache:record:*`);
    for (const key of keys) {
      const recordId = key.replace('cache:record:', '');
      const recordData = await redisService.get(key);
      if (recordData) {
        const record = JSON.parse(recordData);
        if (record.Event_Info === eventId || record.Event_Info?.ID === eventId) {
          recordIds.push(recordId);
        }
      }
    }

    // Store metadata
    await redisService.set(`cache:event:${eventId}:record_ids`, recordIds, -1);
    await redisService.set(`cache:event:${eventId}:count`, recordCount, -1);
    await redisService.set(`cache:event:${eventId}:meta`, {
      total_records: recordCount,
      last_updated: new Date().toISOString(),
      source: 'improved_sync_worker',
      sync_type: 'full_resync'
    }, -1);
    await redisService.set(`cache:event:${eventId}:last_sync`, new Date().toISOString(), -1);
  }

  /**
   * Detect missing records
   */
  async detectMissingRecords(eventId) {
    try {
      // Get Zoho record IDs
      const zohoResponse = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        criteria: `Event_Info = ${eventId}`,
        max_records: 1000,
        fetchAll: true,
        field_config: 'id_only'
      });

      const zohoRecordIds = zohoResponse.data?.map(r => r.ID) || [];
      
      // Get Redis record IDs
      const redisRecordIdsData = await redisService.get(`cache:event:${eventId}:record_ids`);
      const redisRecordIds = redisRecordIdsData ? JSON.parse(redisRecordIdsData) : [];

      // Find missing records
      const missingInRedis = zohoRecordIds.filter(id => !redisRecordIds.includes(id));
      const extraInRedis = redisRecordIds.filter(id => !zohoRecordIds.includes(id));

      logger.info(`🔍 Missing in Redis: ${missingInRedis.length} records`);
      logger.info(`🔍 Extra in Redis: ${extraInRedis.length} records`);

      return {
        missingInRedis,
        extraInRedis,
        zohoCount: zohoRecordIds.length,
        redisCount: redisRecordIds.length
      };

    } catch (error) {
      logger.error(`Error detecting missing records for event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Smart sync - tự động chọn strategy phù hợp
   */
  async smartSyncEvent(eventId) {
    logger.info(`🧠 Starting smart sync for event ${eventId}`);

    try {
      // 1. Detect missing records
      const discrepancy = await this.detectMissingRecords(eventId);
      if (!discrepancy) {
        throw new Error('Failed to detect discrepancies');
      }

      // 2. Choose strategy
      if (discrepancy.missingInRedis.length === 0 && discrepancy.extraInRedis.length === 0) {
        logger.info(`✅ Data is perfectly synced`);
        return { action: 'none', records: discrepancy.zohoCount };
      }

      if (discrepancy.missingInRedis.length > 100 || discrepancy.extraInRedis.length > 100) {
        logger.info(`🔄 Large discrepancies detected, performing full resync`);
        return await this.performFullResync(eventId);
      } else {
        logger.info(`🔧 Small discrepancies, performing targeted sync`);
        return await this.performTargetedSync(eventId, discrepancy);
      }

    } catch (error) {
      logger.error(`❌ Smart sync failed for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Targeted sync - chỉ sync records bị thiếu
   */
  async performTargetedSync(eventId, discrepancy) {
    logger.info(`🎯 Performing targeted sync for event ${eventId}`);

    let syncedCount = 0;

    try {
      // Add missing records
      if (discrepancy.missingInRedis.length > 0) {
        logger.info(`➕ Adding ${discrepancy.missingInRedis.length} missing records`);
        
        for (const recordId of discrepancy.missingInRedis) {
          try {
            const recordResponse = await zohoCreatorAPI.getRecord('All_Registrations', recordId);
            if (recordResponse.success && recordResponse.data) {
              await redisService.storeIndividualRecord(recordId, recordResponse.data);
              syncedCount++;
            }
          } catch (error) {
            logger.error(`Failed to fetch missing record ${recordId}:`, error);
          }
        }
      }

      // Remove extra records
      if (discrepancy.extraInRedis.length > 0) {
        logger.info(`➖ Removing ${discrepancy.extraInRedis.length} extra records`);
        
        for (const recordId of discrepancy.extraInRedis) {
          try {
            await redisService.del(`cache:record:${recordId}`);
          } catch (error) {
            logger.error(`Failed to remove extra record ${recordId}:`, error);
          }
        }
      }

      // Update metadata
      await this.updateEventMetadata(eventId, discrepancy.zohoCount);

      logger.info(`✅ Targeted sync completed: ${syncedCount} records synced`);
      return { action: 'targeted_sync', records: syncedCount };

    } catch (error) {
      logger.error(`❌ Targeted sync failed for event ${eventId}:`, error);
      throw error;
    }
  }
}

module.exports = ImprovedSyncWorker;
