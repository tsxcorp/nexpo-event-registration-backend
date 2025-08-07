const axios = require("axios");

/**
 * Process Custom_Fields_Value to handle both field_id and field label formats
 * This provides backward compatibility during the transition period
 */
const processCustomFields = (customFieldsValue, fieldDefinitions = []) => {
  if (!customFieldsValue || typeof customFieldsValue !== 'object') {
    return {};
  }

  console.log('🔄 Processing Custom_Fields_Value:', customFieldsValue);
  console.log('📋 Available field definitions:', fieldDefinitions.length);

  const processedFields = {};
  
  Object.entries(customFieldsValue).forEach(([key, value]) => {
    // NEW: Check if value is metadata object format
    if (value && typeof value === 'object' && 'value' in value) {
      // New metadata format: { field_label: "...", field_condition: "...", value: "..." }
      const fieldValue = value.value;
      const fieldLabel = value.field_label;
      const fieldCondition = value.field_condition;
      
      console.log(`📊 Metadata format detected for "${key}":`, {
        label: fieldLabel,
        condition: fieldCondition,
        value: fieldValue
      });
      
      // Use the key as field_id directly (frontend should send field_id as key)
      processedFields[key] = fieldValue;
      console.log(`✅ Metadata processed: ${key} = ${fieldValue}`);
      return;
    }
    
    // LEGACY: Check if key is already a field_id format (simple value)
    const fieldByFieldId = fieldDefinitions.find(f => f.field_id === key);
    if (fieldByFieldId) {
      // Legacy format: key is field_id, value is simple value
      processedFields[key] = value;
      console.log(`✅ Field ID format detected: ${key} = ${value}`);
      return;
    }
    
    // LEGACY: Check if key is a field label (backward compatibility)
    const fieldByLabel = fieldDefinitions.find(f => f.label === key);
    if (fieldByLabel && fieldByLabel.field_id) {
      // Legacy format: key is label, convert to field_id
      processedFields[fieldByLabel.field_id] = value;
      console.log(`🔄 Converted label to field_id: "${key}" → "${fieldByLabel.field_id}" = ${value}`);
      return;
    }
    
    // If no match found, keep original key (for unknown fields or core fields)
    processedFields[key] = value;
    console.log(`⚠️ No field mapping found for: "${key}", keeping original key`);
  });
  
  console.log('📋 Final processed custom fields:', processedFields);
  return processedFields;
};

// 🚀 Submit via Zoho Custom Function (matches your submitRegistration function)
const submitViaCustomFunction = async (data) => {
  const customFunctionURL = `${process.env.ZOHO_BASE_URL}/creator/custom/${process.env.ZOHO_ORG_NAME}/submitRegistration`;
  
  // Try multiple methods if GET fails
  const methods = ['GET', 'POST'];
  
  for (const method of methods) {
    try {
      return await tryCustomFunctionWithMethod(customFunctionURL, data, method);
    } catch (err) {
      console.warn(`❌ ${method} method failed:`, err.message);
      if (method === methods[methods.length - 1]) {
        // Last method failed, throw the error
        throw err;
      }
      console.log(`🔄 Trying next method...`);
    }
  }
};

