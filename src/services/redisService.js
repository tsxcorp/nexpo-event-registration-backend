const redis = require('redis');

/**
 * Redis Service for caching and pub/sub
 * Supports both local Redis and cloud Redis providers
 */
class RedisService {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    
    // Configuration - Use REDIS_URL if available, otherwise fallback to individual config
    this.config = this.getRedisConfig();
    
    console.log('🔧 Redis config initialized:', {
      hasUrl: !!process.env.REDIS_URL,
      hasHost: !!process.env.REDIS_HOST,
      isLocal: !process.env.REDIS_URL && !process.env.REDIS_HOST
    });
  }

  /**
   * Get Redis configuration with proper fallbacks
   */
  getRedisConfig() {
    // Priority 1: REDIS_URL (for cloud providers like Railway, Heroku)
    if (process.env.REDIS_URL) {
      return {
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= this.maxRetries) {
              console.log('❌ Redis max retries reached, giving up');
              return false;
            }
            console.log(`🔄 Redis reconnecting in ${this.retryDelay}ms (attempt ${retries + 1}/${this.maxRetries})`);
            return this.retryDelay;
          },
          connectTimeout: 10000,
          lazyConnect: true
        }
      };
    }
    
    // Priority 2: Individual Redis config
    if (process.env.REDIS_HOST) {
      return {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= this.maxRetries) return false;
            return this.retryDelay;
          },
          connectTimeout: 10000,
          lazyConnect: true
        }
      };
    }
    
    // Priority 3: Local Redis fallback (development only)
    console.log('⚠️ No Redis config found, using local fallback (development only)');
    return {
      host: 'localhost',
      port: 6379,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= 2) return false; // Fail faster for local
          return 1000;
        },
        connectTimeout: 5000,
        lazyConnect: true
      }
    };
  }

  /**
   * Initialize Redis connections
   */
  async connect() {
    if (this.isConnected && this.client?.isReady) {
      console.log('✅ Redis already connected');
      return true;
    }

    try {
      console.log('🔄 Attempting Redis connection...');
      
      // Create primary client for cache operations
      this.client = redis.createClient(this.config);
      
      // Setup event handlers before connecting
      this.client.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
        
        // Try to reconnect after a delay if not at max retries
        if (this.retryAttempts < this.maxRetries) {
          this.retryAttempts++;
          console.log(`🔄 Will retry Redis connection (${this.retryAttempts}/${this.maxRetries})`);
        }
      });

      this.client.on('connect', () => {
        console.log('🔌 Redis connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connected and ready');
        this.isConnected = true;
        this.retryAttempts = 0; // Reset retry counter on successful connection
      });

      this.client.on('end', () => {
        console.log('🔌 Redis connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      // Connect with timeout
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      // For pub/sub, we'll create separate clients only if needed
      this.publisher = this.client;
      this.subscriber = this.client;

      console.log('✅ Redis service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      
      // Clean up failed connection
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors for failed connections
        }
        this.client = null;
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
      
      this.isConnected = false;
      console.log('✅ Redis disconnected');
    } catch (error) {
      console.error('❌ Redis disconnect error:', error.message);
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady() {
    return this.isConnected && this.client?.isReady;
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Set cache with TTL
   */
  async set(key, value, ttlSeconds = 3600) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping cache set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
      console.log(`📝 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
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
        console.log(`📖 Cache HIT: ${key}`);
        return JSON.parse(value);
      } else {
        console.log(`📭 Cache MISS: ${key}`);
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
      
      const result = await this.publisher.publish(channel, serialized);
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
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, cannot subscribe');
      return false;
    }

    try {
      await this.subscriber.subscribe(channel, (message) => {
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

  // ==================== ZOHO SPECIFIC HELPERS ====================

  /**
   * Cache Zoho API response
   */
  async cacheZohoData(reportName, filters, data, ttlSeconds = 300) {
    const cacheKey = this.generateZohoCacheKey(reportName, filters);
    return await this.set(cacheKey, {
      data,
      filters,
      cached_at: new Date().toISOString(),
      report: reportName
    }, ttlSeconds);
  }

  /**
   * Get cached Zoho data
   */
  async getCachedZohoData(reportName, filters) {
    const cacheKey = this.generateZohoCacheKey(reportName, filters);
    return await this.get(cacheKey);
  }

  /**
   * Publish Zoho data update
   */
  async publishZohoUpdate(reportName, eventId, updateType, data) {
    const channel = eventId ? `zoho:${reportName}:${eventId}` : `zoho:${reportName}:all`;
    
    return await this.publish(channel, {
      type: updateType, // 'update', 'create', 'delete', 'bulk_update'
      report: reportName,
      event_id: eventId,
      data: data,
      source: 'zoho_api'
    });
  }

  /**
   * Generate cache key for Zoho data
   */
  generateZohoCacheKey(reportName, filters = {}) {
    const filterStr = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key]}`)
      .join('|');
    
    return `zoho:${reportName}:${Buffer.from(filterStr).toString('base64')}`;
  }

  // ==================== BUFFER SYSTEM HELPERS ====================

  /**
   * Set hash field
   */
  async hset(key, field, value, ttlSeconds = null) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping cache set');
      return false;
    }

    try {
      const result = await this.client.hSet(key, field, value);
      
      // Set TTL if provided
      if (ttlSeconds) {
        await this.client.expire(key, ttlSeconds);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Redis HSET error:', error);
      return false;
    }
  }

  /**
   * Get hash field
   */
  async hget(key, field) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, cache miss');
      return null;
    }

    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      console.error('❌ Redis HGET error:', error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall(key) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, cache miss');
      return {};
    }

    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      console.error('❌ Redis HGETALL error:', error);
      return {};
    }
  }

  /**
   * Delete hash field
   */
  async hdel(key, field) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping cache delete');
      return false;
    }

    try {
      return await this.client.hDel(key, field);
    } catch (error) {
      console.error('❌ Redis HDEL error:', error);
      return false;
    }
  }

  /**
   * Add to sorted set
   */
  async zadd(key, score, member) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping sorted set add');
      return false;
    }

    try {
      return await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      console.error('❌ Redis ZADD error:', error);
      return false;
    }
  }

  /**
   * Get range from sorted set by score
   */
  async zrangebyscore(key, min, max) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, cache miss');
      return [];
    }

    try {
      return await this.client.zRangeByScore(key, min, max);
    } catch (error) {
      console.error('❌ Redis ZRANGEBYSCORE error:', error);
      return [];
    }
  }

  /**
   * Remove from sorted set
   */
  async zrem(key, member) {
    if (!this.isReady()) {
      console.warn('⚠️ Redis not ready, skipping sorted set remove');
      return false;
    }

    try {
      return await this.client.zRem(key, member);
    } catch (error) {
      console.error('❌ Redis ZREM error:', error);
      return false;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;
