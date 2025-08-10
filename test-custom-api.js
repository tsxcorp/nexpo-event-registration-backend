const axios = require('axios');

async function testCustomAPI() {
  try {
    console.log('🚀 Testing custom API endpoints...');
    
    // Configuration
    const ZOHO_BASE_URL = process.env.ZOHO_BASE_URL || 'https://creator.zoho.com';
    const ZOHO_ORG_NAME = process.env.ZOHO_ORG_NAME || 'tsxcorp';
    const ZOHO_PUBLIC_KEY = process.env.ZOHO_PUBLIC_KEY || 'test';
    
    console.log('\n🔧 Configuration:');
    console.log('- ZOHO_BASE_URL:', ZOHO_BASE_URL);
    console.log('- ZOHO_ORG_NAME:', ZOHO_ORG_NAME);
    console.log('- ZOHO_PUBLIC_KEY:', ZOHO_PUBLIC_KEY ? 'SET' : 'NOT_SET');
    
    // Test NXP_getEventInfo
    console.log('\n📋 Testing NXP_getEventInfo...');
    try {
      const eventApiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/NXP_getEventInfo`;
      console.log('URL:', eventApiUrl);
      
      const eventResponse = await axios.get(eventApiUrl, {
        headers: { Accept: 'application/json' },
        params: {
          event_id: 'NEXPO', // Get all events
          publickey: ZOHO_PUBLIC_KEY
        },
        responseType: 'text'
      });
      
      const eventData = JSON.parse(eventResponse.data);
      console.log('✅ NXP_getEventInfo result:');
      console.log(JSON.stringify(eventData, null, 2));
      
      if (eventData.events && Array.isArray(eventData.events)) {
        console.log(`\n📊 Found ${eventData.events.length} events:`);
        eventData.events.forEach((event, index) => {
          console.log(`${index + 1}. ${event.name} (ID: ${event.id})`);
        });
      }
      
    } catch (error) {
      console.log(`❌ NXP_getEventInfo failed: ${error.message}`);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // Test NXP_getVisitor
    console.log('\n📋 Testing NXP_getVisitor...');
    try {
      const visitorApiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/NXP_getVisitor`;
      console.log('URL:', visitorApiUrl);
      
      const visitorResponse = await axios.get(visitorApiUrl, {
        headers: { Accept: 'application/json' },
        params: {
          visid: 'test123', // Test visitor ID
          publickey: ZOHO_PUBLIC_KEY
        },
        responseType: 'text'
      });
      
      const visitorData = JSON.parse(visitorResponse.data);
      console.log('✅ NXP_getVisitor result:');
      console.log(JSON.stringify(visitorData, null, 2));
      
    } catch (error) {
      console.log(`❌ NXP_getVisitor failed: ${error.message}`);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    // Test for registration-related custom APIs
    console.log('\n📋 Testing registration-related custom APIs...');
    const registrationEndpoints = [
      'NXP_getRegistrations',
      'NXP_getAllRegistrations',
      'NXP_getRegistrationData',
      'NXP_getEventRegistrations'
    ];
    
    for (const endpoint of registrationEndpoints) {
      try {
        const apiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/${endpoint}`;
        console.log(`\nTesting: ${endpoint}`);
        console.log('URL:', apiUrl);
        
        const response = await axios.get(apiUrl, {
          headers: { Accept: 'application/json' },
          params: {
            publickey: ZOHO_PUBLIC_KEY
          },
          responseType: 'text'
        });
        
        const data = JSON.parse(response.data);
        console.log(`✅ ${endpoint} result:`);
        console.log(JSON.stringify(data, null, 2));
        
        // If we found registration data, analyze it
        if (data && (data.registrations || data.data || Array.isArray(data))) {
          const registrations = data.registrations || data.data || data;
          if (Array.isArray(registrations) && registrations.length > 0) {
            console.log(`\n📊 Found ${registrations.length} registrations in ${endpoint}`);
            console.log('Sample registration keys:', Object.keys(registrations[0]));
          }
        }
        
      } catch (error) {
        console.log(`❌ ${endpoint} failed: ${error.message}`);
        if (error.response) {
          console.log('Response status:', error.response.status);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing custom API:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
testCustomAPI();
