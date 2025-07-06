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
    // Check if key is already a field_id format
    const fieldByFieldId = fieldDefinitions.find(f => f.field_id === key);
    if (fieldByFieldId) {
      // New format: key is field_id
      processedFields[key] = value;
      console.log(`✅ Field ID format detected: ${key} = ${value}`);
      return;
    }
    
    // Check if key is a field label (backward compatibility)
    const fieldByLabel = fieldDefinitions.find(f => f.label === key);
    if (fieldByLabel && fieldByLabel.field_id) {
      // Old format: key is label, convert to field_id
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

const submitRegistration = async (data) => {
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/Master_Registration?privatelink=A982datdqWF3EW9j6QbEdwG0vWXV3ykHz3D4tSGhvPaX1JwfNTUyyCuhGjhpdDJUEgOKXbpuKktqZ7Ssz8bjZj5Awvfd47DnB59C";

  const groupId = `GRP-${Date.now()}`;
  const mainRecordData = data;
  const groupMembers = Array.isArray(data.group_members) ? data.group_members : [];
  const eventInfo = data.Event_Info ?? data.event_info ?? null;
  
  // Get field definitions for processing (if available)
  // Note: In a real implementation, you might want to fetch this from your event data
  const fieldDefinitions = data.fieldDefinitions || [];
  
  const records = [];

  // 1. Process the main registrant record
  const mainRecord = {
    Event_Info: eventInfo,
    Group_ID: groupId,
    Salutation: mainRecordData.Salutation,
    Full_Name: mainRecordData.Full_Name,
    Email: mainRecordData.Email,
    Phone_Number: mainRecordData.Phone_Number,
  };

  // Process the Custom_Fields_Value object from the main registrant
  if (mainRecordData.Custom_Fields_Value && Object.keys(mainRecordData.Custom_Fields_Value).length > 0) {
    const processedCustomFields = processCustomFields(mainRecordData.Custom_Fields_Value, fieldDefinitions);
    mainRecord.Custom_Fields_Value = processedCustomFields;
  }
  records.push(mainRecord);

  // 2. Process group member records
  const coreFields = ['Salutation', 'Full_Name', 'Email', 'Phone_Number'];
  for (const member of groupMembers) {
    const memberRecord = {
      Event_Info: eventInfo,
      Group_ID: groupId,
    };
    const customFields = {};

    // Separate core fields from custom fields for the member
    for (const [key, value] of Object.entries(member)) {
      if (coreFields.includes(key)) {
        memberRecord[key] = value;
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

  const result = {
    zoho_record_id: mainZohoRecordId,
    group_id: groupId,
    group_members: responses.slice(1).map((res, i) => ({ // Exclude main registrant from member list
      ID: res.data.ID,
      Full_Name: records[i + 1].Full_Name,
      Email: records[i + 1].Email
    }))
  };

  console.log("✅ Returning payload to frontend:", JSON.stringify(result, null, 2));

  return result;
};

module.exports = { submitRegistration };
