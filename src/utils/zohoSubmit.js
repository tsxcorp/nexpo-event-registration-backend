const axios = require('axios');

const submitRegistration = async (data) => {
  const formPublicURL =
    "https://www.zohoapis.com/creator/v2.1/publish/tsxcorp/nxp/form/master_registration?privatelink=A982datdqWF3EW9j6QbEdwG0vWXV3ykHz3D4tSGhvPaX1JwfNTUyyCuhGjhpdDJUEgOKXbpuKktqZ7Ssz8bjZj5Awvfd47DnB59C";

  const coreKeys = ["title", "full_name", "email", "mobile_number"];
  const coreData = {};
  const customData = {};

  for (const key in data) {
    if (coreKeys.includes(key)) {
      coreData[key] = data[key];
    } else {
      customData[key] = data[key];
    }
  }

  const payload = {
    data: {
      ...data // ✅ giữ nguyên định dạng JSON đúng
    }
  };

  console.log(">>> Submit to Zoho:", formPublicURL);
  console.log(">>> Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      formPublicURL,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; NexpoBot/1.0)",
          "Referer": "https://creator.zoho.com",
        },
      }
    );

    const resData = response.data;

    // ✅ Nếu Zoho trả về lỗi, throw để backend catch và đưa vào báo cáo
    if (resData.code !== 3000) {
      const errorDetails = resData.error
        ? JSON.stringify(resData.error)
        : `Unexpected Zoho response code: ${resData.code}`;
      throw new Error(errorDetails);
    }

    console.log("✅ Zoho response:", response.status, resData);
    return resData;

  } catch (err) {
    console.error("❌ Error in submitRegistration:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = { submitRegistration };
