/**
 * Production-Optimized Logger
 * Reduces logging rate to avoid Railway rate limits (500 logs/sec)
 */

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.logCount = 0;
    this.lastLogTime = Date.now();
    this.logBuffer = [];
    this.maxLogsPerSecond = this.isProduction ? 50 : 500; // Reduce in production
    this.bufferSize = 100;
    
    // Log levels priority
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
  }

  shouldLog(level) {
    // Check log level
    if (this.levels[level] > this.levels[this.logLevel]) {
      return false;
    }

    // Rate limiting in production
    if (this.isProduction) {
      const now = Date.now();
      const timeDiff = now - this.lastLogTime;
      
      if (timeDiff >= 1000) { // Reset counter every second
        this.logCount = 0;
        this.lastLogTime = now;
      }
      
      if (this.logCount >= this.maxLogsPerSecond) {
        return false; // Drop log
      }
      
      this.logCount++;
    }

    return true;
  }

  log(level, message, ...args) {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (this.isProduction) {
      // In production, use console methods without emojis to reduce size
      switch (level) {
        case 'ERROR':
          console.error(logMessage, ...args);
          break;
        case 'WARN':
          console.warn(logMessage, ...args);
          break;
        case 'INFO':
          console.log(logMessage, ...args);
          break;
        case 'DEBUG':
          console.log(logMessage, ...args);
          break;
      }
    } else {
      // In development, use emojis for better readability
      const emoji = this.getEmoji(level);
      console.log(`${emoji} ${logMessage}`, ...args);
    }
  }

  getEmoji(level) {
    const emojis = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔍'
    };
    return emojis[level] || '📝';
  }

  // Convenience methods
  error(message, ...args) {
    this.log('ERROR', message, ...args);
  }

  warn(message, ...args) {
    this.log('WARN', message, ...args);
  }

  info(message, ...args) {
    this.log('INFO', message, ...args);
  }

  debug(message, ...args) {
    this.log('DEBUG', message, ...args);
  }

  // Batch logging for high-volume operations
  batchLog(level, messages) {
    if (!this.isProduction) {
      messages.forEach(msg => this.log(level, msg));
      return;
    }

    // In production, batch logs to reduce rate
    if (messages.length > 10) {
      this.log(level, `Batch: ${messages.length} operations completed`);
    } else {
      messages.forEach(msg => this.log(level, msg));
    }
  }

  // Critical logs that should always be shown
  critical(message, ...args) {
    console.error(`🚨 CRITICAL: ${message}`, ...args);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
