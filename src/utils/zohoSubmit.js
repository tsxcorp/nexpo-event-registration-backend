const axios = require("axios");

const submitRegistration = async (data) => {
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/Master_Registration?privatelink=A982datdqWF3EW9j6QbEdwG0vWXV3ykHz3D4tSGhvPaX1JwfNTUyyCuhGjhpdDJUEgOKXbpuKktqZ7Ssz8bjZj5Awvfd47DnB59C";

  const groupId = `GRP-${Date.now()}`;
  const mainRecordData = data;
  const groupMembers = Array.isArray(data.group_members) ? data.group_members : [];
  const eventInfo = data.Event_Info ?? data.event_info ?? null;
  
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

  // Directly attach the Custom_Fields_Value object from the main registrant
  if (mainRecordData.Custom_Fields_Value && Object.keys(mainRecordData.Custom_Fields_Value).length > 0) {
    mainRecord.Custom_Fields_Value = mainRecordData.Custom_Fields_Value;
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
    
    // Attach the collected custom fields for the member
    if (Object.keys(customFields).length > 0) {
      memberRecord.Custom_Fields_Value = customFields;
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
