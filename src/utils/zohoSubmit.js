const axios = require("axios");

const submitRegistration = async (data) => {
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/master_registration?privatelink=A982datdqWF3EW9j6QbEdwG0vWXV3ykHz3D4tSGhvPaX1JwfNTUyyCuhGjhpdDJUEgOKXbpuKktqZ7Ssz8bjZj5Awvfd47DnB59C";

  const groupId = `GRP-${Date.now()}`;
  const groupMembers = Array.isArray(data.group_members) ? data.group_members : [];
  const eventInfo = data.Event_Info ?? data.event_info ?? null; // 👈 lấy đúng key hoặc fallback
  const coreKeys = ["title", "full_name", "email", "mobile_number"];
  const records = [];

  // 1. Người đăng ký chính
  const mainCore = {};
  const mainCustom = {};

  for (const key in data) {
    if (coreKeys.includes(key)) {
      mainCore[key] = data[key];
    } else if (!["group_members", "custom_fields_value", "Event_Info", "event_info"].includes(key)) {
      mainCustom[key] = data[key];
    }
  }

  const finalCustomFields = data.custom_fields_value || mainCustom;

  records.push({
    ...mainCore,
    custom_fields_value: finalCustomFields,
    Event_Info: eventInfo,
    Group_ID: groupId
  });

  // 2. Các thành viên trong nhóm
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
      custom_fields_value: memberCustom,
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
      full_name: records[i].full_name,
      email: records[i].email
    }))
  };

  console.log("✅ Returning payload to frontend:", JSON.stringify(result, null, 2));

  return result;
};

module.exports = { submitRegistration };