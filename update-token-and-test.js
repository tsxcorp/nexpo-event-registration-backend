const fs = require('fs');
const path = require('path');
const zohoCreatorAPI = require('./src/utils/zohoCreatorAPI');

async function updateTokenAndTest() {
  try {
    console.log('🔑 Updating access token...');
    
    // New access token
    const newAccessToken = '1000.b06b658c6a8029a2786bb5706b8dcc58.29bf913f3afda769617aa5890a97e791';
    
    // Load current tokens
    const tokenFile = path.join(process.cwd(), 'tokens.json');
    let tokens = {};
    
    if (fs.existsSync(tokenFile)) {
      tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      console.log('📄 Current tokens loaded from file');
    }
    
    // Update access token
    tokens.accessToken = newAccessToken;
    tokens.expiresAt = new Date(Date.now() + 3600000).toISOString(); // Set to expire in 1 hour
    
    // Save updated tokens
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
    console.log('✅ New access token saved to file');
    
    // Reload tokens in the service
    const zohoOAuthService = require('./src/utils/zohoOAuthService');
    zohoOAuthService.tokenStore = tokens;
    console.log('🔄 Tokens reloaded in service');
    
    // Test fetching All_Registrations
    console.log('\n🚀 Testing fetch All_Registrations with new token...');
    
    const result = await zohoCreatorAPI.getReportRecords('All_Registrations', {
      max_records: 50,
      useCache: false
    });
    
    console.log('✅ All_Registrations result:');
    console.log(`- Total records: ${result.count}`);
    console.log(`- Has more: ${result.metadata.has_more}`);
    
    if (result.data && result.data.length > 0) {
      console.log(`- Sample record keys: ${Object.keys(result.data[0]).join(', ')}`);
      console.log('\n📋 Sample record structure:');
      console.log(JSON.stringify(result.data[0], null, 2));
      
      // Analyze the data
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
    } else {
      console.log('❌ No data found in All_Registrations');
      
      // Test other reports
      console.log('\n🔍 Testing other reports...');
      const otherReports = ['Registrations', 'Events', 'Visitors'];
      
      for (const reportName of otherReports) {
        try {
          const otherResult = await zohoCreatorAPI.getReportRecords(reportName, {
            max_records: 10,
            useCache: false
          });
          
          console.log(`✅ ${reportName}: ${otherResult.count} records`);
          
          if (otherResult.data && otherResult.data.length > 0) {
            console.log(`- Sample keys: ${Object.keys(otherResult.data[0]).join(', ')}`);
          }
        } catch (error) {
          console.log(`❌ ${reportName} failed: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error updating token and testing:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
updateTokenAndTest();
