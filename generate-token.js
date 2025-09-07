#!/usr/bin/env node

/**
 * Zoho OAuth Token Generation Script
 * Generates new access token using authorization code
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const config = {
  clientId: '1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS',
  clientSecret: '81077a708d14c58fdfa61e7df589992407b196e6fd',
  tokenEndpoint: 'https://accounts.zoho.com/oauth/v2/token',
  scope: 'ZohoCreator.form.CREATE,ZohoCreator.report.READ,ZohoCreator.meta.form.READ'
};

async function generateToken() {
  try {
    console.log('🔑 Zoho OAuth Token Generation');
    console.log('================================');
    console.log('');
    console.log('1. Go to this URL to authorize:');
    console.log('');
    console.log(`https://accounts.zoho.com/oauth/v2/auth?scope=${encodeURIComponent(config.scope)}&client_id=${config.clientId}&response_type=code&redirect_uri=http://localhost:3000/oauth/callback&access_type=offline`);
    console.log('');
    console.log('2. After authorization, you will be redirected to:');
    console.log('   http://localhost:3000/oauth/callback?code=AUTHORIZATION_CODE');
    console.log('');
    console.log('3. Copy the AUTHORIZATION_CODE from the URL');
    console.log('');
    console.log('4. Run this script with the code:');
    console.log('   node generate-token.js YOUR_AUTHORIZATION_CODE');
    console.log('');
    
    // Check if authorization code provided
    const authCode = process.argv[2];
    if (!authCode) {
      console.log('❌ No authorization code provided');
      return;
    }
    
    console.log('🔄 Exchanging authorization code for access token...');
    
    // Exchange authorization code for access token
    const response = await axios.post(config.tokenEndpoint, {
      code: authCode,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:3000/oauth/callback'
    });
    
    const tokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000)
    };
    
    // Save tokens to file
    const tokenFile = path.join(__dirname, 'tokens.json');
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
    
    console.log('✅ Tokens generated successfully!');
    console.log('🆕 Access token:', tokens.accessToken.substring(0, 20) + '...');
    console.log('🔄 Refresh token:', tokens.refreshToken.substring(0, 20) + '...');
    console.log('📅 Token expires at:', new Date(tokens.expiresAt).toISOString());
    console.log('⏰ Token valid for:', Math.round((tokens.expiresAt - Date.now()) / 1000 / 60), 'minutes');
    console.log('');
    console.log('🎉 Ready to use! Backend should work now.');
    
    return tokens;
    
  } catch (error) {
    console.error('❌ Token generation failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateToken();
}

module.exports = { generateToken };
