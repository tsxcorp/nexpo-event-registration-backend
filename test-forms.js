const axios = require('axios');

async function testForms() {
  try {
    console.log('🚀 Testing Zoho Creator Forms...');
    
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
    
    // Test different form names
    const formNames = [
      'Registrations',
      'Registration', 
      'Event_Registration',
      'Visitor_Registration',
      'All_Registrations',
      'Events',
      'Event',
      'Visitors',
      'Visitor'
    ];
    
    for (const formName of formNames) {
      console.log(`\n📋 Testing form: ${formName}`);
      
      try {
        const formUrl = `${baseUrl}/${accountOwnerName}/${appLinkName}/form/${formName}`;
        console.log('URL:', formUrl);
        
        const response = await axios.get(formUrl, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            max_records: 10
          }
        });
        
        console.log(`✅ ${formName}: ${response.data?.data?.length || 0} records`);
        
        if (response.data?.data && response.data.data.length > 0) {
          console.log(`- Sample keys: ${Object.keys(response.data.data[0]).join(', ')}`);
          console.log('\n📋 Sample record:');
          console.log(JSON.stringify(response.data.data[0], null, 2));
          
          // If we found data, analyze it
          console.log('\n📊 Data analysis:');
          const records = response.data.data;
          
          // Count by event
          const eventCounts = {};
          const checkInStatus = { 'Checked In': 0, 'Not Yet': 0, 'Unknown': 0 };
          const groupRegistrations = { 'true': 0, 'false': 0, 'unknown': 0 };
          
          records.forEach(record => {
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
          console.log(`- Total records: ${records.length}`);
          console.log(`- Unique events: ${Object.keys(eventCounts).length}`);
          console.log(`- Checked in: ${checkInStatus['Checked In']}`);
          console.log(`- Not yet: ${checkInStatus['Not Yet']}`);
          console.log(`- Group registrations: ${groupRegistrations['true']}`);
          console.log(`- Individual registrations: ${groupRegistrations['false']}`);
          
          // Found data, no need to test other forms
          break;
        }
        
      } catch (error) {
        console.log(`❌ ${formName} failed: ${error.message}`);
        if (error.response) {
          console.log('Status:', error.response.status);
        }
      }
    }
    
    // Test getting metadata to see what's available
    console.log('\n🔍 Testing metadata...');
    
    // Test app metadata
    try {
      const appUrl = `${baseUrl}/${accountOwnerName}/${appLinkName}/meta/app`;
      console.log('\nTesting app metadata...');
      console.log('URL:', appUrl);
      
      const appResponse = await axios.get(appUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ App metadata:');
      console.log(JSON.stringify(appResponse.data, null, 2));
      
    } catch (error) {
      console.log(`❌ App metadata failed: ${error.message}`);
    }
    
    // Test forms metadata
    try {
      const formsUrl = `${baseUrl}/${accountOwnerName}/${appLinkName}/meta/forms`;
      console.log('\nTesting forms metadata...');
      console.log('URL:', formsUrl);
      
      const formsResponse = await axios.get(formsUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Forms metadata:');
      console.log(JSON.stringify(formsResponse.data, null, 2));
      
    } catch (error) {
      console.log(`❌ Forms metadata failed: ${error.message}`);
    }
    
    // Test reports metadata
    try {
      const reportsUrl = `${baseUrl}/${accountOwnerName}/${appLinkName}/meta/reports`;
      console.log('\nTesting reports metadata...');
      console.log('URL:', reportsUrl);
      
      const reportsResponse = await axios.get(reportsUrl, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Reports metadata:');
      console.log(JSON.stringify(reportsResponse.data, null, 2));
      
    } catch (error) {
      console.log(`❌ Reports metadata failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing forms:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
testForms();
