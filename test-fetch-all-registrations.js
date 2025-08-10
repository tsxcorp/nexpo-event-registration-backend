const zohoCreatorAPI = require('./src/utils/zohoCreatorAPI');

async function testFetchAllRegistrations() {
  try {
    console.log('🚀 Testing fetch registrations data...');
    
    // Check environment variables
    console.log('\n🔧 Environment check:');
    console.log('- ZOHO_ORG_NAME:', process.env.ZOHO_ORG_NAME || 'NOT_SET');
    console.log('- ZOHO_APP_NAME:', process.env.ZOHO_APP_NAME || 'NOT_SET');
    console.log('- ZOHO_BASE_URL:', process.env.ZOHO_BASE_URL || 'NOT_SET');
    
    // Test different possible report and form names
    const dataSources = [
      // Reports
      { type: 'report', name: 'Registrations' },
      { type: 'report', name: 'All_Registrations' },
      { type: 'report', name: 'Registration_Data' },
      { type: 'report', name: 'Event_Registrations' },
      { type: 'report', name: 'Visitor_Registrations' },
      { type: 'report', name: 'All_Events' },
      { type: 'report', name: 'Events' },
      { type: 'report', name: 'All_Visitors' },
      { type: 'report', name: 'Visitors' },
      // Forms
      { type: 'form', name: 'Registrations' },
      { type: 'form', name: 'Registration' },
      { type: 'form', name: 'Event_Registration' },
      { type: 'form', name: 'Visitor_Registration' }
    ];
    
    for (const source of dataSources) {
      console.log(`\n📊 Testing ${source.type}: ${source.name}`);
      
      try {
        let result;
        
        if (source.type === 'report') {
          result = await zohoCreatorAPI.getReportRecords(source.name, {
            max_records: 10,
            useCache: false
          });
        } else if (source.type === 'form') {
          // For forms, we need to get records differently
          result = await zohoCreatorAPI.makeRequest('GET', `form/${source.name}`, null, {
            max_records: 10
          });
          result = {
            success: true,
            data: result.data || [],
            count: result.data ? result.data.length : 0,
            metadata: { has_more: false }
          };
        }
        
        console.log(`✅ ${source.type}/${source.name} result:`);
        console.log(`- Total records: ${result.count}`);
        console.log(`- Has more: ${result.metadata.has_more}`);
        
        if (result.data && result.data.length > 0) {
          console.log(`- Sample record keys: ${Object.keys(result.data[0]).join(', ')}`);
          console.log('\n📋 Sample record structure:');
          console.log(JSON.stringify(result.data[0], null, 2));
          
          // If we found data, let's analyze it
          console.log('\n📊 Data analysis:');
          
          // Count by event
          const eventCounts = {};
          const checkInStatus = { 'Checked In': 0, 'Not Yet': 0, 'Unknown': 0 };
          const groupRegistrations = { 'true': 0, 'false': 0, 'unknown': 0 };
          
          result.data.forEach(record => {
            // Event counts
            if (record.Event_Info && record.Event_Info.ID) {
              const eventId = record.Event_Info.ID;
              const eventName = record.Event_Info.display_value || `Event ${eventId}`;
              eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
            }
            
            // Check-in status
            if (record.Check_In_Status) {
              checkInStatus[record.Check_In_Status] = (checkInStatus[record.Check_In_Status] || 0) + 1;
            } else {
              checkInStatus['Unknown']++;
            }
            
            // Group registrations
            if (record.Group_Registration) {
              groupRegistrations[record.Group_Registration] = (groupRegistrations[record.Group_Registration] || 0) + 1;
            } else {
              groupRegistrations['unknown']++;
            }
          });
          
          console.log('\n🎯 Events found:');
          Object.entries(eventCounts).forEach(([eventName, count]) => {
            console.log(`- ${eventName}: ${count} registrations`);
          });
          
          console.log('\n✅ Check-in status:');
          Object.entries(checkInStatus).forEach(([status, count]) => {
            console.log(`- ${status}: ${count}`);
          });
          
          console.log('\n👥 Group registrations:');
          Object.entries(groupRegistrations).forEach(([isGroup, count]) => {
            console.log(`- ${isGroup}: ${count}`);
          });
          
          console.log('\n📈 Summary:');
          console.log(`- Total registrations: ${result.count}`);
          console.log(`- Unique events: ${Object.keys(eventCounts).length}`);
          console.log(`- Checked in: ${checkInStatus['Checked In']}`);
          console.log(`- Not yet: ${checkInStatus['Not Yet']}`);
          console.log(`- Group registrations: ${groupRegistrations['true']}`);
          console.log(`- Individual registrations: ${groupRegistrations['false']}`);
          
          // Found data, no need to test other sources
          break;
        }
        
      } catch (error) {
        console.log(`❌ ${source.type}/${source.name} failed: ${error.message}`);
      }
    }
    
    // Test getting app metadata to see what's available
    console.log('\n🔍 Testing to get app metadata...');
    try {
      const appMetadataResult = await zohoCreatorAPI.makeRequest('GET', 'meta/app');
      console.log('✅ App metadata result:', JSON.stringify(appMetadataResult, null, 2));
    } catch (error) {
      console.log(`❌ App metadata test failed: ${error.message}`);
    }
    
    // Test getting forms metadata
    console.log('\n🔍 Testing to get forms metadata...');
    try {
      const formsMetadataResult = await zohoCreatorAPI.makeRequest('GET', 'meta/forms');
      console.log('✅ Forms metadata result:', JSON.stringify(formsMetadataResult, null, 2));
    } catch (error) {
      console.log(`❌ Forms metadata test failed: ${error.message}`);
    }
    
    // Test getting reports metadata
    console.log('\n🔍 Testing to get reports metadata...');
    try {
      const reportsMetadataResult = await zohoCreatorAPI.makeRequest('GET', 'meta/reports');
      console.log('✅ Reports metadata result:', JSON.stringify(reportsMetadataResult, null, 2));
    } catch (error) {
      console.log(`❌ Reports metadata test failed: ${error.message}`);
    }
    
    // Test custom API endpoints that might have registration data
    console.log('\n🔍 Testing custom API endpoints...');
    const customEndpoints = [
      'NXP_getEventInfo',
      'NXP_getVisitor',
      'NXP_submitBusinessMatching',
      'NXP_getRegistrations',
      'NXP_getAllRegistrations'
    ];
    
    for (const endpoint of customEndpoints) {
      console.log(`\n📡 Testing custom endpoint: ${endpoint}`);
      try {
        const customResult = await zohoCreatorAPI.makeRequest('GET', `custom/${endpoint}`, null, {
          publickey: process.env.ZOHO_VISITOR_PUBLIC_KEY || 'test'
        });
        console.log(`✅ ${endpoint} result:`, JSON.stringify(customResult, null, 2));
      } catch (error) {
        console.log(`❌ ${endpoint} failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing fetch registrations:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
testFetchAllRegistrations();
