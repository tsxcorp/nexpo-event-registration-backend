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
    
    // Configuration - Use REDIS_URL if available, otherwise fallback to individual config
    this.config = process.env.REDIS_URL ? {
      url: process.env.REDIS_URL
    } : {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    };
  }

  /**
   * Initialize Redis connections
   */
  async connect() {
    try {
      // Single client for cache operations (simplify for now)
      this.client = redis.createClient(this.config);
      
      // For pub/sub, we'll use the same client
      this.publisher = this.client;
      this.subscriber = this.client;

      // Error handler
      this.client.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      // Connect single client
      await this.client.connect();

      this.isConnected = true;
      console.log('✅ Redis connected successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.isConnected = false;
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
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;
