const { submitRegistration } = require('./src/utils/zohoRegistrationSubmit');

// Mock field definitions (similar to what would come from Zoho)
const mockFieldDefinitions = [
  {
    field_id: "field_001",
    label: "Mục đích tham quan",
    type: "Select",
    values: ["Tham quan thông thường", "Kết nối giao thương"]
  },
  {
    field_id: "field_002", 
    label: "Công ty",
    type: "Text"
  },
  {
    field_id: "field_003",
    label: "Chức vụ", 
    type: "Text"
  },
  {
    field_id: "field_004",
    label: "Privacy Policy",
    type: "Agreement"
  }
];

// Test data with field_id format (new format)
const testDataWithFieldIds = {
  Salutation: "Mr.",
  Full_Name: "John Doe",
  Email: "john@example.com", 
  Phone_Number: "1234567890",
  Custom_Fields_Value: {
    "field_001": "Tham quan thông thường",
    "field_002": "ABC Company",
    "field_003": "Manager",
    "field_004": "true"
  },
  Event_Info: "test_event_123",
  fieldDefinitions: mockFieldDefinitions,
  group_members: []
};

// Test data with field labels (old format)
const testDataWithLabels = {
  Salutation: "Ms.",
  Full_Name: "Jane Smith", 
  Email: "jane@example.com",
  Phone_Number: "0987654321",
  Custom_Fields_Value: {
    "Mục đích tham quan": "Kết nối giao thương",
    "Công ty": "XYZ Corp",
    "Chức vụ": "Director", 
    "Privacy Policy": "true"
  },
  Event_Info: "test_event_123",
  fieldDefinitions: mockFieldDefinitions,
  group_members: []
};

// Test data with mixed format
const testDataMixed = {
  Salutation: "Mrs.",
  Full_Name: "Alice Johnson",
  Email: "alice@example.com",
  Phone_Number: "5555555555", 
  Custom_Fields_Value: {
    "field_001": "Tham quan thông thường", // field_id format
    "Công ty": "Mixed Corp",              // label format
    "field_003": "Senior Manager",        // field_id format
    "Privacy Policy": "true"              // label format
  },
  Event_Info: "test_event_123",
  fieldDefinitions: mockFieldDefinitions,
  group_members: []
};

async function runTests() {
  console.log('🧪 Testing Field ID Processing Logic');
  console.log('=====================================\n');

  // Mock the axios call to prevent actual submission
  const axios = require('axios');
  const originalPost = axios.post;
  
  // Mock axios.post
  axios.post = async (url, data) => {
    console.log('📤 Mock Zoho submission:', JSON.stringify(data, null, 2));
    return {
      data: {
        code: 3000,
        data: { ID: `mock_id_${Date.now()}` }
      }
    };
  };

  try {
    console.log('Test 1: Field ID Format (New Format)');
    console.log('------------------------------------');
    await submitRegistration(testDataWithFieldIds);
    console.log('✅ Test 1 completed\n');

    console.log('Test 2: Field Label Format (Old Format - Backward Compatibility)');
    console.log('----------------------------------------------------------------');
    await submitRegistration(testDataWithLabels);
    console.log('✅ Test 2 completed\n');

    console.log('Test 3: Mixed Format');
    console.log('-------------------');
    await submitRegistration(testDataMixed);
    console.log('✅ Test 3 completed\n');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests }; 