// Test Redis service trong app context
const redisService = require('./src/services/redisService');
const redisPopulationService = require('./src/services/redisPopulationService');

async function testAppRedis() {
  console.log('🧪 Testing Redis service in app context...');
  
  // Connect to Redis (same as app)
  await redisService.connect();
  
  // Check if Redis is ready
  console.log('🔧 Redis ready:', redisService.isReady());
  
  // Test cache validation (should be valid since we have data)
  console.log('\n🔍 Testing cache validation...');
  const isValid = await redisPopulationService.isCacheValid();
  console.log('Cache valid:', isValid);
  
  // Test cache stats
  console.log('\n📊 Testing cache stats...');
  const stats = await redisPopulationService.getCacheStats();
  console.log('Cache stats:', stats);
  
  // Test individual key access
  console.log('\n📋 Testing individual key access...');
  
  const keys = [
    'zoho:cache_timestamp',
    'zoho:all_registrations',
    'zoho:event_index',
    'zoho:cache_version'
  ];
  
  for (const key of keys) {
    console.log(`\n📋 Testing key: ${key}`);
    const value = await redisService.get(key);
    
    if (value === null) {
      console.log(`❌ Key not found: ${key}`);
    } else {
      console.log(`✅ Key found: ${key}`);
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          console.log(`   Type: Array, Length: ${value.length}`);
        } else {
          console.log(`   Type: Object, Keys: ${Object.keys(value).length}`);
        }
      } else {
        console.log(`   Type: ${typeof value}, Value: ${value}`);
      }
    }
  }
  
  // Test get event registrations
  console.log('\n🎯 Testing get event registrations...');
  const registrations = await redisPopulationService.getEventRegistrations('event_1');
  console.log('Event 1 registrations:', {
    success: registrations.success,
    count: registrations.count,
    stats: registrations.stats
  });
  
  // Test cache miss scenario (non-existent key)
  console.log('\n📭 Testing cache miss scenario...');
  const nonExistentKey = 'zoho:non_existent_key';
  const nonExistentValue = await redisService.get(nonExistentKey);
  console.log(`Non-existent key ${nonExistentKey}:`, nonExistentValue);
  
  // Test cache hit scenario (existing key)
  console.log('\n📖 Testing cache hit scenario...');
  const existingKey = 'zoho:cache_timestamp';
  const existingValue = await redisService.get(existingKey);
  console.log(`Existing key ${existingKey}:`, existingValue);
  
  // Test cache SET operation
  console.log('\n📝 Testing cache SET operation...');
  const testKey = 'zoho:test_app_key';
  const testData = { app_test: true, timestamp: Date.now() };
  
  const setResult = await redisService.set(testKey, testData, 300);
  console.log('SET result:', setResult);
  
  const getResult = await redisService.get(testKey);
  console.log('GET result:', getResult);
  
  // Cleanup test key
  await redisService.del(testKey);
  
  await redisService.disconnect();
  console.log('\n✅ Test completed');
}

testAppRedis().catch(console.error);
