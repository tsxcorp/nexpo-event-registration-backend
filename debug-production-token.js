#!/usr/bin/env node

/**
 * Debug script for production token issues
 * Usage: node debug-production-token.js
 */

const axios = require('axios');

console.log('🔍 Production Token Debug Script');
console.log('================================');

// 1. Check Environment Variables
console.log('\n1️⃣ Environment Variables:');
console.log('ZOHO_ACCESS_TOKEN:', process.env.ZOHO_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
console.log('ZOHO_REFRESH_TOKEN:', process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
console.log('ZOHO_TOKEN_EXPIRES_AT:', process.env.ZOHO_TOKEN_EXPIRES_AT ? '✅ Set' : '❌ Missing');
console.log('ZOHO_ORG_NAME:', process.env.ZOHO_ORG_NAME ? '✅ Set' : '❌ Missing');
console.log('ZOHO_APP_NAME:', process.env.ZOHO_APP_NAME ? '✅ Set' : '❌ Missing');

// 2. Load OAuth Service
console.log('\n2️⃣ OAuth Service Status:');
try {
  const zohoOAuth = require('./src/utils/zohoOAuthService');
  const tokenStatus = zohoOAuth.getTokenStatus();
  console.log('Token Status:', tokenStatus);
  
  // 3. Test Token with API Call
  console.log('\n3️⃣ Testing Token with API:');
  testTokenWithAPI(zohoOAuth);
  
} catch (error) {
  console.error('❌ Error loading OAuth service:', error.message);
}

async function testTokenWithAPI(zohoOAuth) {
  try {
    const token = await zohoOAuth.getValidAccessToken();
    console.log('✅ Token obtained:', token ? 'Valid' : 'Invalid');
    
    // Test with a simple API call
    const testUrl = `https://creator.zoho.com/api/v2/tsxcorp/nxp/report/All_Events`;
    console.log('\n4️⃣ Testing API Call:');
    console.log('URL:', testUrl);
    console.log('Token:', token ? `${token.substring(0, 20)}...` : 'None');
    
    const response = await axios.get(testUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Accept': 'application/json'
      },
      params: {
        max_records: 1
      }
    });
    
    console.log('✅ API Call Success:', response.status);
    console.log('Response keys:', Object.keys(response.data));
    
  } catch (error) {
    console.error('❌ API Call Failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Response:', error.response?.data);
    
    if (error.response?.status === 401) {
      console.log('\n🔄 Attempting token refresh...');
      try {
        await zohoOAuth.refreshAccessToken();
        console.log('✅ Token refreshed successfully');
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError.message);
      }
    }
  }
}

// 5. Check tokens.json file
console.log('\n5️⃣ tokens.json file:');
try {
  const fs = require('fs');
  const tokens = JSON.parse(fs.readFileSync('./tokens.json', 'utf8'));
  console.log('File exists:', '✅ Yes');
  console.log('Access token:', tokens.accessToken ? `${tokens.accessToken.substring(0, 20)}...` : 'Missing');
  console.log('Refresh token:', tokens.refreshToken ? `${tokens.refreshToken.substring(0, 20)}...` : 'Missing');
  console.log('Expires at:', tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : 'Missing');
} catch (error) {
  console.log('File exists:', '❌ No or corrupted');
  console.error('Error:', error.message);
}
