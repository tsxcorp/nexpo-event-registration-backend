const redisPopulationService = require('./src/services/redisPopulationService');

async function testRedisPopulation() {
  console.log('🧪 Testing Redis population service...');
  
  // Test cache validation khi chưa có data
  console.log('\n🔍 Testing cache validation (empty)...');
  const isValidEmpty = await redisPopulationService.isCacheValid();
  console.log('Cache valid (empty):', isValidEmpty);
  
  // Test cache stats khi chưa có data
  console.log('\n📊 Testing cache stats (empty)...');
  const statsEmpty = await redisPopulationService.getCacheStats();
  console.log('Cache stats (empty):', statsEmpty);
  
  // Test manual population với mock data
  console.log('\n📝 Testing manual population with mock data...');
  
  // Mock Zoho data
  const mockZohoData = {
    data: Array.from({ length: 100 }, (_, i) => ({
      ID: `record_${i}`,
      Full_Name: `User ${i}`,
      Email: `user${i}@test.com`,
      Event_Info: {
        ID: i % 3 === 0 ? 'event_1' : 'event_2',
        display_value: `Event ${i % 3 === 0 ? '1' : '2'}`
      },
      Check_In_Status: i % 2 === 0 ? 'Checked In' : 'Not Yet',
      Group_Registration: i % 4 === 0 ? 'true' : 'false'
    }))
  };
  
  // Manually set cache data (simulate successful population)
  const redisService = require('./src/services/redisService');
  await redisService.connect();
  
  // Set cache data manually
  await redisService.set('zoho:all_registrations', mockZohoData.data, 1800);
  
  // Create event index
  const eventIndex = {};
  mockZohoData.data.forEach(record => {
    if (record.Event_Info && record.Event_Info.ID) {
      const eventId = record.Event_Info.ID;
      if (!eventIndex[eventId]) {
        eventIndex[eventId] = [];
      }
      eventIndex[eventId].push(record);
    }
  });
  
  await redisService.set('zoho:event_index', eventIndex, 1800);
  await redisService.set('zoho:cache_timestamp', Date.now(), 3600);
  await redisService.set('zoho:cache_version', Date.now(), 3600);
  
  console.log('✅ Mock data set in cache');
  console.log(`   - Records: ${mockZohoData.data.length}`);
  console.log(`   - Events: ${Object.keys(eventIndex).length}`);
  
  // Test cache validation sau khi có data
  console.log('\n🔍 Testing cache validation (with data)...');
  const isValidWithData = await redisPopulationService.isCacheValid();
  console.log('Cache valid (with data):', isValidWithData);
  
  // Test cache stats sau khi có data
  console.log('\n📊 Testing cache stats (with data)...');
  const statsWithData = await redisPopulationService.getCacheStats();
  console.log('Cache stats (with data):', statsWithData);
  
  // Test get event registrations
  console.log('\n🎯 Testing get event registrations...');
  const eventRegistrations = await redisPopulationService.getEventRegistrations('event_1');
  console.log('Event registrations for event_1:', {
    success: eventRegistrations.success,
    count: eventRegistrations.count,
    stats: eventRegistrations.stats
  });
  
  // List all keys
  console.log('\n🔍 Listing all keys...');
  const keys = await redisService.client.keys('*');
  console.log('All keys:', keys);
  
  await redisService.disconnect();
}

testRedisPopulation().catch(console.error);
