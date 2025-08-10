const axios = require('axios');

async function testServerAPI() {
  try {
    console.log('🚀 Testing server API endpoints...');
    
    const baseUrl = 'http://localhost:3000';
    
    // Test events API
    console.log('\n📋 Testing events API...');
    try {
      const eventsResponse = await axios.get(`${baseUrl}/api/events?eventId=NEXPO`);
      console.log('✅ Events API response:');
      console.log('Status:', eventsResponse.status);
      console.log('Events count:', eventsResponse.data?.events?.length || 0);
      
      if (eventsResponse.data?.events && eventsResponse.data.events.length > 0) {
        console.log('\n📊 Available events:');
        eventsResponse.data.events.forEach((event, index) => {
          console.log(`${index + 1}. ${event.name} (ID: ${event.id})`);
        });
      }
    } catch (error) {
      console.log(`❌ Events API failed: ${error.message}`);
    }
    
    // Test event filtering API
    console.log('\n📋 Testing event filtering API...');
    try {
      const eventId = '4433256000012332047'; // Automation World VietNam
      const filteringResponse = await axios.get(`${baseUrl}/api/event-filtering/registrations/${eventId}`);
      console.log('✅ Event filtering API response:');
      console.log('Status:', filteringResponse.status);
      console.log('Registrations count:', filteringResponse.data?.count || 0);
      console.log('Total for event:', filteringResponse.data?.stats?.total_for_event || 0);
    } catch (error) {
      console.log(`❌ Event filtering API failed: ${error.message}`);
    }
    
    // Test events list API
    console.log('\n📋 Testing events list API...');
    try {
      const eventsListResponse = await axios.get(`${baseUrl}/api/event-filtering/events/list`);
      console.log('✅ Events list API response:');
      console.log('Status:', eventsListResponse.status);
      console.log('Total events:', eventsListResponse.data?.summary?.total_events || 0);
      console.log('Total registrations:', eventsListResponse.data?.summary?.total_registrations || 0);
    } catch (error) {
      console.log(`❌ Events list API failed: ${error.message}`);
    }
    
    // Test Zoho Creator API directly
    console.log('\n📋 Testing Zoho Creator API through server...');
    try {
      const zohoResponse = await axios.get(`${baseUrl}/api/zoho-creator/reports/All_Registrations/records`, {
        params: {
          max_records: 10
        }
      });
      console.log('✅ Zoho Creator API response:');
      console.log('Status:', zohoResponse.status);
      console.log('Records count:', zohoResponse.data?.count || 0);
    } catch (error) {
      console.log(`❌ Zoho Creator API failed: ${error.message}`);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // Test with different report names
    console.log('\n📋 Testing different report names...');
    const reportNames = ['Registrations', 'Events', 'Visitors'];
    
    for (const reportName of reportNames) {
      try {
        const reportResponse = await axios.get(`${baseUrl}/api/zoho-creator/reports/${reportName}/records`, {
          params: {
            max_records: 5
          }
        });
        console.log(`✅ ${reportName}: ${reportResponse.data?.count || 0} records`);
      } catch (error) {
        console.log(`❌ ${reportName} failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing server API:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
testServerAPI();
