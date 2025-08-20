const axios = require('axios');

async function testAppRedisDirect() {
  console.log('🧪 Testing app Redis connection directly...');
  
  try {
    // Test cache clear
    console.log('\n🧹 Clearing cache...');
    const clearResponse = await axios.post('http://localhost:3000/api/cache/clear');
    console.log('Cache clear response:', clearResponse.data);
    
    // Test cache population
    console.log('\n📦 Populating cache...');
    const populationResponse = await axios.post('http://localhost:3000/api/cache/populate');
    console.log('Cache population response:', populationResponse.data);
    
    // Test cache refresh
    console.log('\n🔄 Refreshing cache...');
    const refreshResponse = await axios.post('http://localhost:3000/api/cache/refresh');
    console.log('Cache refresh response:', refreshResponse.data);
    
    // Test cache clear again
    console.log('\n🧹 Clearing cache again...');
    const clearResponse2 = await axios.post('http://localhost:3000/api/cache/clear');
    console.log('Cache clear response 2:', clearResponse2.data);
    
    // Test cache population again
    console.log('\n📦 Populating cache again...');
    const populationResponse2 = await axios.post('http://localhost:3000/api/cache/populate');
    console.log('Cache population response 2:', populationResponse2.data);
    
    // Check Redis keys
    console.log('\n🔍 Checking Redis keys...');
    const { exec } = require('child_process');
    
    exec('redis-cli keys "zoho:*"', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking Redis keys:', error);
        return;
      }
      console.log('Redis keys:', stdout);
      
      if (stdout.trim()) {
        console.log('✅ App is using Redis localhost:6379');
      } else {
        console.log('❌ App is NOT using Redis localhost:6379');
        console.log('App is using a different Redis instance or service');
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing app Redis connection:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAppRedisDirect();
