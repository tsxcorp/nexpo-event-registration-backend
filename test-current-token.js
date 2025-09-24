const axios = require('axios');
const fs = require('fs');

/**
 * Test current token and show status
 */

async function testCurrentToken() {
  try {
    // Check if tokens.json exists
    const tokenFile = 'tokens.json';
    if (!fs.existsSync(tokenFile)) {
      console.log('❌ tokens.json not found');
      return;
    }
    
    const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    const accessToken = tokens.accessToken || tokens.access_token;
    const refreshToken = tokens.refreshToken || tokens.refresh_token;
    
    if (!accessToken) {
      console.log('❌ No access token found');
      return;
    }
    
    console.log('🔍 Testing current token...');
    console.log('Access Token:', accessToken.substring(0, 20) + '...');
    console.log('Refresh Token:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'Not found');
    
    // Test API call
    const testUrl = 'https://creator.zoho.com/api/v2/tsxcorp/nxp/report/All_Events';
    const response = await axios.get(testUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      },
      params: {
        max_records: 1
      }
    });
    
    console.log('✅ Token is valid!');
    console.log('API Response Status:', response.status);
    
  } catch (error) {
    console.log('❌ Token test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      if (error.response.status === 401) {
        console.log('🔑 Token expired or invalid');
        console.log('📋 Need to generate new token');
      }
    } else {
      console.log('Error:', error.message);
    }
  }
}

testCurrentToken();
