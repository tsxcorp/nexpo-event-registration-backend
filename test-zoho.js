const axios = require('axios');
const fs = require('fs');

async function testZohoAPI() {
  console.log('🧪 Testing Zoho API connection...');
  
  // Load tokens
  const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
  console.log('🔑 Tokens loaded:', {
    accessToken: tokens.accessToken ? tokens.accessToken.substring(0, 20) + '...' : 'null',
    expiresAt: new Date(tokens.expiresAt).toISOString(),
    isExpired: Date.now() > tokens.expiresAt
  });
  
  // Test API call
  const url = 'https://creator.zoho.com/api/v2/tsxcorp/nxp/report/All_Registrations';
  const params = {
    max_records: 10,
    field_config: 'quick_view'
  };
  
  console.log('📡 Testing API call to:', url);
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
    
    console.log('✅ API call successful!');
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data length:', response.data?.data?.length || 0);
    console.log('📊 Response count:', response.data?.count || 0);
    
    if (response.data?.data && response.data.data.length > 0) {
      console.log('📋 First record sample:', JSON.stringify(response.data.data[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ API call failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Code:', error.response?.data?.code);
    console.error('Description:', error.response?.data?.description);
    
    if (error.response?.status === 401) {
      console.log('🔑 401 error - token might be invalid or expired');
    }
  }
}

testZohoAPI();
