const redisService = require('./redisService');

/**
 * Redis Buffer Service for handling API limit scenarios
 * Stores failed submissions and retries them when API limit resets
 */
class RedisBufferService {
  constructor() {
    this.bufferKey = 'zoho:buffer:failed_submissions';
    this.retryKey = 'zoho:buffer:retry_queue';
    this.statsKey = 'zoho:buffer:stats';
    this.limitResetKey = 'zoho:buffer:limit_reset_time';
  }

  /**
   * Add failed submission to buffer
   * @param {Object} submissionData - Registration data that failed
   * @param {string} reason - Reason for failure (e.g., 'API_LIMIT', 'NETWORK_ERROR')
   * @param {string} eventId - Event ID for grouping
   * @returns {Promise<Object>} Buffer result
   */
  async addToBuffer(submissionData, reason = 'API_LIMIT', eventId = null) {
    try {
      if (!redisService.isReady()) {
        console.log('⚠️ Redis not ready, cannot buffer submission');
        return { success: false, error: 'Redis not available' };
      }

      const bufferItem = {
        id: this.generateBufferId(),
        timestamp: new Date().toISOString(),
        submissionData,
        reason,
        eventId,
        attempts: 0,
        maxAttempts: 5,
        status: 'pending'
      };

      // Add to buffer with TTL (7 days)
      await redisService.hset(this.bufferKey, bufferItem.id, JSON.stringify(bufferItem), 7 * 24 * 60 * 60);
      
      // Add to retry queue
      await redisService.zadd(this.retryKey, Date.now(), bufferItem.id);
      
      // Update stats
      await this.updateStats('buffered', reason, eventId);
      
      console.log(`📦 Buffered submission ${bufferItem.id} (${reason})`);
      
      return {
        success: true,
        bufferId: bufferItem.id,
        message: `Submission buffered. Will retry when API limit resets.`
      };
      
    } catch (error) {
      console.error('❌ Error adding to buffer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all buffered submissions
   * @param {string} status - Filter by status ('pending', 'processing', 'completed', 'failed')
   * @returns {Promise<Array>} Buffered submissions
   */
  async getBufferedSubmissions(status = null) {
    try {
      if (!redisService.isReady()) {
        return [];
      }

      const submissions = await redisService.hgetall(this.bufferKey);
      const result = [];

      for (const [id, data] of Object.entries(submissions)) {
        const submission = JSON.parse(data);
        if (!status || submission.status === status) {
          result.push(submission);
        }
      }

      return result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
    } catch (error) {
      console.error('❌ Error getting buffered submissions:', error);
      return [];
    }
  }

  /**
   * Get submissions ready for retry
   * @returns {Promise<Array>} Submissions ready for retry
   */
  async getRetryQueue() {
    try {
      if (!redisService.isReady()) {
        return [];
      }

      const now = Date.now();
      const retryItems = await redisService.zrangebyscore(this.retryKey, 0, now);
      
      const submissions = [];
      for (const id of retryItems) {
        const data = await redisService.hget(this.bufferKey, id);
        if (data) {
          const submission = JSON.parse(data);
          if (submission.status === 'pending' && submission.attempts < submission.maxAttempts) {
            submissions.push(submission);
          }
        }
      }

      return submissions;
      
    } catch (error) {
      console.error('❌ Error getting retry queue:', error);
      return [];
    }
  }

  /**
   * Process retry queue
   * @param {Function} submitFunction - Function to submit registration
   * @returns {Promise<Object>} Processing result
   */
  async processRetryQueue(submitFunction) {
    try {
      if (!redisService.isReady()) {
        return { success: false, error: 'Redis not available' };
      }

      const retryQueue = await this.getRetryQueue();
      console.log(`🔄 Processing retry queue: ${retryQueue.length} submissions`);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      };

      for (const submission of retryQueue) {
        try {
          // Update status to processing
          await this.updateSubmissionStatus(submission.id, 'processing');
          
          // Attempt submission
          const result = await submitFunction(submission.submissionData);
          
          if (result.success && result.zoho_record_id) {
            // Success - mark as completed
            await this.updateSubmissionStatus(submission.id, 'completed', result);
            results.successful++;
            console.log(`✅ Retry successful for ${submission.id}`);
          } else {
            // Still failed - increment attempts
            await this.incrementAttempts(submission.id);
            results.failed++;
            console.log(`❌ Retry failed for ${submission.id}: ${result.error || 'Unknown error'}`);
          }
          
          results.processed++;
          
          // Add delay between retries to avoid rate limiting
          await this.sleep(1000);
          
        } catch (error) {
          console.error(`❌ Error processing retry for ${submission.id}:`, error);
          await this.incrementAttempts(submission.id);
          results.failed++;
        }
      }

      // Update stats
      await this.updateStats('processed', 'retry', null, results);
      
      return {
        success: true,
        results,
        message: `Processed ${results.processed} submissions: ${results.successful} successful, ${results.failed} failed`
      };
      
    } catch (error) {
      console.error('❌ Error processing retry queue:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update submission status
   * @param {string} bufferId - Buffer ID
   * @param {string} status - New status
   * @param {Object} result - Optional result data
   */
  async updateSubmissionStatus(bufferId, status, result = null) {
    try {
      const data = await redisService.hget(this.bufferKey, bufferId);
      if (data) {
        const submission = JSON.parse(data);
        submission.status = status;
        submission.lastAttempt = new Date().toISOString();
        if (result) {
          submission.result = result;
        }
        
        await redisService.hset(this.bufferKey, bufferId, JSON.stringify(submission));
      }
    } catch (error) {
      console.error('❌ Error updating submission status:', error);
    }
  }

  /**
   * Increment attempt count
   * @param {string} bufferId - Buffer ID
   */
  async incrementAttempts(bufferId) {
    try {
      const data = await redisService.hget(this.bufferKey, bufferId);
      if (data) {
        const submission = JSON.parse(data);
        submission.attempts++;
        submission.lastAttempt = new Date().toISOString();
        
        // Set next retry time (exponential backoff)
        const backoffDelay = Math.min(30000 * Math.pow(2, submission.attempts), 300000); // Max 5 minutes
        const nextRetry = Date.now() + backoffDelay;
        
        await redisService.hset(this.bufferKey, bufferId, JSON.stringify(submission));
        await redisService.zadd(this.retryKey, nextRetry, bufferId);
      }
    } catch (error) {
      console.error('❌ Error incrementing attempts:', error);
    }
  }

  /**
   * Update buffer statistics
   * @param {string} action - Action type ('buffered', 'processed', 'retry')
   * @param {string} reason - Reason for buffering
   * @param {string} eventId - Event ID
   * @param {Object} results - Optional results data
   */
  async updateStats(action, reason, eventId = null, results = null) {
    try {
      const stats = await redisService.get(this.statsKey) || {};
      const parsedStats = typeof stats === 'string' ? JSON.parse(stats) : stats;
      
      const today = new Date().toISOString().split('T')[0];
      if (!parsedStats[today]) {
        parsedStats[today] = {
          buffered: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          byReason: {},
          byEvent: {}
        };
      }
      
      parsedStats[today][action]++;
      
      if (reason) {
        parsedStats[today].byReason[reason] = (parsedStats[today].byReason[reason] || 0) + 1;
      }
      
      if (eventId) {
        parsedStats[today].byEvent[eventId] = (parsedStats[today].byEvent[eventId] || 0) + 1;
      }
      
      if (results) {
        parsedStats[today].successful += results.successful || 0;
        parsedStats[today].failed += results.failed || 0;
      }
      
      await redisService.set(this.statsKey, JSON.stringify(parsedStats), 30 * 24 * 60 * 60); // 30 days TTL
      
    } catch (error) {
      console.error('❌ Error updating stats:', error);
    }
  }

  /**
   * Get buffer statistics
   * @returns {Promise<Object>} Buffer statistics
   */
  async getStats() {
    try {
      const stats = await redisService.get(this.statsKey);
      return stats ? JSON.parse(stats) : {};
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return {};
    }
  }

  /**
   * Clear completed submissions (older than 7 days)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupCompleted() {
    try {
      const submissions = await this.getBufferedSubmissions('completed');
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      let cleaned = 0;
      for (const submission of submissions) {
        if (new Date(submission.lastAttempt) < cutoffDate) {
          await redisService.hdel(this.bufferKey, submission.id);
          await redisService.zrem(this.retryKey, submission.id);
          cleaned++;
        }
      }
      
      console.log(`🧹 Cleaned up ${cleaned} completed submissions`);
      return { success: true, cleaned };
      
    } catch (error) {
      console.error('❌ Error cleaning up completed submissions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set API limit reset time
   * @param {Date|null} resetTime - When API limit resets, or null to clear
   */
  async setLimitResetTime(resetTime) {
    try {
      if (resetTime === null) {
        // Clear the limit reset time
        await redisService.del(this.limitResetKey);
        console.log('✅ API limit reset time cleared');
      } else if (resetTime instanceof Date) {
        // Set the limit reset time
        await redisService.set(this.limitResetKey, resetTime.toISOString(), 24 * 60 * 60); // 24 hours TTL
        console.log(`✅ API limit reset time set to: ${resetTime.toISOString()}`);
      } else {
        console.warn('⚠️ Invalid resetTime provided to setLimitResetTime:', resetTime);
      }
    } catch (error) {
      console.error('❌ Error setting limit reset time:', error);
    }
  }

  /**
   * Get API limit reset time
   * @returns {Promise<Date|null>} Reset time
   */
  async getLimitResetTime() {
    try {
      const resetTime = await redisService.get(this.limitResetKey);
      return resetTime ? new Date(resetTime) : null;
    } catch (error) {
      console.error('❌ Error getting limit reset time:', error);
      return null;
    }
  }

  /**
   * Generate unique buffer ID
   * @returns {string} Buffer ID
   */
  generateBufferId() {
    return `buf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const redisBufferService = new RedisBufferService();
module.exports = redisBufferService;
