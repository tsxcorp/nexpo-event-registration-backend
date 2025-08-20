const axios = require('axios');
const fs = require('fs');

async function testZohoV21API() {
  console.log('🧪 Testing Zoho v2.1 API connection...');
  
  // Load tokens
  const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
  console.log('🔑 Tokens loaded:', {
    accessToken: tokens.accessToken ? tokens.accessToken.substring(0, 20) + '...' : 'null',
    expiresAt: new Date(tokens.expiresAt).toISOString(),
    isExpired: Date.now() > tokens.expiresAt
  });
  
  // Test v2.1 API call (same as app)
  const url = 'https://www.zohoapis.com/creator/v2.1/data/tsxcorp/nxp/report/All_Registrations';
  const params = {
    max_records: 200, // v2.1 only accepts 200, 500, 1000
    field_config: 'quick_view'
  };
  
  console.log('📡 Testing v2.1 API call to:', url);
  console.log('📋 Params:', params);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params
    });
    
    console.log('✅ v2.1 API call successful!');
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data length:', response.data?.data?.length || 0);
    console.log('📊 Response count:', response.data?.count || 0);
    
    if (response.data?.data && response.data.data.length > 0) {
      console.log('📋 First record sample:', JSON.stringify(response.data.data[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ v2.1 API call failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Code:', error.response?.data?.code);
    console.error('Description:', error.response?.data?.description);
    
    if (error.response?.status === 401) {
      console.log('🔑 401 error - token might be invalid or expired for v2.1 API');
    }
  }
}

testZohoV21API();
