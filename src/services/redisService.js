const redis = require('redis');

/**
 * Unified Redis Service - Consolidates all Redis functionality
 * Replaces: redisService, redisBufferService, redisPopulationService, zohoSyncService
 */
class RedisService {
  constructor() {
    this.client = null;
    this.subClient = null; // Separate client for subscriptions
    this.isConnected = false;
    this.isSubConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000;
    
    // Configuration
    this.config = this.getRedisConfig();
    
    // Log configuration
    this.logLevel = process.env.REDIS_LOG_LEVEL || 'INFO'; // DEBUG, INFO, WARN, ERROR
    
    // Cache configuration
    this.cacheConfig = {
      ttl: {
        events: 0,           // lifetime (no expiration)
        registrations: 0,    // lifetime (no expiration)
        visitors: 0,         // lifetime (no expiration)
        buffer: 7 * 24 * 60 * 60, // 7 days
        sync: 24 * 60 * 60   // 24 hours
      },
      keys: {
        events: 'cache:events',
        registrations: 'cache:registrations',
        visitors: 'cache:visitors',
        buffer: 'buffer:queue',
        sync: 'sync:timestamp'
      }
    };
    
    // Sync configuration
    this.syncConfig = {
      webhookEnabled: true,
      scheduledSync: 60, // 1 hour
      changeDetection: 15, // 15 minutes
      maxConcurrentSyncs: 3
    };
    
    console.log('🔧 Unified Redis Service initialized');
    
    // Auto connect
    this.connect().catch(error => {
      console.error('❌ Redis auto-connect failed:', error.message);
    });
  }

  /**
   * Log helper with level control
   */
  log(level, message, ...args) {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    const currentLevel = levels[this.logLevel] || 1;
    const messageLevel = levels[level] || 1;
    
    if (messageLevel >= currentLevel) {
      console.log(message, ...args);
    }
  }

  /**
   * Normalize Zoho record fields for consistent processing
   */
  normalizeZohoRecord(record) {
    if (!record) return null;
    
    return {
      id: record.ID,
      event_id: record.Event_Info?.ID || record.Event_Info,
      redeem_id: record.Redeem_ID,
      full_name: record.Full_Name,
      email: record.Email,
      phone: record.Phone_Number,
      company: record.Company_Name,
      status: this.normalizeCheckInStatus(record.Check_In_Status),
      is_group: this.normalizeBoolean(record.Group_Registration),
      version: this.getRecordVersion(record),
      updated_at: record.Modified_Time || record.Updated_At || new Date().toISOString(),
      // Keep original record for backward compatibility
      original: record
    };
  }

  /**
   * Normalize check-in status to consistent format
   */
  normalizeCheckInStatus(status) {
    if (!status) return 'registered';
    
    const statusStr = String(status).toLowerCase().trim();
    if (statusStr.includes('checked') || statusStr === 'true') {
      return 'checked_in';
    }
    return 'registered';
  }

