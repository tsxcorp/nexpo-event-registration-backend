const redisService = require('./src/services/redisService');
const redisPopulationService = require('./src/services/redisPopulationService');

async function testAppStartup() {
  console.log('🧪 Testing app startup flow...');
  
  // Simulate app startup
  console.log('\n🚀 Step 1: Initialize Redis service...');
  
  // Check Redis config
  console.log('🔧 Redis config:', {
    hasUrl: !!process.env.REDIS_URL,
    hasHost: !!process.env.REDIS_HOST,
    isLocal: !process.env.REDIS_URL && !process.env.REDIS_HOST
  });
  
  // Connect to Redis
  console.log('\n🔌 Step 2: Connect to Redis...');
  const connected = await redisService.connect();
  console.log('Redis connected:', connected);
  console.log('Redis ready:', redisService.isReady());
  
  // Test cache validation (should be invalid initially)
  console.log('\n🔍 Step 3: Check initial cache state...');
  const initialValid = await redisPopulationService.isCacheValid();
  console.log('Initial cache valid:', initialValid);
  
  // Simulate cache population
  console.log('\n📦 Step 4: Simulate cache population...');
  
  // Mock successful Zoho data fetch
  const mockData = {
    data: Array.from({ length: 50 }, (_, i) => ({
      ID: `record_${i}`,
      Full_Name: `User ${i}`,
      Email: `user${i}@test.com`,
      Event_Info: {
        ID: i % 2 === 0 ? 'event_1' : 'event_2',
        display_value: `Event ${i % 2 === 0 ? '1' : '2'}`
      },
      Check_In_Status: i % 2 === 0 ? 'Checked In' : 'Not Yet'
    }))
  };
  
  console.log(`📊 Mock data: ${mockData.data.length} records`);
  
  // Simulate populateFromZoho logic
  try {
    console.log('\n📝 Step 5: Set cache data...');
    
    // Store vào Redis với smart TTL
    await redisService.set('zoho:all_registrations', mockData.data, 1800);
    
    // Index theo event_id để query nhanh
    const eventIndex = {};
    mockData.data.forEach(record => {
      if (record.Event_Info && record.Event_Info.ID) {
        const eventId = record.Event_Info.ID;
        if (!eventIndex[eventId]) {
          eventIndex[eventId] = [];
        }
        eventIndex[eventId].push(record);
      }
    });
    
    // Store event index với smart TTL
    await redisService.set('zoho:event_index', eventIndex, 1800);
    
    // Store cache metadata với longer TTL
    await redisService.set('zoho:cache_timestamp', Date.now(), 3600);
    await redisService.set('zoho:cache_version', Date.now(), 3600);
    
    console.log('✅ Cache data set successfully');
    console.log(`   - Records: ${mockData.data.length}`);
    console.log(`   - Events: ${Object.keys(eventIndex).length}`);
    
  } catch (error) {
    console.error('❌ Error setting cache data:', error);
  }
  
  // Test cache validation after population
  console.log('\n🔍 Step 6: Check cache after population...');
  const finalValid = await redisPopulationService.isCacheValid();
  console.log('Final cache valid:', finalValid);
  
  // Test cache stats
  console.log('\n📊 Step 7: Check cache stats...');
  const stats = await redisPopulationService.getCacheStats();
  console.log('Cache stats:', stats);
  
  // Test get event registrations
  console.log('\n🎯 Step 8: Test get event registrations...');
  const registrations = await redisPopulationService.getEventRegistrations('event_1');
  console.log('Event 1 registrations:', {
    success: registrations.success,
    count: registrations.count,
    stats: registrations.stats
  });
  
  // List all keys
  console.log('\n🔍 Step 9: List all keys...');
  const keys = await redisService.client.keys('*');
  console.log('All keys:', keys);
  
  // Cleanup
  console.log('\n🧹 Step 10: Cleanup...');
  await redisService.disconnect();
  console.log('✅ Test completed');
}

testAppStartup().catch(console.error);