const tryCustomFunctionWithMethod = async (customFunctionURL, data, method) => {
  
  // Format data for Custom Function (lowercase field names)
  const customFunctionPayload = {
    title: data.title || data.Salutation || "",
    full_name: data.full_name || data.Full_Name || "",
    email: data.email || data.Email || "",
    mobile_number: data.mobile_number || data.Phone_Number || "",
    event_info: data.Event_Info || data.event_info || "",
    custom_fields_value: JSON.stringify(data.Custom_Fields_Value || data.custom_fields_value || {}),
    group_members: JSON.stringify(data.group_members || [])
  };

  console.log(`📤 Trying ${method} method for Zoho Custom Function:`, JSON.stringify(customFunctionPayload, null, 2));
  
  const requestData = {
    data_map_str: JSON.stringify(customFunctionPayload),
    publickey: process.env.ZOHO_PUBLIC_KEY
  };
  
  console.log('🔗 Custom Function URL:', customFunctionURL);
  console.log(`📋 ${method} Request Data:`, requestData);
  console.log('🔑 Public Key:', process.env.ZOHO_PUBLIC_KEY ? '✅ Set' : '❌ Missing');

  try {
    let response;
    
    if (method === 'GET') {
      response = await axios.get(customFunctionURL, {
        headers: { 
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; NexpoBot/1.0)'
        },
        params: requestData,
        responseType: 'text',
        timeout: 30000
      });
    } else if (method === 'POST') {
      response = await axios.post(customFunctionURL, requestData, {
        headers: { 
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; NexpoBot/1.0)'
        },
        params: {
          publickey: process.env.ZOHO_PUBLIC_KEY
        },
        responseType: 'text',
        timeout: 30000
      });
    }

    const result = JSON.parse(response.data);
    console.log('✅ Custom Function Response:', result);

    return {
      success: true,
      zoho_record_id: result.main_record_id || "custom_function_success",
      group_id: result.group_id || `GRP-${Date.now()}`,
      details: result
    };
  } catch (err) {
    console.error("❌ Custom Function Error Details:");
    console.error("  Status:", err.response?.status);
    console.error("  Status Text:", err.response?.statusText);
    console.error("  Headers:", err.response?.headers);
    console.error("  Data:", err.response?.data);
    console.error("  Message:", err.message);
    
    // Try to provide more specific error information
    if (err.response?.status === 400) {
      console.error("🔍 400 Error Analysis:");
      console.error("  - Check if Custom Function name 'submitRegistration' exists");
      console.error("  - Check if publickey is correct");
      console.error("  - Check if data_map_str format is valid");
      console.error("  - Verify Custom Function expects GET method");
    }
    
    throw new Error(`Custom Function failed: ${err.response?.status} ${err.response?.statusText} - ${err.response?.data || err.message}`);
  }
};

