const axios = require('axios');

async function testCacheProtection() {
  console.log('🧪 Testing cache miss protection...');
  
  const eventId = '4433256000012332047'; // Event ID từ log
  
  try {
    // Test 1: Normal request (should work)
    console.log('\n📋 Test 1: Normal request...');
    const response1 = await axios.get(`http://localhost:3000/api/cache/events/${eventId}`);
    console.log('Response 1:', {
      success: response1.data.success,
      count: response1.data.count,
      method: response1.data.metadata?.method
    });
    
    // Test 2: Second request (should trigger protection)
    console.log('\n📋 Test 2: Second request...');
    const response2 = await axios.get(`http://localhost:3000/api/cache/events/${eventId}`);
    console.log('Response 2:', {
      success: response2.data.success,
      count: response2.data.count,
      method: response2.data.metadata?.method
    });
    
    // Test 3: Third request (should trigger protection)
    console.log('\n📋 Test 3: Third request...');
    const response3 = await axios.get(`http://localhost:3000/api/cache/events/${eventId}`);
    console.log('Response 3:', {
      success: response3.data.success,
      count: response3.data.count,
      method: response3.data.metadata?.method
    });
    
    // Test 4: Fourth request (should be in cooldown)
    console.log('\n📋 Test 4: Fourth request (cooldown)...');
    const response4 = await axios.get(`http://localhost:3000/api/cache/events/${eventId}`);
    console.log('Response 4:', {
      success: response4.data.success,
      count: response4.data.count,
      method: response4.data.metadata?.method,
      message: response4.data.metadata?.message
    });
    
    // Test 5: Reset protection
    console.log('\n🔄 Test 5: Reset protection...');
    const resetResponse = await axios.post('http://localhost:3000/api/cache/reset-protection');
    console.log('Reset response:', resetResponse.data);
    
    // Test 6: After reset (should work again)
    console.log('\n📋 Test 6: After reset...');
    const response6 = await axios.get(`http://localhost:3000/api/cache/events/${eventId}`);
    console.log('Response 6:', {
      success: response6.data.success,
      count: response6.data.count,
      method: response6.data.metadata?.method
    });
    
  } catch (error) {
    console.error('❌ Error testing cache protection:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCacheProtection();
