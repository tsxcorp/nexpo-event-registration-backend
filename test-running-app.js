const axios = require('axios');

async function testRunningApp() {
  console.log('🧪 Testing running app...');
  
  try {
    // Test docs endpoint
    console.log('\n📘 Testing docs endpoint...');
    const docsResponse = await axios.get('http://localhost:3000/docs');
    console.log('Docs response status:', docsResponse.status);
    
    // Test cache refresh endpoint
    console.log('\n🔄 Testing cache refresh endpoint...');
    const refreshResponse = await axios.post('http://localhost:3000/api/cache/refresh');
    console.log('Cache refresh response:', refreshResponse.data);
    
    // Test cache population endpoint
    console.log('\n📦 Testing cache population endpoint...');
    const populationResponse = await axios.post('http://localhost:3000/api/cache/populate');
    console.log('Cache population response:', populationResponse.data);
    
    // Test cache clear endpoint
    console.log('\n🧹 Testing cache clear endpoint...');
    const clearResponse = await axios.post('http://localhost:3000/api/cache/clear');
    console.log('Cache clear response:', clearResponse.data);
    
  } catch (error) {
    console.error('❌ Error testing running app:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testRunningApp();