  /**
   * Normalize boolean fields
   */
  normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return false;
  }

  /**
   * Get record version for conflict resolution
   */
  getRecordVersion(record) {
    const timestamp = record.Modified_Time || record.Updated_At || record.Created_Time;
    if (timestamp) {
      return new Date(timestamp).getTime();
    }
    return Date.now();
  }

  /**
   * Get Redis configuration with proper fallbacks
   */
  getRedisConfig() {
    // Use REDIS_URL if available (for Redis Cloud)
    if (process.env.REDIS_URL) {
      console.log('🔗 Using REDIS_URL from environment');
      return {
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= 5) return false;
            return Math.min(retries * 500, 3000);
          },
          connectTimeout: 15000,
          commandTimeout: 10000,
          lazyConnect: false,
          keepAlive: 30000,
          family: 4
        },
        retryDelayOnFailover: 1000,
        maxRetriesPerRequest: 3
      };
    }
    
    // Fallback to local Redis
    console.log('🏠 Using local Redis fallback');
    return {
      host: 'localhost',
      port: 6379,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= 2) return false;
          return 1000;
        },
        connectTimeout: 5000,
        lazyConnect: false  // Auto connect
      }
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    if (this.isConnected && this.client?.isReady) {
      return true;
    }

    try {
      console.log('🔄 Connecting to Redis...');
      
      this.client = redis.createClient(this.config);
      
      this.client.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connected and ready');
        this.isConnected = true;
        this.retryAttempts = 0;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis connection ended');
        this.isConnected = false;
      });

      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      console.log('✅ Redis service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors
        }
        this.client = null;
      }
      
      return false;
    }
  }

  /**
   * Connect subscriber client (separate from main client)
   */
  async connectSubscriber() {
    if (this.isSubConnected && this.subClient?.isReady) {
      return true;
    }

    try {
      console.log('🔄 Connecting Redis subscriber...');
      
      this.subClient = redis.createClient(this.config);
      
      this.subClient.on('error', (err) => {
        console.error('❌ Redis Sub Error:', err.message);
        this.isSubConnected = false;
      });

      this.subClient.on('ready', () => {
        console.log('✅ Redis subscriber connected');
        this.isSubConnected = true;
      });

      this.subClient.on('end', () => {
        console.log('🔌 Redis subscriber connection ended');
        this.isSubConnected = false;
      });

      await Promise.race([
        this.subClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Subscriber connection timeout')), 10000)
        )
      ]);

      console.log('✅ Redis subscriber initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Redis subscriber connection failed:', error.message);
      this.isSubConnected = false;
      
      if (this.subClient) {
        try {
          await this.subClient.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors
        }
        this.subClient = null;
      }
      
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.disconnect();
      }
      if (this.subClient && this.isSubConnected) {
        await this.subClient.disconnect();
      }
      this.isConnected = false;
      this.isSubConnected = false;
      console.log('✅ Redis disconnected');
    } catch (error) {
      console.error('❌ Redis disconnect error:', error.message);
    }
  }

  /**
   * Check if Redis is ready
   */
  isReady() {
    return this.isConnected && this.client?.isReady;
  }

  // ==================== CORE CACHE OPERATIONS ====================

  /**
   * Set cache with TTL
   */
  async set(key, value, ttlSeconds = -1) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping cache set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.setEx(key, ttlSeconds, serialized);
        this.log('DEBUG', `📝 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      } else {
        // For lifetime (no expiration), use set without TTL
        await this.client.set(key, serialized);
        this.log('DEBUG', `📝 Cache SET: ${key} (lifetime - no expiration)`);
      }
      return true;
    } catch (error) {
      console.error('❌ Redis SET error:', error);
      return false;
    }
  }

  /**
   * Get from cache
   */
  async get(key) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, cache miss');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        this.log('DEBUG', `📖 Cache HIT: ${key}`);
        const parsed = JSON.parse(value);
        if (key === 'cache:metadata') {
        }
        return parsed;
      } else {
        this.log('DEBUG', `📭 Cache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Redis GET error:', error);
      return null;
    }
  }

  /**
   * Delete from cache
   */
  async del(key) {
    if (!this.isReady()) return false;

    try {
      const result = await this.client.del(key);
      console.log(`🗑️ Cache DEL: ${key} (${result ? 'deleted' : 'not found'})`);
      return result > 0;
    } catch (error) {
      console.error('❌ Redis DEL error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.isReady()) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Redis EXISTS error:', error);
      return false;
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Cache data with type-specific TTL
   */
  async cacheData(type, id, data, customTtl = null) {
    const key = `${this.cacheConfig.keys[type]}:${id}`;
    const ttl = customTtl || this.cacheConfig.ttl[type] || -1;
    
    return await this.set(key, {
      data,
      cached_at: new Date().toISOString(),
      type,
      id
    }, ttl);
  }

  /**
   * Get cached data by type and ID
   */
  async getCachedData(type, id) {
    const key = `${this.cacheConfig.keys[type]}:${id}`;
    const cached = await this.get(key);
    
    if (cached && cached.data) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Cache all registrations with event indexing
   */
  async cacheAllRegistrations(registrations) {
    try {
      // Cache main data
      await this.set(this.cacheConfig.keys.registrations, registrations, this.cacheConfig.ttl.registrations);
      
      // Create event index
      const eventIndex = {};
      registrations.forEach(record => {
        if (record.Event_Info && record.Event_Info.ID) {
          const eventId = record.Event_Info.ID;
          if (!eventIndex[eventId]) {
            eventIndex[eventId] = [];
          }
          eventIndex[eventId].push(record);
        }
      });
      
      // Cache event index
      await this.set('cache:event_index', eventIndex, this.cacheConfig.ttl.registrations);
      
      // Update cache metadata
      await this.set('cache:metadata', {
        total_records: registrations.length,
        total_events: Object.keys(eventIndex).length,
        last_updated: new Date().toISOString()
      }, this.cacheConfig.ttl.sync);
      
      console.log(`✅ Cached ${registrations.length} registrations for ${Object.keys(eventIndex).length} events`);
      return true;
    } catch (error) {
      console.error('❌ Error caching registrations:', error);
      return false;
    }
  }

  /**
   * Get event registrations from cache (Per-Event Only)
   */
  async getEventRegistrations(eventId, filters = {}) {
    try {
      // Ensure Redis is connected
      if (!this.isConnected) {
        await this.connect();
      }

      // Get from per-event cache keys only
      const perEventKey = `cache:event:${eventId}:registrations`;
      const perEventData = await this.get(perEventKey);

      if (!perEventData || !Array.isArray(perEventData)) {
        console.log(`📭 No per-event data found for event ${eventId}`);
        return {
          success: true,
          data: [],
          count: 0,
          cached: false,
          source: 'redis',
          metadata: { method: 'per_event_cache_miss' }
        };
      }

      let filteredData = perEventData;

      // Apply filters using normalized data
      if (filters.status && filters.status !== 'all') {
        filteredData = filteredData.filter(record => {
          const normalized = this.normalizeZohoRecord(record);
          if (!normalized) return false;
          
          if (filters.status === 'checked_in') return normalized.status === 'checked_in';
          if (filters.status === 'not_yet') return normalized.status === 'registered';
          return true;
        });
      }

      if (filters.group_only === 'true') {
        filteredData = filteredData.filter(record => {
          const normalized = this.normalizeZohoRecord(record);
          return normalized ? normalized.is_group : false;
        });
      }

      const limit = parseInt(filters.limit) || 10000;
      const limitedResults = filteredData.slice(0, limit);

      return {
        success: true,
        data: limitedResults,
        count: limitedResults.length,
        cached: true,
        source: 'redis',
        metadata: { method: 'per_event_keys' }
      };
    } catch (error) {
      console.error('❌ Error getting event registrations:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Populate a single event's registrations from Zoho and cache per-event keys
   */
  async populateEventFromZoho(eventId, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const { max_records = 1000, force_refresh = false } = options;

      if (!force_refresh) {
        const exists = await this.get(`cache:event:${eventId}:registrations`);
        if (exists && Array.isArray(exists) && exists.length > 0) {
          return { success: true, message: 'Per-event cache already exists', count: exists.length };
        }
      }

      const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
      const criteria = `Event_Info.ID = "${eventId}"`;
      const result = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        max_records: 1000,
        fetchAll: true,
        useCache: false,
        criteria
      });

      if (!result.success) {
        return { success: false, error: 'Zoho fetch failed' };
      }

      const records = Array.isArray(result.data) ? result.data : [];
      await this.set(`cache:event:${eventId}:registrations`, records, this.cacheConfig.ttl.registrations);
      await this.set(`cache:event:${eventId}:count`, { count: records.length }, this.cacheConfig.ttl.registrations);
      await this.set(`cache:event:${eventId}:meta`, { last_populated: new Date().toISOString(), source: 'zoho' }, this.cacheConfig.ttl.registrations);

      return { success: true, count: records.length };
    } catch (error) {
      console.error('❌ Error populating event from Zoho:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update cache with new record
   */
  async updateCacheWithRecord(newRecord) {
    try {
      // Get current cache
      const allRecords = await this.get(this.cacheConfig.keys.registrations) || [];
      const eventIndex = await this.get('cache:event_index') || {};
      
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
      
      // Update cache
      await this.set(this.cacheConfig.keys.registrations, allRecords, this.cacheConfig.ttl.registrations);
      await this.set('cache:event_index', eventIndex, this.cacheConfig.ttl.registrations);
      
      console.log('✅ Cache updated with new record');
      return true;
    } catch (error) {
      console.error('❌ Error updating cache:', error);
      return false;
    }
  }

  /**
   * Remove record from cache
   */
  async removeRecordFromCache(recordId, eventId = null) {
    try {
      const allRecords = await this.get(this.cacheConfig.keys.registrations) || [];
      const eventIndex = await this.get('cache:event_index') || {};
      
      // Remove from all records
      const updatedRecords = allRecords.filter(record => record.ID !== recordId);
      
      // Remove from event index
      if (eventId && eventIndex[eventId]) {
        eventIndex[eventId] = eventIndex[eventId].filter(record => record.ID !== recordId);
      } else {
        // Search all events
        Object.keys(eventIndex).forEach(eId => {
          eventIndex[eId] = eventIndex[eId].filter(record => record.ID !== recordId);
        });
      }
      
      // Update cache
      await this.set(this.cacheConfig.keys.registrations, updatedRecords, this.cacheConfig.ttl.registrations);
      await this.set('cache:event_index', eventIndex, this.cacheConfig.ttl.registrations);
      
      console.log(`✅ Record ${recordId} removed from cache`);
      return true;
    } catch (error) {
      console.error('❌ Error removing record from cache:', error);
      return false;
    }
  }

  // ==================== BUFFER SYSTEM ====================

  /**
   * Add data to buffer queue
   */
  async addToBuffer(data, reason = 'API_LIMIT') {
    try {
      if (!this.isReady()) {
        return { success: false, error: 'Redis not available' };
      }

      const bufferItem = {
        id: `buf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        data,
        reason,
        attempts: 0,
        maxAttempts: 5,
        status: 'pending'
      };

      // Add to buffer queue
      await this.client.lPush(this.cacheConfig.keys.buffer, JSON.stringify(bufferItem));
      
      console.log(`📦 Added to buffer: ${bufferItem.id} (${reason})`);
      
      return {
        success: true,
        bufferId: bufferItem.id,
        message: 'Data added to buffer queue'
      };
    } catch (error) {
      console.error('❌ Error adding to buffer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process buffer queue
   */
  async processBuffer(submitFunction) {
    try {
      if (!this.isReady()) {
        return { success: false, error: 'Redis not available' };
      }

      const bufferData = await this.client.rPop(this.cacheConfig.keys.buffer);
      
      if (!bufferData) {
        return { success: true, message: 'No data in buffer' };
      }

      const bufferItem = JSON.parse(bufferData);
      
      if (bufferItem.attempts >= bufferItem.maxAttempts) {
        console.log(`❌ Buffer item ${bufferItem.id} exceeded max attempts`);
        return { success: false, error: 'Max attempts exceeded' };
      }

      // Attempt submission
      const result = await submitFunction(bufferItem.data);
      
      if (result.success) {
        console.log(`✅ Buffer item ${bufferItem.id} processed successfully`);
        return { success: true, result };
      } else {
        // Increment attempts and re-queue
        bufferItem.attempts++;
        bufferItem.lastAttempt = new Date().toISOString();
        
        if (bufferItem.attempts < bufferItem.maxAttempts) {
          // Re-queue with delay
          setTimeout(async () => {
            await this.client.lPush(this.cacheConfig.keys.buffer, JSON.stringify(bufferItem));
          }, 30000 * bufferItem.attempts); // Exponential backoff
        }
        
        return { success: false, error: result.error || 'Submission failed' };
      }
    } catch (error) {
      console.error('❌ Error processing buffer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get buffer status
   */
  async getBufferStatus() {
    try {
      if (!this.isReady()) {
        return { length: 0, status: 'disconnected' };
      }

      const length = await this.client.lLen(this.cacheConfig.keys.buffer);
      return { length, status: 'connected' };
    } catch (error) {
      console.error('❌ Error getting buffer status:', error);
      return { length: 0, status: 'error' };
    }
  }

  // ==================== SYNC MANAGEMENT ====================

  /**
   * Set last sync timestamp
   */
  async setLastSyncTimestamp(key, timestamp = new Date()) {
    const syncKey = `${this.cacheConfig.keys.sync}:${key}`;
    return await this.set(syncKey, timestamp.toISOString(), this.cacheConfig.ttl.sync);
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(key) {
    const syncKey = `${this.cacheConfig.keys.sync}:${key}`;
    const timestamp = await this.get(syncKey);
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Check if cache is valid
   */
  async isCacheValid(maxAgeMinutes = 60) {
    try {
      const metadata = await this.get('cache:metadata');
      if (!metadata) {
        return false;
      }
      
      // Check if we have data
      const hasData = metadata.total_records > 0;
      if (!hasData) {
        return false;
      }
      
      // Check timestamp freshness
      if (metadata.last_updated) {
        const cacheAge = (Date.now() - new Date(metadata.last_updated).getTime()) / 1000 / 60; // minutes
        if (cacheAge > maxAgeMinutes) {
          console.log(`⚠️ Cache is ${cacheAge.toFixed(1)} minutes old (max: ${maxAgeMinutes})`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Get cache statistics (Per-Event Only)
   */
  async getCacheStats() {
    try {
      // Get all per-event keys
      const keys = await this.client.keys('cache:event:*:count');
      let totalRecords = 0;
      let totalEvents = 0;
      const events = [];
      
      // Process each event
      for (const key of keys) {
        const countData = await this.get(key);
        if (countData && countData.count) {
          totalRecords += countData.count;
          totalEvents++;
          
          // Extract event ID from key
          const eventId = key.match(/cache:event:(.+):count/)?.[1];
          if (eventId) {
            events.push({
              event_id: eventId,
              registrations: countData.count
            });
          }
        }
      }
      
      // Update metadata with correct stats
      const metadata = {
        total_records: totalRecords,
        total_events: totalEvents,
        last_updated: new Date().toISOString(),
        max_records: 1000
      };
      
      // Save updated metadata
      await this.set('cache:metadata', metadata, -1);
      
      return {
        total_records: totalRecords,
        total_events: totalEvents,
        last_updated: metadata.last_updated,
        cache_valid: totalRecords > 0,
        events: events
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return {
        total_records: 0,
        total_events: 0,
        last_updated: null,
        cache_valid: false,
        events: []
      };
    }
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    try {
      if (!this.isReady()) {
        console.warn('⚠️ Redis not ready, skipping cache clear');
        return { success: false, error: 'Redis not ready' };
      }

      // Get all cache keys
      const allKeys = await this.client.keys('cache:*');
      const zohoKeys = await this.client.keys('zoho:*');
      const allKeysToDelete = [...allKeys, ...zohoKeys];
      
      if (allKeysToDelete.length > 0) {
        // Delete all keys in batches
        const batchSize = 100;
        for (let i = 0; i < allKeysToDelete.length; i += batchSize) {
          const batch = allKeysToDelete.slice(i, i + batchSize);
          await this.client.del(batch);
        }
        console.log(`🗑️ Deleted ${allKeysToDelete.length} cache keys`);
      } else {
        console.log('📭 No cache keys found to delete');
      }
      
      console.log('✅ All cache cleared successfully');
      return { success: true, message: 'All cache cleared successfully' };
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean duplicate cache entries
   */
  async cleanDuplicateCache() {
    try {
      console.log('🧹 Cleaning duplicate cache entries...');
      
      // Remove old duplicate keys
      const duplicateKeys = [
        'zoho:all_registrations'
      ];
      
      for (const key of duplicateKeys) {
        const exists = await this.exists(key);
        if (exists) {
          await this.del(key);
          console.log(`🗑️ Removed duplicate key: ${key}`);
        }
      }
      
      console.log('✅ Duplicate cache entries cleaned');
      return { success: true, message: 'Duplicate cache entries cleaned' };
    } catch (error) {
      console.error('❌ Error cleaning duplicate cache:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Populate cache from Zoho Creator
   */
  async populateFromZoho(options = {}) {
    try {
      const { force_refresh = false, max_records = 1000, include_all_events = true } = options;
      
      console.log('🚀 Starting cache population from Zoho...');
      console.log(`📊 Options: force_refresh=${force_refresh}, max_records=${max_records}, include_all_events=${include_all_events}`);
      
      // Clear existing cache if force refresh
      if (force_refresh) {
        await this.clearCache();
      }
      
      // Check if cache is already valid
      if (!force_refresh && await this.isCacheValid()) {
        console.log('✅ Cache is already valid, skipping population');
        return { success: true, message: 'Cache already valid' };
      }
      
      // Check if we already have data in cache
      const existingData = await this.get('zoho:Registrations:{"event_id":null}');
      if (existingData && existingData.data && existingData.data.length > 0) {
        console.log(`✅ Cache already has ${existingData.data.length} records, skipping population`);
        return { success: true, message: 'Cache already has data' };
      }
      
      // Check if we have valid metadata
      const metadata = await this.get('cache:metadata');
      if (metadata && metadata.total_records > 0) {
        console.log(`✅ Cache metadata shows ${metadata.total_records} records, skipping population`);
        return { success: true, message: 'Cache metadata shows data exists' };
      }
      
      const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
      
      // Fetch all registrations using pagination (Zoho max is 1000 per request)
      console.log('📦 Fetching all registrations from Zoho using pagination...');
      const allRegistrations = await zohoCreatorAPI.getReportRecords('All_Registrations', {
        max_records: 1000, // Zoho API limit
        fetchAll: true,    // This will paginate through all records
        useCache: false
      });
      
      if (!allRegistrations.success || !allRegistrations.data) {
        throw new Error('Failed to fetch registrations from Zoho');
      }
      
      console.log(`📊 Fetched ${allRegistrations.data.length} registrations from Zoho`);
      
      // Cache the data
      await this.cacheZohoData('Registrations', { event_id: null }, allRegistrations, 300);
      
      // Create event index
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
      
      // Cache event index
      await this.set('cache:event_index', eventIndex, 300);
      console.log(`📦 Created event index with ${Object.keys(eventIndex).length} events`);

      // Also cache per-event keys for fast reads
      const eventIds = Object.keys(eventIndex);
      for (const eId of eventIds) {
        const records = eventIndex[eId];
        await this.set(`cache:event:${eId}:registrations`, records, this.cacheConfig.ttl.registrations);
        await this.set(`cache:event:${eId}:count`, { count: records.length }, this.cacheConfig.ttl.registrations);
        await this.set(`cache:event:${eId}:meta`, { last_populated: new Date().toISOString(), source: 'zoho_full' }, this.cacheConfig.ttl.registrations);
      }
      
      // Update cache metadata
      await this.set('cache:metadata', {
        last_updated: new Date().toISOString(),
        total_records: allRegistrations.data.length,
        total_events: Object.keys(eventIndex).length,
        max_records: max_records
      }, 300);
      
      console.log('✅ Cache population completed successfully');
      
      return {
        success: true,
        message: 'Cache populated successfully',
        stats: {
          total_records: allRegistrations.data.length,
          total_events: Object.keys(eventIndex).length,
          max_records: max_records
        }
      };
      
    } catch (error) {
      console.error('❌ Error populating cache from Zoho:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ZOHO DATA CACHING ====================

  /**
   * Cache Zoho data with specific key pattern
   */
  async cacheZohoData(reportName, params, data, ttl = 300) {
    try {
      const key = `zoho:${reportName}:${JSON.stringify(params)}`;
      
      // Standardize data structure - extract data.data if nested
      let normalizedData = data;
      if (data && data.data && Array.isArray(data.data)) {
        normalizedData = data.data; // Extract the actual array
      }
      
      const cacheData = {
        data: normalizedData, // Always store the actual array directly
        cached_at: new Date().toISOString(),
        report: reportName,
        params,
        total_records: Array.isArray(normalizedData) ? normalizedData.length : 0
      };
      
      await this.set(key, cacheData, ttl);
      console.log(`📦 Cached Zoho data: ${reportName}`);
      return true;
    } catch (error) {
      console.error('❌ Error caching Zoho data:', error);
      return false;
    }
  }

  /**
   * Get cached Zoho data
   */
  async getCachedZohoData(reportName, params) {
    try {
      const key = `zoho:${reportName}:${JSON.stringify(params)}`;
      const cached = await this.get(key);
      
      if (cached && cached.data) {
        console.log(`📖 Zoho cache HIT: ${reportName}`);
        return cached.data;
      }
      
      console.log(`📭 Zoho cache MISS: ${reportName}`);
      return null;
    } catch (error) {
      console.error('❌ Error getting cached Zoho data:', error);
      return null;
    }
  }

  /**
   * Publish Zoho update to channel
   */
  async publishZohoUpdate(reportName, eventId, updateType, data) {
    try {
      const channel = `zoho_updates:${reportName}`;
      const message = {
        event_id: eventId,
        update_type: updateType,
        data,
        timestamp: new Date().toISOString()
      };
      
      await this.publish(channel, message);
      console.log(`📢 Published Zoho update: ${reportName}:${updateType}`);
      return true;
    } catch (error) {
      console.error('❌ Error publishing Zoho update:', error);
      return false;
    }
  }

  // ==================== PUB/SUB OPERATIONS ====================

  /**
   * Publish message to channel
   */
  async publish(channel, message) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping publish');
      return false;
    }

    try {
      const serialized = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: message
      });
      
      const result = await this.client.publish(channel, serialized);
      console.log(`📢 Published to ${channel}: ${result} subscribers`);
      return result;
    } catch (error) {
      console.error('❌ Redis PUBLISH error:', error);
      return 0;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel, callback) {
    // Ensure subscriber client is connected
    if (!this.isSubConnected) {
      await this.connectSubscriber();
    }

    if (!this.isSubConnected || !this.subClient?.isReady) {
      console.warn('⚠️ Redis subscriber not ready, cannot subscribe');
      return false;
    }

    try {
      await this.subClient.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          console.log(`📥 Received from ${channel}:`, parsed.data);
          callback(parsed.data, parsed.timestamp);
        } catch (error) {
          console.error('❌ Message parse error:', error);
          callback(message, new Date().toISOString());
        }
      });
      
      console.log(`👂 Subscribed to channel: ${channel}`);
      return true;
    } catch (error) {
      console.error('❌ Redis SUBSCRIBE error:', error);
      return false;
    }
  }

  /**
   * Update a single record in event cache (for webhooks)
   */
  async updateEventRecord(eventId, record, recordId) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const registrationsKey = `cache:event:${eventId}:registrations`;
      const countKey = `cache:event:${eventId}:count`;
      const metaKey = `cache:event:${eventId}:meta`;
      const recordIdsKey = `cache:event:${eventId}:record_ids`;

      // 🚀 NEW: Store individual record
      await this.storeIndividualRecord(recordId, record);

      // Get existing registrations
      const existingData = await this.client.get(registrationsKey);
      let registrations = existingData ? JSON.parse(existingData) : [];

      // Update or add record
      const existingIndex = registrations.findIndex(r => r.ID === recordId);
      if (existingIndex >= 0) {
        registrations[existingIndex] = record;
      } else {
        registrations.push(record);
      }

      // Update registrations
      await this.client.set(registrationsKey, JSON.stringify(registrations));
      // TTL = 0 means no expiration (lifetime)

      // 🚀 NEW: Update record IDs list
      const recordIdsData = await this.client.get(recordIdsKey);
      let recordIds = recordIdsData ? JSON.parse(recordIdsData) : [];
      
      if (!recordIds.includes(recordId)) {
        recordIds.push(recordId);
        await this.client.set(recordIdsKey, JSON.stringify(recordIds), -1);
      }

      // Update count
      await this.client.set(countKey, JSON.stringify({ count: registrations.length }));
      // TTL = 0 means no expiration (lifetime)

      // Update meta
      const meta = {
        last_updated: new Date().toISOString(),
        source: 'webhook_sync',
        total_records: registrations.length
      };
      await this.client.set(metaKey, JSON.stringify(meta));
      // TTL = 0 means no expiration (lifetime)

      console.log(`✅ Updated event ${eventId} record ${recordId}: ${registrations.length} total records`);
      return true;

    } catch (error) {
      console.error('❌ Update event record error:', error);
      return false;
    }
  }

  /**
   * Remove a single record from event cache (for webhooks)
   */
  async removeEventRecord(eventId, recordId) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const registrationsKey = `cache:event:${eventId}:registrations`;
      const countKey = `cache:event:${eventId}:count`;
      const metaKey = `cache:event:${eventId}:meta`;

      // Get existing registrations
      const existingData = await this.client.get(registrationsKey);
      if (!existingData) return true;

      let registrations = JSON.parse(existingData);
      registrations = registrations.filter(r => r.ID !== recordId);

      // Update registrations
      await this.client.set(registrationsKey, JSON.stringify(registrations));
      // TTL = 0 means no expiration (lifetime)

      // Update count
      await this.client.set(countKey, JSON.stringify({ count: registrations.length }));
      // TTL = 0 means no expiration (lifetime)

      // Update meta
      const meta = {
        last_updated: new Date().toISOString(),
        source: 'webhook_sync',
        total_records: registrations.length
      };
      await this.client.set(metaKey, JSON.stringify(meta));
      // TTL = 0 means no expiration (lifetime)

      console.log(`✅ Removed event ${eventId} record ${recordId}: ${registrations.length} remaining records`);
      return true;

    } catch (error) {
      console.error('❌ Remove event record error:', error);
      return false;
    }
  }

  /**
   * 🚀 NEW: Per-Record Schema Methods
   * These methods provide individual record access for better performance
   */

  /**
   * Store individual record with per-record schema
   */
  async storeIndividualRecord(recordId, record) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const recordKey = `cache:record:${recordId}`;
      await this.set(recordKey, record, -1); // Lifetime TTL
      
      console.log(`✅ Stored individual record: ${recordId}`);
      return true;

    } catch (error) {
      console.error('❌ Store individual record error:', error);
      return false;
    }
  }

  /**
   * Get individual record by ID
   */
  async getIndividualRecord(recordId) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const recordKey = `cache:record:${recordId}`;
      const record = await this.get(recordKey);
      
      if (record) {
        console.log(`📖 Cache HIT: individual record ${recordId}`);
        return record;
      }

      console.log(`📭 Cache MISS: individual record ${recordId}`);
      return null;

    } catch (error) {
      console.error('❌ Get individual record error:', error);
      return null;
    }
  }

  /**
   * Update individual record (for check-in operations)
   */
  async updateIndividualRecord(recordId, updates) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const recordKey = `cache:record:${recordId}`;
      const existingRecord = await this.get(recordKey);
      
      if (!existingRecord) {
        console.log(`⚠️ Record ${recordId} not found for update`);
        return false;
      }

      // Merge updates with existing record
      const updatedRecord = { ...existingRecord, ...updates };
      await this.set(recordKey, updatedRecord, -1); // Lifetime TTL
      
      console.log(`✅ Updated individual record: ${recordId}`);
      return true;

    } catch (error) {
      console.error('❌ Update individual record error:', error);
      return false;
    }
  }

  /**
   * Get event registrations using per-record schema (faster for large events)
   */
  async getEventRegistrationsPerRecord(eventId, options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const { status, group_only, limit, offset } = options;
      const recordIdsKey = `cache:event:${eventId}:record_ids`;
      
      // Get record IDs for this event
      const recordIdsData = await this.client.get(recordIdsKey);
      if (!recordIdsData) {
        console.log(`📭 Cache MISS: event record IDs ${eventId}`);
        return { data: [], count: 0, cached: false, source: 'miss' };
      }

      const recordIds = JSON.parse(recordIdsData);
      console.log(`📖 Cache HIT: event record IDs ${eventId} (${recordIds.length} records)`);

      // Get individual records in parallel
      const recordPromises = recordIds.map(id => this.getIndividualRecord(id));
      const records = await Promise.all(recordPromises);
      
      // Filter out null records and apply filters
      let filteredRecords = records.filter(record => record !== null);

      if (status) {
        const normalizedStatus = this.normalizeCheckInStatus(status);
        filteredRecords = filteredRecords.filter(record => 
          this.normalizeCheckInStatus(record.Check_in_Status) === normalizedStatus
        );
      }

      if (group_only) {
        filteredRecords = filteredRecords.filter(record => 
          this.normalizeBoolean(record.Group_Registration)
        );
      }

      // Apply pagination
      const totalCount = filteredRecords.length;
      if (offset) {
        filteredRecords = filteredRecords.slice(offset);
      }
      if (limit) {
        filteredRecords = filteredRecords.slice(0, limit);
      }

      return {
        data: filteredRecords,
        count: totalCount,
        cached: true,
        source: 'per_record_schema',
        metadata: {
          method: 'per_record_keys',
          total_records: recordIds.length,
          filtered_records: filteredRecords.length
        }
      };

    } catch (error) {
      console.error('❌ Get event registrations per-record error:', error);
      return { data: [], count: 0, cached: false, source: 'error' };
    }
  }

  /**
   * Update cache metadata after webhook changes
   */
  async updateCacheMetadata() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Get all event count keys
      const countKeys = await this.client.keys('cache:event:*:count');
      let totalRecords = 0;
      let totalEvents = 0;

      for (const key of countKeys) {
        const countData = await this.client.get(key);
        if (countData) {
          const count = JSON.parse(countData);
          totalRecords += count.count || 0;
          totalEvents++;
        }
      }

      // Update metadata
      const metadata = {
        total_records: totalRecords,
        total_events: totalEvents,
        last_updated: new Date().toISOString(),
        max_records: 1000
      };
      await this.client.set('cache:metadata', JSON.stringify(metadata));
      // TTL = 0 means no expiration (lifetime)

      console.log(`📊 Updated cache metadata: ${totalEvents} events, ${totalRecords} records`);
      return true;

    } catch (error) {
      console.error('❌ Update cache metadata error:', error);
      return false;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;