const submitRegistration = async (data) => {
  // Option 1: Use Custom Function (matches your Zoho function)
  const USE_CUSTOM_FUNCTION = process.env.USE_ZOHO_CUSTOM_FUNCTION === 'true';
  const FALLBACK_TO_REST_API = process.env.FALLBACK_TO_REST_API !== 'false'; // Default true
  
  if (USE_CUSTOM_FUNCTION) {
    try {
      return await submitViaCustomFunction(data);
    } catch (err) {
      console.error("❌ Custom Function completely failed:", err.message);
      
      if (FALLBACK_TO_REST_API) {
        console.warn("🔄 Falling back to REST API...");
        // Continue to REST API below
      } else {
        throw err; // Re-throw if fallback is disabled
      }
    }
  }
  
  // Option 2: Use REST API (current implementation)
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/Master_Registration?privatelink=A982datdqWF3EW9j6QbEdwG0vWXV3ykHz3D4tSGhvPaX1JwfNTUyyCuhGjhpdDJUEgOKXbpuKktqZ7Ssz8bjZj5Awvfd47DnB59C";

  const groupId = `GRP-${Date.now()}`;
  const mainRecordData = data;
  const groupMembers = Array.isArray(data.group_members) ? data.group_members : [];
  const eventInfo = data.Event_Info ?? data.event_info ?? null;
  
  // Detect if this is a group registration
  const isGroupRegistration = groupMembers && groupMembers.length > 0;
  console.log(`👥 Group registration detected: ${isGroupRegistration} (${groupMembers.length} members)`);;
  
  // Get field definitions for processing (if available)
  // Note: In a real implementation, you might want to fetch this from your event data
  const fieldDefinitions = data.fieldDefinitions || [];
  
  const records = [];

  // 1. Process the main registrant record
  const mainRecord = {
    Event_Info: eventInfo,
    Group_ID: groupId,
    Group_Registration: isGroupRegistration,
    Salutation: mainRecordData.Salutation || mainRecordData.title,
    Full_Name: mainRecordData.Full_Name || mainRecordData.full_name,
    Email: mainRecordData.Email || mainRecordData.email,
    Phone_Number: mainRecordData.Phone_Number || mainRecordData.mobile_number,
  };

  // Process the Custom_Fields_Value object from the main registrant
  const customFieldsData = mainRecordData.Custom_Fields_Value || mainRecordData.custom_fields_value;
  if (customFieldsData && Object.keys(customFieldsData).length > 0) {
    const processedCustomFields = processCustomFields(customFieldsData, fieldDefinitions);
    mainRecord.Custom_Fields_Value = processedCustomFields;
  }

  // Add Group_Members JSON field to main record
  if (groupMembers && groupMembers.length > 0) {
    const processedGroupMembers = groupMembers.map(member => {
      const memberData = {};
      
      // Core fields mapping for members
      if (member.Salutation || member.title) memberData.salutation = member.Salutation || member.title;
      if (member.Full_Name || member.full_name) memberData.full_name = member.Full_Name || member.full_name;
      if (member.Email || member.email) memberData.email = member.Email || member.email;
      if (member.Phone_Number || member.mobile_number) memberData.phone_number = member.Phone_Number || member.mobile_number;
      
      // Add custom fields for members (support metadata format)
      const memberCustomFields = {};
      const coreFields = ['Salutation', 'Full_Name', 'Email', 'Phone_Number', 'title', 'full_name', 'email', 'mobile_number'];
      
      for (const [key, value] of Object.entries(member)) {
        if (!coreFields.includes(key) && value !== null && value !== undefined && value !== '') {
          // Check if value is metadata object format
          if (value && typeof value === 'object' && 'value' in value) {
            // Metadata format: extract the actual value
            memberCustomFields[key] = value.value;
            console.log(`📊 Member metadata field: ${key} = ${value.value} (label: ${value.field_label})`);
          } else {
            // Simple format: use value directly
            memberCustomFields[key] = value;
          }
        }
      }
      
      if (Object.keys(memberCustomFields).length > 0) {
        memberData.custom_fields = memberCustomFields;
      }
      
      return memberData;
    });
    
    mainRecord.Group_Members = JSON.stringify(processedGroupMembers);
    console.log('👥 Group_Members JSON added to main record:', mainRecord.Group_Members);
  }

  records.push(mainRecord);
  
  console.log('📋 Main record built:', JSON.stringify(mainRecord, null, 2));

  // 2. Process group member records
  const coreFields = ['Salutation', 'Full_Name', 'Email', 'Phone_Number', 'title', 'full_name', 'email', 'mobile_number'];
  for (const member of groupMembers) {
    const memberRecord = {
      Event_Info: eventInfo,
      Group_ID: groupId,
      Salutation: member.Salutation || member.title,
      Full_Name: member.Full_Name || member.full_name,
      Email: member.Email || member.email,
      Phone_Number: member.Phone_Number || member.mobile_number,
    };
    const customFields = {};

    // Separate core fields from custom fields for the member
    for (const [key, value] of Object.entries(member)) {
      if (coreFields.includes(key)) {
        // Skip core fields as they're already processed above
        continue;
      } else {
        customFields[key] = value;
      }
    }
    
    // Process the collected custom fields for the member
    if (Object.keys(customFields).length > 0) {
      const processedCustomFields = processCustomFields(customFields, fieldDefinitions);
      memberRecord.Custom_Fields_Value = processedCustomFields;
    }
    
    records.push(memberRecord);
  }

  // 3. Submit all records to Zoho
  const responses = [];
  let mainZohoRecordId = null;

  for (let i = 0; i < records.length; i++) {
    const payload = { data: records[i] };
    console.log(`📤 Sending record ${i + 1}/${records.length} to Zoho:`, JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(formPublicURL, payload, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; NexpoBot/1.0)",
          "Referer": "https://creator.zoho.com",
        },
      });

      const resData = response.data;

      if (resData.code !== 3000 || !resData.data?.ID) {
        throw new Error(
          `Unexpected Zoho response or missing ID: ${JSON.stringify(resData)}`
        );
      }

      if (i === 0) {
        mainZohoRecordId = resData.data.ID;
      }

      responses.push(resData);
    } catch (err) {
      console.error(`❌ Error pushing record ${i + 1}:`, err.response?.data || err.message);
      throw new Error(`Zoho submit failed for record ${i + 1}: ${err.message}`);
    }
  }

  return { 
    success: true, 
    responses, 
    zoho_record_id: mainZohoRecordId, 
    group_id: groupId,
    group_members: responses.slice(1).map((res, i) => ({ // Exclude main registrant from member list
      id: res.data.ID,
      index: i + 2,
      status: "submitted"
    })) 
  };
};

module.exports = { submitRegistration, processCustomFields };
