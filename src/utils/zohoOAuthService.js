const axios = require('axios');

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
   * Load tokens from file
   */
  loadTokensFromFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      const tokenFile = path.join(process.cwd(), 'tokens.json');
      
      if (fs.existsSync(tokenFile)) {
        const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        console.log('✅ Tokens loaded from file');
        return tokens;
      }
    } catch (error) {
      console.log('⚠️ Could not load tokens from file:', error.message);
    }
    
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null
    };
  }

  /**
   * Save tokens to file
   */
  saveTokensToFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      const tokenFile = path.join(process.cwd(), 'tokens.json');
      
      fs.writeFileSync(tokenFile, JSON.stringify(this.tokenStore, null, 2));
      console.log('✅ Tokens saved to file');
    } catch (error) {
      console.log('⚠️ Could not save tokens to file:', error.message);
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
      console.log('🔑 Exchanging authorization code for access token...');
      
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
        
        console.log('✅ Access token obtained successfully');
        console.log('📅 Token expires at:', new Date(this.tokenStore.expiresAt));
        
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
      console.error('❌ Error getting access token:', error.response?.data || error.message);
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
      console.log('🔄 Refreshing access token...');
      
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
        
        console.log('✅ Access token refreshed successfully');
        console.log('📅 New token expires at:', new Date(this.tokenStore.expiresAt));
        
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
      console.error('❌ Error refreshing access token:', error.response?.data || error.message);
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
   * Set tokens manually (for testing or if tokens are stored externally)
   * @param {Object} tokens - Token object with accessToken, refreshToken, expiresAt
   */
  setTokens(tokens) {
    this.tokenStore.accessToken = tokens.accessToken;
    this.tokenStore.refreshToken = tokens.refreshToken;
    this.tokenStore.expiresAt = tokens.expiresAt;
    console.log('✅ Tokens set manually');
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
    console.log('🗑️ All tokens cleared');
  }
}

// Export singleton instance
const zohoOAuthService = new ZohoOAuthService();
module.exports = zohoOAuthService;
