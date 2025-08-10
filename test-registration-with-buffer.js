const axios = require('axios');

async function testRegistrationWithBuffer() {
  try {
    console.log('🚀 Testing registration with buffer system...');
    
    // Test registration data
    const registrationData = {
      title: 'Mr.',
      full_name: 'Test User Buffer System',
      email: 'test.buffer.system@example.com',
      mobile_number: '0123456789',
      custom_fields_value: {
        vilog2025_jobtitle: {
          field_label: 'Job Title',
          field_condition: 'required',
          value: 'Software Engineer'
        },
        vilog2025_company: {
          field_label: 'Company Name',
          field_condition: 'optional',
          value: 'Buffer Test Corp'
        }
      },
      group_members: []
    };
    
    console.log('📤 Submitting registration...');
    console.log('Event ID: 4433256000012332047');
    console.log('Registration data:', JSON.stringify(registrationData, null, 2));
    
    // Submit registration
    const response = await axios.post('http://localhost:3000/api/registrations?Event_Info=4433256000012332047', 
      registrationData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Registration response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    // Check buffer status after submission
    console.log('\n📊 Checking buffer status...');
    const bufferResponse = await axios.get('http://localhost:3000/api/buffer/status');
    console.log('Buffer status:', JSON.stringify(bufferResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing registration:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // If it's a buffered response (202 status), that's actually success!
      if (error.response.status === 202 && error.response.data.status === 'buffered') {
        console.log('\n🎉 SUCCESS! Registration was buffered due to API limit');
        console.log('Buffer ID:', error.response.data.bufferId);
        console.log('Message:', error.response.data.message);
        
        // Check buffer status
        try {
          const bufferResponse = await axios.get('http://localhost:3000/api/buffer/status');
          console.log('\n📊 Buffer status after buffering:');
          console.log(JSON.stringify(bufferResponse.data, null, 2));
        } catch (bufferError) {
          console.error('❌ Error checking buffer status:', bufferError.message);
        }
      }
    }
  }
}

// Run the test
testRegistrationWithBuffer();
