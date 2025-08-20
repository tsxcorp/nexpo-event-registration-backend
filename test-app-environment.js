const axios = require('axios');

async function testAppEnvironment() {
  console.log('🧪 Testing app environment...');
  
  try {
    // Test app info endpoint (if exists)
    console.log('\n📋 Testing app info...');
    try {
      const infoResponse = await axios.get('http://localhost:3000/api/info');
      console.log('App info response:', infoResponse.data);
    } catch (error) {
      console.log('No app info endpoint');
    }
    
    // Test app config endpoint (if exists)
    console.log('\n⚙️ Testing app config...');
    try {
      const configResponse = await axios.get('http://localhost:3000/api/config');
      console.log('App config response:', configResponse.data);
    } catch (error) {
      console.log('No app config endpoint');
    }
    
    // Test app status endpoint (if exists)
    console.log('\n📊 Testing app status...');
    try {
      const statusResponse = await axios.get('http://localhost:3000/api/status');
      console.log('App status response:', statusResponse.data);
    } catch (error) {
      console.log('No app status endpoint');
    }
    
    // Test cache stats endpoint (if exists)
    console.log('\n📈 Testing cache stats...');
    try {
      const statsResponse = await axios.get('http://localhost:3000/api/cache/stats');
      console.log('Cache stats response:', statsResponse.data);
    } catch (error) {
      console.log('No cache stats endpoint');
    }
    
    // Test cache info endpoint (if exists)
    console.log('\nℹ️ Testing cache info...');
    try {
      const infoResponse = await axios.get('http://localhost:3000/api/cache/info');
      console.log('Cache info response:', infoResponse.data);
    } catch (error) {
      console.log('No cache info endpoint');
    }
    
  } catch (error) {
    console.error('❌ Error testing app environment:', error.message);
  }
}

testAppEnvironment();
