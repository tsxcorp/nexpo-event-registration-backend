const redisBufferService = require('./redisBufferService');
const { submitRegistration } = require('../utils/zohoRegistrationSubmit');

/**
 * Buffer Scheduler Service
 * Automatically processes retry queue when API limit resets
 */
class BufferScheduler {
  constructor() {
    this.isRunning = false;
    this.retryInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Buffer scheduler already running');
      return;
    }

    console.log('🚀 Starting buffer scheduler...');
    this.isRunning = true;

    // Check retry queue every 5 minutes
    this.retryInterval = setInterval(async () => {
      await this.checkAndProcessRetryQueue();
    }, 5 * 60 * 1000);

    // Cleanup completed submissions every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupCompleted();
    }, 60 * 60 * 1000);

    // Initial check
    setTimeout(async () => {
      await this.checkAndProcessRetryQueue();
    }, 10000); // Wait 10 seconds after startup

    console.log('✅ Buffer scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Buffer scheduler not running');
      return;
    }

    console.log('🛑 Stopping buffer scheduler...');
    this.isRunning = false;

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('✅ Buffer scheduler stopped');
  }

  /**
   * Check and process retry queue
   */
  async checkAndProcessRetryQueue() {
    try {
      if (!redisBufferService) {
        console.log('⚠️ Redis buffer service not available');
        return;
      }

      const limitResetTime = await redisBufferService.getLimitResetTime();
      const now = new Date();

      // Check if it's time to retry (after limit reset time)
      if (limitResetTime && now >= limitResetTime) {
        console.log('🔄 API limit reset time reached, processing retry queue...');
        
        const result = await redisBufferService.processRetryQueue(submitRegistration);
        
        if (result.success) {
          console.log(`✅ Retry queue processed: ${result.results.processed} submissions`);
          console.log(`   - Successful: ${result.results.successful}`);
          console.log(`   - Failed: ${result.results.failed}`);
          
          // Clear the limit reset time since we've processed the queue
          await redisBufferService.setLimitResetTime(null);
        } else {
          console.error('❌ Failed to process retry queue:', result.error);
        }
      } else {
        const pendingSubmissions = await redisBufferService.getBufferedSubmissions('pending');
        if (pendingSubmissions.length > 0) {
          const timeUntilReset = limitResetTime ? Math.max(0, limitResetTime.getTime() - now.getTime()) : 0;
          const hoursUntilReset = Math.ceil(timeUntilReset / (1000 * 60 * 60));
          
          console.log(`⏰ ${pendingSubmissions.length} pending submissions, ${hoursUntilReset} hours until API limit reset`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking retry queue:', error);
    }
  }

  /**
   * Cleanup completed submissions
   */
  async cleanupCompleted() {
    try {
      console.log('🧹 Running scheduled cleanup...');
      
      const result = await redisBufferService.cleanupCompleted();
      
      if (result.success) {
        console.log(`✅ Cleanup completed: ${result.cleaned} submissions removed`);
      } else {
        console.error('❌ Cleanup failed:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasRetryInterval: !!this.retryInterval,
      hasCleanupInterval: !!this.cleanupInterval
    };
  }

  /**
   * Manually trigger retry queue processing
   */
  async manualRetry() {
    console.log('🔄 Manual retry triggered');
    return await this.checkAndProcessRetryQueue();
  }
}

// Export singleton instance
const bufferScheduler = new BufferScheduler();
module.exports = bufferScheduler;
