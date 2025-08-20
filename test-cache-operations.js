const redisService = require('./src/services/redisService');

async function testCacheOperations() {
  console.log('🧪 Testing cache operations...');
  
  // Connect to Redis
  await redisService.connect();
  
  // Check if Redis is ready
  console.log('🔧 Redis ready:', redisService.isReady());
  
  // Test basic SET/GET
  console.log('\n📝 Testing basic SET/GET...');
  
  const testKey = 'test:basic';
  const testData = { message: 'Hello World', timestamp: Date.now() };
  
  const setResult = await redisService.set(testKey, testData, 60);
  console.log('SET result:', setResult);
  
  const getResult = await redisService.get(testKey);
  console.log('GET result:', getResult);
  
  // Test zoho-like SET/GET
  console.log('\n📝 Testing zoho-like SET/GET...');
  
  const zohoKey = 'zoho:test_data';
  const zohoData = {
    data: [
      { id: 1, name: 'Test User 1', email: 'user1@test.com' },
      { id: 2, name: 'Test User 2', email: 'user2@test.com' }
    ],
    cached_at: new Date().toISOString()
  };
  
  const zohoSetResult = await redisService.set(zohoKey, zohoData, 300);
  console.log('Zoho SET result:', zohoSetResult);
  
  const zohoGetResult = await redisService.get(zohoKey);
  console.log('Zoho GET result:', zohoGetResult);
  
  // Test large data SET/GET (simulate real zoho data)
  console.log('\n📝 Testing large data SET/GET...');
  
  const largeKey = 'zoho:large_test';
  const largeData = {
    data: Array.from({ length: 1000 }, (_, i) => ({
      id: `record_${i}`,
      name: `User ${i}`,
      email: `user${i}@test.com`,
      event_id: 'test_event',
      status: i % 2 === 0 ? 'Checked In' : 'Not Yet'
    })),
    cached_at: new Date().toISOString()
  };
  
  const largeSetResult = await redisService.set(largeKey, largeData, 1800);
  console.log('Large SET result:', largeSetResult);
  
  const largeGetResult = await redisService.get(largeKey);
  console.log('Large GET result length:', largeGetResult?.data?.length || 0);
  
  // List all keys
  console.log('\n🔍 Listing all keys...');
  const keys = await redisService.client.keys('*');
  console.log('All keys:', keys);
  
  // Test cache validation logic
  console.log('\n🔍 Testing cache validation logic...');
  
  const timestamp = Date.now();
  const allRecords = largeData.data;
  const eventIndex = {
    'test_event': allRecords
  };
  
  // Set cache data
  await redisService.set('zoho:cache_timestamp', timestamp, 3600);
  await redisService.set('zoho:all_registrations', allRecords, 1800);
  await redisService.set('zoho:event_index', eventIndex, 1800);
  
  // Validate cache
  const cacheTimestamp = await redisService.get('zoho:cache_timestamp');
  const cacheRecords = await redisService.get('zoho:all_registrations') || [];
  const cacheEventIndex = await redisService.get('zoho:event_index') || {};
  
  console.log('Cache validation:');
  console.log(`   - timestamp: ${cacheTimestamp}`);
  console.log(`   - records length: ${Array.isArray(cacheRecords) ? cacheRecords.length : 'not array'}`);
  console.log(`   - event index keys: ${Object.keys(cacheEventIndex).length}`);
  
  const hasTimestamp = !!cacheTimestamp;
  const age = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
  const timeValid = age < (1800 * 1000);
  const hasData = Array.isArray(cacheRecords) && cacheRecords.length > 0 && Object.keys(cacheEventIndex).length > 0;
  
  console.log('Validation results:');
  console.log(`   - Has timestamp: ${hasTimestamp}`);
  console.log(`   - Time valid: ${timeValid}`);
  console.log(`   - Has data: ${hasData}`);
  console.log(`   - Overall valid: ${hasTimestamp && timeValid && hasData}`);
  
  await redisService.disconnect();
}

testCacheOperations().catch(console.error);
