const axios = require('axios');
// Use console.log fallback for production compatibility
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};

/**
 * Zoho Creator OAuth 2.0 Service
 * Handles access token management, refresh tokens, and API authentication
 */
class ZohoOAuthService {
  constructor() {
    this.config = {
      accountOwnerName: 'tsxcorp',
      appLinkName: 'nxp',
      clientId: '1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS',
      clientSecret: '81077a708d14c58fdfa61e7df589992407b196e6fd',
      scope: 'ZohoCreator.form.CREATE,ZohoCreator.report.READ,ZohoCreator.meta.form.READ',
      redirectUri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
      tokenEndpoint: 'https://accounts.zoho.com/oauth/v2/token',
      authEndpoint: 'https://accounts.zoho.com/oauth/v2/auth',
      apiBaseUrl: 'https://creator.zoho.com/api/v2'
    };
    
    // Token storage (load from file if exists)
    this.tokenStore = this.loadTokensFromFile();
  }

  /**
   * Load tokens from environment variables or file
   */
  loadTokensFromFile() {
    // Try environment variables first (for production)
    if (process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_REFRESH_TOKEN) {
      logger.info("Tokens loaded from environment variables");
      return {
        accessToken: process.env.ZOHO_ACCESS_TOKEN,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN,
        expiresAt: process.env.ZOHO_TOKEN_EXPIRES_AT ? parseInt(process.env.ZOHO_TOKEN_EXPIRES_AT) : null
      };
    }
    
    // Fallback to file (for local development)
    try {
      const fs = require('fs');
      const path = require('path');
      const tokenFile = path.join(process.cwd(), 'tokens.json');
      
      if (fs.existsSync(tokenFile)) {
        const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        logger.info("Tokens loaded from file");
        return tokens;
      }
    } catch (error) {
      logger.info("⚠️ Could not load tokens from file:", error.message);
    }
    
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null
    };
  }

  /**
   * Save tokens to file or environment (production)
   */
  saveTokensToFile() {
    // In production, we can't modify environment variables at runtime
    // But we can log the new tokens for manual update
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
      logger.info("🔄 NEW TOKENS FOR PRODUCTION:");
      logger.info(`ZOHO_ACCESS_TOKEN=${this.tokenStore.accessToken}`);
      logger.info(`ZOHO_REFRESH_TOKEN=${this.tokenStore.refreshToken}`);
      logger.info(`ZOHO_TOKEN_EXPIRES_AT=${this.tokenStore.expiresAt}`);
      logger.info("Please update these environment variables in Railway dashboard");
      return;
    }
    
    // Save to file for local development
    try {
      const fs = require('fs');
      const path = require('path');
      const tokenFile = path.join(process.cwd(), 'tokens.json');
      
      fs.writeFileSync(tokenFile, JSON.stringify(this.tokenStore, null, 2));
      logger.info("Tokens saved to file");
    } catch (error) {
      logger.info("⚠️ Could not save tokens to file:", error.message);
    }
  }

  /**
   * Get authorization URL for OAuth flow
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scope,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${this.config.authEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Object} Token response
   */
  async getAccessToken(code) {
    try {
      logger.info('🔑 Exchanging authorization code for access token...');
      
      const response = await axios.post(this.config.tokenEndpoint, null, {
        params: {
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          code: code
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      
      if (tokenData.access_token) {
        // Store tokens
        this.tokenStore.accessToken = tokenData.access_token;
        this.tokenStore.refreshToken = tokenData.refresh_token;
        this.tokenStore.expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        // Save to file
        this.saveTokensToFile();
        
        logger.info("Access token obtained successfully");
        logger.info('📅 Token expires at:', new Date(this.tokenStore.expiresAt));
        
        return {
          success: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          expiresAt: this.tokenStore.expiresAt
        };
      } else {
        throw new Error('No access token in response');
      }
    } catch (error) {
      logger.error("Error getting access token:", error.response?.data || error.message);
      throw new Error(`Failed to get access token: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @returns {Object} New token response
   */
  async refreshAccessToken() {
    if (!this.tokenStore.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      logger.info("Refreshing access token...");
      
      const response = await axios.post(this.config.tokenEndpoint, null, {
        params: {
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.tokenStore.refreshToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      
      if (tokenData.access_token) {
        // Update stored tokens
        this.tokenStore.accessToken = tokenData.access_token;
        if (tokenData.refresh_token) {
          this.tokenStore.refreshToken = tokenData.refresh_token;
        }
        this.tokenStore.expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        // Save to file
        this.saveTokensToFile();
        
        logger.info("Access token refreshed successfully");
        logger.info('📅 New token expires at:', new Date(this.tokenStore.expiresAt));
        
        return {
          success: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || this.tokenStore.refreshToken,
          expiresIn: tokenData.expires_in,
          expiresAt: this.tokenStore.expiresAt
        };
      } else {
        throw new Error('No access token in refresh response');
      }
    } catch (error) {
      logger.error("Error refreshing access token:", error.response?.data || error.message);
      throw new Error(`Failed to refresh access token: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get valid access token (refresh if needed)
   * @returns {string} Valid access token
   */
  async getValidAccessToken() {
    // Check if we have a token and it's not expired
    if (this.tokenStore.accessToken && this.tokenStore.expiresAt) {
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
      if (Date.now() < (this.tokenStore.expiresAt - bufferTime)) {
        return this.tokenStore.accessToken;
      }
    }

    // Token is expired or doesn't exist, try to refresh
    if (this.tokenStore.refreshToken) {
      await this.refreshAccessToken();
      return this.tokenStore.accessToken;
    }

    throw new Error('No valid access token and no refresh token available. Please re-authenticate.');
  }

  /**
   * Execute a Zoho API call with automatic token refresh and retry
   * @param {Function} apiCall - Function that makes the API call
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Object} API response
   */
  async executeWithTokenRefresh(apiCall, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Get valid token before each attempt
        const token = await this.getValidAccessToken();
        
        // Execute the API call
        const response = await apiCall(token);
        
        // If successful, return the response
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Check if it's a 401 error and we haven't exhausted retries
        if (error.response?.status === 401 && attempt < maxRetries) {
          logger.info("401 error on attempt ${attempt + 1}, refreshing token and retrying...");
          
          try {
            // Force refresh token
            await this.refreshAccessToken();
            logger.info("Token refreshed, retrying API call...");
            continue; // Retry with new token
          } catch (refreshError) {
            logger.error("Token refresh failed:", refreshError.message);
            throw new Error(`API call failed and token refresh unsuccessful: ${refreshError.message}`);
          }
        }
        
        // If not 401 or max retries reached, throw the error
        throw error;
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Set tokens manually (for testing or if tokens are stored externally)
   * @param {Object} tokens - Token object with accessToken, refreshToken, expiresAt
   */
  setTokens(tokens) {
    this.tokenStore.accessToken = tokens.accessToken;
    this.tokenStore.refreshToken = tokens.refreshToken;
    this.tokenStore.expiresAt = tokens.expiresAt;
    logger.info("Tokens set manually");
  }

  /**
   * Get current token status
   * @returns {Object} Token status information
   */
  getTokenStatus() {
    const hasAccessToken = !!this.tokenStore.accessToken;
    const hasRefreshToken = !!this.tokenStore.refreshToken;
    const isExpired = this.tokenStore.expiresAt ? Date.now() >= this.tokenStore.expiresAt : true;
    
    return {
      hasAccessToken,
      hasRefreshToken,
      isExpired,
      expiresAt: this.tokenStore.expiresAt ? new Date(this.tokenStore.expiresAt) : null,
      expiresIn: this.tokenStore.expiresAt ? Math.max(0, this.tokenStore.expiresAt - Date.now()) : 0
    };
  }

  /**
   * Clear all stored tokens
   */
  clearTokens() {
    this.tokenStore = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null
    };
    logger.info('🗑️ All tokens cleared');
  }

  /**
   * Start auto-refresh timer to prevent token expiration
   */
  startAutoRefreshTimer() {
    // Check every 30 minutes
    setInterval(async () => {
      try {
        // Check if token will expire in next 10 minutes
        if (this.tokenStore.accessToken && this.tokenStore.expiresAt) {
          const tenMinutesFromNow = Date.now() + (10 * 60 * 1000);
          
          if (this.tokenStore.expiresAt < tenMinutesFromNow) {
            logger.info("⏰ Token expiring soon, proactively refreshing...");
            await this.refreshAccessToken();
            logger.info("Proactive token refresh completed");
          }
        }
      } catch (error) {
        logger.error("Auto-refresh timer error:", error.message);
      }
    }, 30 * 60 * 1000); // Every 30 minutes
    
    logger.info("⏰ Auto-refresh timer started (checks every 30 minutes)");
  }
}

// Export singleton instance
const zohoOAuthService = new ZohoOAuthService();
module.exports = zohoOAuthService;
