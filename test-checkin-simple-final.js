const axios = require('axios');

async function testCheckinSimpleFinal() {
  console.log('🧪 Testing simplified checkin API...');
  
  const checkinData = {
    "visitor": {
      "id": "4433256000013816013",
      "redeem_qr": "AWV10007760",
      "event_id": "4433256000012332047"
    }
  };
  
  try {
    console.log('📋 Test: Simplified checkin request...');
    console.log('Request data:', JSON.stringify(checkinData, null, 2));
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3000/api/visitors/checkin', checkinData, {
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Response received in', duration, 'ms');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Performance analysis
    if (duration < 2000) {
      console.log('🚀 Excellent performance! (< 2 seconds)');
    } else if (duration < 5000) {
      console.log('✅ Good performance! (< 5 seconds)');
    } else {
      console.log('⚠️ Slow performance (> 5 seconds)');
    }
    
  } catch (error) {
    console.error('❌ Error testing checkin API:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timeout after 30 seconds');
    }
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    if (error.request) {
      console.error('❌ No response received - request may be hanging');
    }
  }
}

testCheckinSimpleFinal();
