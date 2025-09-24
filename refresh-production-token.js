const axios = require('axios');

/**
 * Script to refresh Zoho token for production
 * Run this script to get new tokens and update Railway environment variables
 */

const ZOHO_CONFIG = {
  clientId: '1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS',
  clientSecret: '81077a708d14c58fdfa61e7df589992407b196e6fd',
  redirectUri: 'http://localhost:3000/oauth/callback',
  tokenEndpoint: 'https://accounts.zoho.com/oauth/v2/token'
};

async function refreshToken() {
  try {
    // Read current refresh token from tokens.json
    const fs = require('fs');
    const path = require('path');
    const tokenFile = path.join(process.cwd(), 'tokens.json');
    
    if (!fs.existsSync(tokenFile)) {
      console.error('❌ tokens.json not found. Please run generate-token.js first.');
      return;
    }
    
    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    const refreshToken = tokens.refreshToken || tokens.refresh_token;
    
    if (!refreshToken) {
      console.error('❌ No refresh token found in tokens.json');
      return;
    }
    
    console.log('🔄 Refreshing token...');
    
    const response = await axios.post(ZOHO_CONFIG.tokenEndpoint, {
      refresh_token: refreshToken,
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      grant_type: 'refresh_token'
    });
    
    const newTokens = response.data;
    const expiresAt = Date.now() + (newTokens.expires_in * 1000);
    
    console.log('✅ Token refreshed successfully!');
    console.log('\n📋 NEW TOKENS FOR PRODUCTION:');
    console.log('='.repeat(50));
    console.log(`ZOHO_ACCESS_TOKEN=${newTokens.access_token}`);
    console.log(`ZOHO_REFRESH_TOKEN=${refreshToken}`);
    console.log(`ZOHO_TOKEN_EXPIRES_AT=${expiresAt}`);
    console.log('='.repeat(50));
    
    console.log('\n🚀 INSTRUCTIONS FOR RAILWAY:');
    console.log('1. Go to Railway dashboard');
    console.log('2. Navigate to your project');
    console.log('3. Go to Variables tab');
    console.log('4. Update these environment variables:');
    console.log('   - ZOHO_ACCESS_TOKEN');
    console.log('   - ZOHO_REFRESH_TOKEN');
    console.log('   - ZOHO_TOKEN_EXPIRES_AT');
    console.log('5. Redeploy your application');
    
    // Update local tokens.json
    const updatedTokens = {
      ...tokens,
      accessToken: newTokens.access_token,
      access_token: newTokens.access_token,
      refreshToken: refreshToken,
      refresh_token: refreshToken,
      expiresAt: expiresAt,
      expires_at: expiresAt,
      expires_in: newTokens.expires_in,
      last_refresh: new Date().toISOString()
    };
    
    fs.writeFileSync(tokenFile, JSON.stringify(updatedTokens, null, 2));
    console.log('\n✅ Local tokens.json updated');
    
  } catch (error) {
    console.error('❌ Token refresh failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    
    console.log('\n💡 TROUBLESHOOTING:');
    console.log('1. Check if refresh token is still valid');
    console.log('2. If refresh token expired, run generate-token.js to get new tokens');
    console.log('3. Make sure client_id and client_secret are correct');
  }
}

// Run the refresh
refreshToken();
