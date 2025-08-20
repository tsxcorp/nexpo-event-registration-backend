const axios = require('axios');

async function testAppRedisConnection() {
  console.log('🧪 Testing app Redis connection...');
  
  try {
    // Test cache clear để xóa data test cũ
    console.log('\n🧹 Clearing cache...');
    const clearResponse = await axios.post('http://localhost:3000/api/cache/clear');
    console.log('Cache clear response:', clearResponse.data);
    
    // Test cache population để set data mới
    console.log('\n📦 Populating cache...');
    const populationResponse = await axios.post('http://localhost:3000/api/cache/populate');
    console.log('Cache population response:', populationResponse.data);
    
    // Test cache refresh để confirm
    console.log('\n🔄 Refreshing cache...');
    const refreshResponse = await axios.post('http://localhost:3000/api/cache/refresh');
    console.log('Cache refresh response:', refreshResponse.data);
    
    // Check Redis keys
    console.log('\n🔍 Checking Redis keys...');
    const { exec } = require('child_process');
    
    exec('redis-cli keys "zoho:*"', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking Redis keys:', error);
        return;
      }
      console.log('Redis keys:', stdout);
    });
    
    // Check Redis data
    setTimeout(() => {
      exec('redis-cli get "zoho:all_registrations" | head -c 200', (error, stdout, stderr) => {
        if (error) {
          console.error('Error checking Redis data:', error);
          return;
        }
        console.log('Redis data sample:', stdout);
      });
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error testing app Redis connection:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAppRedisConnection();
