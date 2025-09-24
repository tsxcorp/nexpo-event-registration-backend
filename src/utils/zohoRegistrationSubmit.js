const axios = require("axios");
const logger = require('./logger');
const redisService = require('../services/redisService');

/**
 * Process Custom_Fields_Value to handle both field_id and field label formats
 * This provides backward compatibility during the transition period
 */
const processCustomFields = (customFieldsValue, fieldDefinitions = []) => {
  if (!customFieldsValue || typeof customFieldsValue !== 'object') {
    return {};
  }

  logger.info("Processing Custom_Fields_Value:", customFieldsValue);
  logger.info('📋 Available field definitions:', fieldDefinitions.length);

  const processedFields = {};
  
  Object.entries(customFieldsValue).forEach(([key, value]) => {
    // NEW: Check if value is metadata object format
    if (value && typeof value === 'object' && 'value' in value) {
      // New metadata format: { field_label: "...", field_condition: "...", value: "..." }
      const fieldValue = value.value;
      const fieldLabel = value.field_label;
      const fieldCondition = value.field_condition;
      
      logger.info(`Metadata format detected for "${key}":`, {
        label: fieldLabel,
        condition: fieldCondition,
        value: fieldValue
      });
      
      // Use the key as field_id directly (frontend should send field_id as key)
      processedFields[key] = fieldValue;
      logger.info(`Metadata processed: ${key} = ${fieldValue}`);
      return;
    }
    
    // LEGACY: Check if key is already a field_id format (simple value)
    const fieldByFieldId = fieldDefinitions.find(f => f.field_id === key);
    if (fieldByFieldId) {
      // Legacy format: key is field_id, value is simple value
      processedFields[key] = value;
      logger.info(`Field ID format detected: ${key} = ${value}`);
      return;
    }
    
    // LEGACY: Check if key is a field label (backward compatibility)
    const fieldByLabel = fieldDefinitions.find(f => f.label === key);
    if (fieldByLabel && fieldByLabel.field_id) {
      // Legacy format: key is label, convert to field_id
      processedFields[fieldByLabel.field_id] = value;
      logger.info(`Converted label to field_id: "${key}" → "${fieldByLabel.field_id}" = ${value}`);
      return;
    }
    
    // If no match found, keep original key (for unknown fields or core fields)
    processedFields[key] = value;
    logger.info(`⚠️ No field mapping found for: "${key}", keeping original key`);
  });
  
  logger.info('📋 Final processed custom fields:', processedFields);
  return processedFields;
};



const submitRegistration = async (data) => {
  // Use Zoho Public REST API
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/Master_Registration?privatelink=DB6mMEa72OwB0T64ZfgAUz782E7rVpJrzCxmABUhYgaykYe1S42sYXsVnMuCyQvt6EWNseuZaFwr1bY8Qbq0b9pryGpusZDD3NR2";

  const groupId = `GRP-${Date.now()}`;
  const mainRecordData = data;
  const groupMembers = Array.isArray(data.group_members) ? data.group_members : [];
  const eventInfo = data.Event_Info ?? data.event_info ?? null;
  
  // Detect if this is a group registration
  const isGroupRegistration = groupMembers && groupMembers.length > 0;
  logger.info(`👥 Group registration detected: ${isGroupRegistration} (${groupMembers.length} members)`);;
  
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
            logger.info("Member metadata field: ${key} = ${value.value} (label: ${value.field_label})");
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
    logger.info('👥 Group_Members JSON added to main record:', mainRecord.Group_Members);
  }

  records.push(mainRecord);
  
  logger.info('📋 Main record built:', JSON.stringify(mainRecord, null, 2));

  // 2. Process group member records
  const coreFields = ['Salutation', 'Full_Name', 'Email', 'Phone_Number', 'title', 'full_name', 'email', 'mobile_number'];
  for (const member of groupMembers) {
    const memberRecord = {
      Event_Info: eventInfo,
      Group_ID: groupId,
      Group_Registration: isGroupRegistration,
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
    logger.info("Sending record ${i + 1}/${records.length} to Zoho:", JSON.stringify(payload, null, 2));

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
      logger.error("Error pushing record ${i + 1}:", err.response?.data || err.message);
      
      // Check if this is an API limit error
      const isApiLimitError = err.response?.data?.code === 4000 || 
                             err.message.includes('API limit') || 
                             err.message.includes('too many requests');
      
      if (isApiLimitError) {
        logger.info(`🚨 API limit reached for record ${i + 1}, attempting to buffer submission...`);
        
        try {
          // Buffer the entire submission for retry
          const bufferResult = await redisService.addToBuffer(
            data, 
            'API_LIMIT'
          );
          
          if (bufferResult.success) {
            // Set API limit reset time (next day)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            // API limit reset time tracking removed - simplified buffer system
            
            // Return buffer result instead of throwing error
            return {
              success: true,
              status: 'buffered',
              bufferId: bufferResult.bufferId,
              message: 'Registration has been buffered due to API limit. Will be processed automatically when limit resets.',
              retryTime: 'Next day at 00:00',
              note: 'Your registration is safe and will be processed automatically'
            };
          } else {
            logger.error("Failed to buffer submission:", bufferResult.error);
            throw new Error(`API limit reached and failed to buffer submission: ${bufferResult.error}`);
          }
        } catch (bufferError) {
          logger.error("Error in buffer system:", bufferError);
          throw new Error(`API limit reached. Unable to buffer submission due to: ${bufferError.message}`);
        }
      }
      
      throw new Error(`Zoho submit failed for record ${i + 1}: ${err.message}`);
    }
  }

  // 🚀 NEW: Direct Redis sync after successful Zoho submission
  try {
    logger.info("Syncing new records directly to Redis...");
    
    // Get the main record data from Zoho response
    const mainRecord = responses[0].data;
    
    // Extract eventId from request data (since Zoho response doesn't include Event_Info)
    const eventId = data.Event_Info || data.event_id || mainRecord.Event_Info?.ID || mainRecord.Event_Info;
    
    logger.info("Debug mainRecord:", {
      ID: mainRecord.ID,
      Event_Info: mainRecord.Event_Info,
      Event_Info_ID: mainRecord.Event_Info?.ID,
      requestEventId: data.Event_Info,
      requestEventIdAlt: data.event_id
    });
    
    if (eventId) {
      // Enhance the record with Event_Info for consistency
      const enhancedRecord = {
        ...mainRecord,
        Event_Info: eventId
      };
      
      logger.info("Syncing main record ${mainRecord.ID} to Redis for event ${eventId}");
      
      // Sync main record to Redis
      await redisService.updateEventRecord(eventId, enhancedRecord, mainRecord.ID);
      
      // Sync group member records if any
      if (responses.length > 1) {
        logger.info(`👥 Syncing ${responses.length - 1} group member records to Redis...`);
        
        for (let i = 1; i < responses.length; i++) {
          const memberRecord = responses[i].data;
          const enhancedMemberRecord = {
            ...memberRecord,
            Event_Info: eventId
          };
          logger.info("Syncing member record ${memberRecord.ID} to Redis");
          await redisService.updateEventRecord(eventId, enhancedMemberRecord, memberRecord.ID);
        }
      }
      
      // Update cache metadata
      await redisService.updateCacheMetadata();
      
      logger.info("All records synced to Redis successfully");
    } else {
      logger.info("⚠️ No event ID found in main record, skipping Redis sync");
    }
  } catch (redisError) {
    logger.error("Redis sync failed (non-critical):", redisError);
    // Don't fail the entire submission if Redis sync fails
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
