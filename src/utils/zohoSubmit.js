const axios = require("axios");

const submitRegistration = async (data) => {
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/Master_Registration?privatelink=A982datdqWF3EW9j6QbEdwG0vWXV3ykHz3D4tSGhvPaX1JwfNTUyyCuhGjhpdDJUEgOKXbpuKktqZ7Ssz8bjZj5Awvfd47DnB59C";

  const groupId = `GRP-${Date.now()}`;
  const groupMembers = Array.isArray(data.group_members) ? data.group_members : [];
  const eventInfo = data.Event_Info ?? data.event_info ?? null;
  const coreKeys = ["Salutation", "Full_Name", "Email", "Phone_Number"];
  const records = [];

  // Người đăng ký chính
  const mainCore = {};
  const mainCustom = {};

  for (const key in data) {
    if (coreKeys.includes(key)) {
      mainCore[key] = data[key];
    } else if (!["group_members", "Custom_Fields_Value", "Event_Info", "event_info"].includes(key)) {
      mainCustom[key] = data[key];
    }
  }

  records.push({
    ...mainCore,
    Custom_Fields_Value: data.Custom_Fields_Value || mainCustom,
    Event_Info: eventInfo,
    Group_ID: groupId
  });

  // Các thành viên trong nhóm
  for (const member of groupMembers) {
    const memberCore = {};
    const memberCustom = {};

    for (const key in member) {
      if (coreKeys.includes(key)) {
        memberCore[key] = member[key];
      } else {
        memberCustom[key] = member[key];
      }
    }

    records.push({
      ...memberCore,
      Custom_Fields_Value: memberCustom,
      Event_Info: eventInfo,
      Group_ID: groupId
    });
  }

  const responses = [];
  let mainZohoRecordId = null;

  for (let i = 0; i < records.length; i++) {
    const payload = { data: records[i] };
    console.log("📤 Sending to Zoho:", JSON.stringify(payload, null, 2));

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
      console.error("❌ Error pushing record:", err.response?.data || err.message);
      throw new Error(`Zoho submit failed: ${err.message}`);
    }
  }

  const result = {
    zoho_record_id: mainZohoRecordId,
    group_id: groupId,
    group_members: responses.map((res, i) => ({
      ID: res.data.ID,
      Full_Name: records[i].Full_Name,
      Email: records[i].Email
    }))
  };

  console.log("✅ Returning payload to frontend:", JSON.stringify(result, null, 2));

  return result;
};

module.exports = { submitRegistration };
