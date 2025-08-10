const zohoCreatorAPI = require('./src/utils/zohoCreatorAPI');

async function testMetadata() {
  try {
    console.log('🔍 Testing Zoho Creator metadata...');
    
    // Test getting app metadata
    console.log('\n📋 Getting app metadata...');
    try {
      const appMetadata = await zohoCreatorAPI.makeRequest('GET', 'meta/app');
      console.log('✅ App metadata:');
      console.log(JSON.stringify(appMetadata, null, 2));
    } catch (error) {
      console.log(`❌ App metadata failed: ${error.message}`);
    }
    
    // Test getting forms metadata
    console.log('\n📋 Getting forms metadata...');
    try {
      const formsMetadata = await zohoCreatorAPI.makeRequest('GET', 'meta/forms');
      console.log('✅ Forms metadata:');
      console.log(JSON.stringify(formsMetadata, null, 2));
    } catch (error) {
      console.log(`❌ Forms metadata failed: ${error.message}`);
    }
    
    // Test getting reports metadata
    console.log('\n📋 Getting reports metadata...');
    try {
      const reportsMetadata = await zohoCreatorAPI.makeRequest('GET', 'meta/reports');
      console.log('✅ Reports metadata:');
      console.log(JSON.stringify(reportsMetadata, null, 2));
    } catch (error) {
      console.log(`❌ Reports metadata failed: ${error.message}`);
    }
    
    // Test getting specific form metadata
    console.log('\n📋 Getting specific form metadata...');
    const formNames = ['Registrations', 'Registration', 'Event_Registration', 'Visitor_Registration'];
    
    for (const formName of formNames) {
      try {
        const formMetadata = await zohoCreatorAPI.getFormMetadata(formName);
        console.log(`✅ Form ${formName} metadata:`);
        console.log(JSON.stringify(formMetadata, null, 2));
      } catch (error) {
        console.log(`❌ Form ${formName} metadata failed: ${error.message}`);
      }
    }
    
    // Test getting data from forms directly
    console.log('\n📋 Testing form data...');
    for (const formName of formNames) {
      try {
        const formData = await zohoCreatorAPI.makeRequest('GET', `form/${formName}`, null, {
          max_records: 5
        });
        console.log(`✅ Form ${formName} data: ${formData.data ? formData.data.length : 0} records`);
        if (formData.data && formData.data.length > 0) {
          console.log(`- Sample keys: ${Object.keys(formData.data[0]).join(', ')}`);
        }
      } catch (error) {
        console.log(`❌ Form ${formName} data failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing metadata:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Run the test
testMetadata();
