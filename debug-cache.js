const redisService = require('./src/services/redisService');

async function debugCache() {
  console.log('🔍 Debugging Redis cache...');
  
  // Connect to Redis
  await redisService.connect();
  
  // Check if Redis is ready
  console.log('🔧 Redis ready:', redisService.isReady());
  
  // Check all zoho keys
  const keys = [
    'zoho:cache_timestamp',
    'zoho:all_registrations', 
    'zoho:event_index',
    'zoho:cache_version'
  ];
  
  for (const key of keys) {
    console.log(`\n📋 Checking key: ${key}`);
    const value = await redisService.get(key);
    
    if (value === null) {
      console.log(`❌ Key not found: ${key}`);
    } else {
      console.log(`✅ Key found: ${key}`);
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          console.log(`   Type: Array, Length: ${value.length}`);
          if (value.length > 0) {
            console.log(`   First item:`, JSON.stringify(value[0], null, 2));
          }
        } else {
          console.log(`   Type: Object, Keys: ${Object.keys(value).length}`);
          if (Object.keys(value).length > 0) {
            const firstKey = Object.keys(value)[0];
            console.log(`   First key: ${firstKey}, Value length: ${Array.isArray(value[firstKey]) ? value[firstKey].length : 'not array'}`);
          }
        }
      } else {
        console.log(`   Type: ${typeof value}, Value: ${value}`);
      }
    }
  }
  
  // Test cache validation logic
  console.log('\n🔍 Testing cache validation logic...');
  
  const timestamp = await redisService.get('zoho:cache_timestamp');
  const allRecords = await redisService.get('zoho:all_registrations') || [];
  const eventIndex = await redisService.get('zoho:event_index') || {};
  
  console.log('📊 Cache validation data:');
  console.log(`   - timestamp: ${timestamp}`);
  console.log(`   - allRecords type: ${typeof allRecords}, length: ${Array.isArray(allRecords) ? allRecords.length : 'not array'}`);
  console.log(`   - eventIndex type: ${typeof eventIndex}, keys: ${Object.keys(eventIndex).length}`);
  
  // Apply validation logic
  const hasTimestamp = !!timestamp;
  const age = timestamp ? Date.now() - timestamp : Infinity;
  const timeValid = age < (1800 * 1000); // 30 minutes
  const hasData = Array.isArray(allRecords) && allRecords.length > 0 && Object.keys(eventIndex).length > 0;
  
  console.log('🔍 Validation results:');
  console.log(`   - Has timestamp: ${hasTimestamp}`);
  console.log(`   - Age: ${age}ms (${Math.round(age/1000)}s)`);
  console.log(`   - Time valid: ${timeValid}`);
  console.log(`   - Has data: ${hasData}`);
  console.log(`   - Overall valid: ${hasTimestamp && timeValid && hasData}`);
  
  await redisService.disconnect();
}

debugCache().catch(console.error);
