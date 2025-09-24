require('dotenv').config();
const zohoOAuthService = require('./src/utils/zohoOAuthService');

async function testPrivateLink() {
  try {
    console.log('🔍 Testing private link generation...\n');
    
    const eventId = '4433256000013547003';
    const fieldName = 'Banner';
    const token = await zohoOAuthService.getValidAccessToken();
    
    // Test different approaches to get private link
    console.log('1️⃣ Testing direct download URL...');
    try {
      const axios = require('axios');
      const downloadUrl = `https://www.zohoapis.com/creator/v2.1/data/tsxcorp/nxp/report/All_Events/${eventId}/${fieldName}/download`;
      
      console.log('📞 Calling:', downloadUrl);
      
      const response = await axios.get(downloadUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('✅ Response status:', response.status);
      console.log('📊 Response headers:', Object.keys(response.headers));
      console.log('📋 Response data:', response.data);
      
    } catch (error) {
      console.log('❌ Direct download error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
    }
    
    console.log('\n2️⃣ Testing file info URL...');
    try {
      const axios = require('axios');
      const fileInfoUrl = `https://www.zohoapis.com/creator/v2.1/data/tsxcorp/nxp/report/All_Events/${eventId}/${fieldName}`;
      
      console.log('📞 Calling:', fileInfoUrl);
      
      const response = await axios.get(fileInfoUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('✅ Response status:', response.status);
      console.log('📊 Response data:', response.data);
      
    } catch (error) {
      console.log('❌ File info error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testPrivateLink();
