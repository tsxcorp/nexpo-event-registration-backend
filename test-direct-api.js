const axios = require('axios');

async function testDirectAPI() {
  try {
    console.log('🚀 Testing Zoho Creator API directly with new token...');
    
    // New access token
    const accessToken = '1000.b06b658c6a8029a2786bb5706b8dcc58.29bf913f3afda769617aa5890a97e791';
    
    // Configuration
    const baseUrl = 'https://creator.zoho.com/api/v2';
    const accountOwnerName = 'tsxcorp';
    const appLinkName = 'nxp';
    
    console.log('\n🔧 Configuration:');
    console.log('- Base URL:', baseUrl);
    console.log('- Account Owner:', accountOwnerName);
    console.log('- App Name:', appLinkName);
    console.log('- Access Token:', accessToken.substring(0, 20) + '...');
    
    // Test All_Registrations report
    console.log('\n📊 Testing All_Registrations report...');
    try {
      const reportUrl = `${baseUrl}/${accountOwnerName}/${appLinkName}/report/All_Registrations`;
      console.log('URL:', reportUrl);
      
      const response = await axios.get(reportUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          max_records: 50,
          field_config: 'quick_view'
        }
      });
      
      console.log('✅ All_Registrations response:');
      console.log('Status:', response.status);
      console.log('Data count:', response.data?.data?.length || 0);
      
      if (response.data?.data && response.data.data.length > 0) {
        console.log('\n📋 Sample record:');
        console.log(JSON.stringify(response.data.data[0], null, 2));
        
        // Analyze data
        console.log('\n📊 Data analysis:');
        const registrations = response.data.data;
        
        // Count by event
        const eventCounts = {};
        const checkInStatus = { 'Checked In': 0, 'Not Yet': 0, 'Unknown': 0 };
        const groupRegistrations = { 'true': 0, 'false': 0, 'unknown': 0 };
        
        registrations.forEach(record => {
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
        console.log(`- Total registrations: ${registrations.length}`);
        console.log(`- Unique events: ${Object.keys(eventCounts).length}`);
        console.log(`- Checked in: ${checkInStatus['Checked In']}`);
        console.log(`- Not yet: ${checkInStatus['Not Yet']}`);
        console.log(`- Group registrations: ${groupRegistrations['true']}`);
        console.log(`- Individual registrations: ${groupRegistrations['false']}`);
      } else {
        console.log('❌ No data found in All_Registrations');
      }
      
    } catch (error) {
      console.log(`❌ All_Registrations failed: ${error.message}`);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', error.response.data);
      }
    }
    
    // Test other reports
    console.log('\n🔍 Testing other reports...');
    const otherReports = ['Registrations', 'Events', 'Visitors'];
    
    for (const reportName of otherReports) {
      try {
        const reportUrl = `${baseUrl}/${accountOwnerName}/${appLinkName}/report/${reportName}`;
        console.log(`\nTesting: ${reportName}`);
        console.log('URL:', reportUrl);
        
        const response = await axios.get(reportUrl, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            max_records: 10,
            field_config: 'quick_view'
          }
        });
        
        console.log(`✅ ${reportName}: ${response.data?.data?.length || 0} records`);
        
        if (response.data?.data && response.data.data.length > 0) {
          console.log(`- Sample keys: ${Object.keys(response.data.data[0]).join(', ')}`);
        }
        
      } catch (error) {
        console.log(`❌ ${reportName} failed: ${error.message}`);
        if (error.response) {
          console.log('Status:', error.response.status);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing direct API:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
testDirectAPI();
