#!/usr/bin/env node

/**
 * Zoho OAuth Token Refresh Script
 * Refreshes expired access token using refresh token
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const config = {
  clientId: '1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS',
  clientSecret: '81077a708d14c58fdfa61e7df589992407b196e6fd',
  tokenEndpoint: 'https://accounts.zoho.com/oauth/v2/token'
};

async function refreshToken() {
  try {
    // Load current tokens
    const tokenFile = path.join(__dirname, 'tokens.json');
    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    
    console.log('🔄 Refreshing Zoho OAuth token...');
    console.log('📅 Current token expires at:', new Date(tokens.expiresAt).toISOString());
    
    // Make refresh request
    const response = await axios.post(config.tokenEndpoint, {
      refresh_token: tokens.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token'
    });
    
    const newTokens = {
      accessToken: response.data.access_token,
      refreshToken: tokens.refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + (response.data.expires_in * 1000)
    };
    
    // Save new tokens
    fs.writeFileSync(tokenFile, JSON.stringify(newTokens, null, 2));
    
    console.log('✅ Token refreshed successfully!');
    console.log('🆕 New access token:', newTokens.accessToken.substring(0, 20) + '...');
    console.log('📅 New token expires at:', new Date(newTokens.expiresAt).toISOString());
    console.log('⏰ Token valid for:', Math.round((newTokens.expiresAt - Date.now()) / 1000 / 60), 'minutes');
    
    return newTokens;
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  refreshToken();
}

module.exports = { refreshToken };
