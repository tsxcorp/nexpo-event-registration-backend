const axios = require('axios');

const {
  ZOHO_ORG_NAME,
  ZOHO_APP_NAME,
  ZOHO_BASE_URL,
  ZOHO_VISITOR_PUBLIC_KEY,
  ZOHO_CHECKIN_PUBLIC_KEY,
  ZOHO_PRIVATELINK_ALL_EVENTS,
  ZOHO_PRIVATELINK_GALLERY
} = process.env;

// 📸 Build public image URL (reuse from events)
const getPublicImageUrl = (recordId, fieldName, filePath) => {
  if (!filePath) return "";
  return `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/All_Events/${recordId}/${fieldName}/image-download/${ZOHO_PRIVATELINK_ALL_EVENTS}?filepath=/${filePath}`;
};

// 🚀 Fetch visitor data from Zoho Creator Custom API
const fetchVisitorDetails = async (visitorIdInput) => {
  const apiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/NXP_getVisitor`;

  try {
    console.log("🔍 Fetching visitor data from:", apiUrl);
    console.log("📋 Parameters:", {
      visid: visitorIdInput,
      publickey: ZOHO_VISITOR_PUBLIC_KEY ? "***" + ZOHO_VISITOR_PUBLIC_KEY.slice(-4) : "NOT_SET"
    });

    const response = await axios.get(apiUrl, {
      headers: { Accept: 'application/json' },
      params: {
        visid: visitorIdInput,
        publickey: ZOHO_VISITOR_PUBLIC_KEY
      },
      responseType: 'text' // 🛑 tránh mất số khi parse
    });

    console.log("📤 Raw Zoho response:", response.data);

    const data = JSON.parse(response.data, (key, value) => {
      if (key === 'id' && typeof value === 'number') {
        return value.toString();
      }
      return value;
    });

    console.log("📊 Parsed Zoho data:", JSON.stringify(data, null, 2));

    // 🔍 Check different possible response structures
    let visitorData = null;
    
    if (data?.result?.visitor) {
      visitorData = data.result.visitor;
      console.log("✅ Found visitor data in result.visitor");
    } else if (data?.result?.registration) {
      visitorData = data.result.registration;
      console.log("✅ Found visitor data in result.registration");
    } else if (data?.result) {
      visitorData = data.result;
      console.log("✅ Found visitor data in result");
    } else if (data?.visitor) {
      visitorData = data.visitor;
      console.log("✅ Found visitor data in root.visitor");
    } else if (data?.registration) {
      visitorData = data.registration;
      console.log("✅ Found visitor data in root.registration");
    } else if (data.id) {
      // Handle direct object response (like the example provided)
      visitorData = data;
      console.log("✅ Found visitor data as direct object");
    }

    if (data?.code && data.code !== 3000) {
      console.error("❌ Zoho API returned error code:", data?.code);
      throw new Error(`Zoho API error: ${data?.message || 'Unknown error'} (Code: ${data?.code})`);
    }

    if (!visitorData) {
      console.error("❌ No visitor data found in response structure");
      throw new Error("No visitor data found in Zoho response");
    }

    const safeVisitorId = String(visitorData.id); // 🟢 Dùng ID từ Zoho response

    // 🔄 Xử lý formFields nếu có (tương tự events)
    const enrichedFields = (visitorData.formFields || []).map((field, index) => {
      const processedField = {
        field_id: field.field_id || `auto_field_${index}`,
        sort: field.sort,
        label: field.label,
        type: field.type,
        required: field.required,
        groupmember: field.groupmember,
        helptext: field.helptext || "",
        placeholder: field.placeholder || "",
        field_condition: field.field_condition || "",
        section_id: field.section_id || "",
        section_name: field.section_name || "",
        section_sort: field.section_sort || 0,
        section_condition: field.section_condition || "",
        matching_field: field.matching_field || false
      };

      // Log field_id status for debugging
      if (!field.field_id) {
        console.warn(`⚠️ Field missing field_id, auto-generated: ${field.label} → ${processedField.field_id}`);
      }

      // Thêm values cho Select và Multi Select
      if (["Select", "Multi Select"].includes(field.type) && field.values) {
        processedField.values = field.values;
      }

      // Thêm các properties cho Agreement fields
      if (field.type === "Agreement") {
        processedField.title = field.title || "";
        processedField.content = field.content || "";
        processedField.checkbox_label = field.checkbox_label || "";
        processedField.link_text = field.link_text || "";
        processedField.link_url = field.link_url || "";
      }

      return processedField;
    });

    // Parse custom_fields_value if it's a JSON string
    let customFields = {};
    try {
      if (typeof visitorData.custom_fields_value === 'string') {
        customFields = JSON.parse(visitorData.custom_fields_value);
      } else if (visitorData.custom_fields_value && typeof visitorData.custom_fields_value === 'object') {
        customFields = visitorData.custom_fields_value;
      } else if (visitorData.custom_fields) {
        customFields = visitorData.custom_fields;
      } else if (visitorData.Custom_Fields_Value) {
        customFields = typeof visitorData.Custom_Fields_Value === 'string' 
          ? JSON.parse(visitorData.Custom_Fields_Value) 
          : visitorData.Custom_Fields_Value;
      }
    } catch (parseError) {
      console.warn("⚠️ Failed to parse custom_fields_value:", parseError.message);
      customFields = visitorData.custom_fields_value || {};
    }

    // 📝 Xử lý check_in_history với checkintime field
    const processedCheckInHistory = (visitorData.check_in_history || []).map(checkIn => {
      return {
        event_name: checkIn.event_name || "",
        qr_scan: checkIn.qr_scan || "",
        valid_check: checkIn.valid_check || false,
        event_id: checkIn.event_id ? String(checkIn.event_id) : "",
        group_registration_id: checkIn.group_registration_id || "",
        checkintime: checkIn.checkintime || ""
      };
    });

    const result = {
      visitor: {
        id: safeVisitorId,
        salutation: visitorData.salutation || "",
        name: visitorData.name || visitorData.full_name || visitorData.Full_Name || "",
        email: visitorData.email || visitorData.Email || "",
        phone: visitorData.phone || visitorData.phone_number || visitorData.mobile_number || visitorData.Phone_Number || "",
        company: visitorData.company || visitorData.Company || "",
        job_title: visitorData.job_title || visitorData.Job_Title || "",
        registration_date: visitorData.registration_date || visitorData.Registration_Date || "",
        status: visitorData.status || visitorData.Status || "",
        event_id: visitorData.event_id || visitorData.Event_Info || "",
        event_name: visitorData.event_name || "",
        group_id: visitorData.group_id || visitorData.Group_ID || "",
        group_redeem_id: visitorData.group_redeem_id || "",
        badge_qr: visitorData.badge_qr || "",
        redeem_qr: visitorData.redeem_qr || "",
        redeem_id: visitorData.redeem_id || "",
        encrypt_key: visitorData.encrypt_key || "",
        head_mark: visitorData.head_mark || false,
        check_in_history: processedCheckInHistory,
        matching_list: visitorData.matching_list || [],
        custom_fields: customFields,
        formFields: enrichedFields
      }
    };

    console.log("✅ Final visitor result:", JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    console.error("❌ Error in fetchVisitorDetails:", err.message);
    console.error("❌ Error stack:", err.stack);
    throw err;
  }
};

// 🚀 Submit check-in data to Zoho Creator
const submitCheckin = async (visitorData) => {
  const apiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/NXP_submitCheckin`;

  try {
    console.log("🔄 Submitting check-in data to:", apiUrl);
    console.log("📋 Check-in payload:", JSON.stringify(visitorData, null, 2));

    const response = await axios.post(apiUrl, visitorData, {
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params: {
        publickey: ZOHO_CHECKIN_PUBLIC_KEY
      }
    });

    console.log("✅ Check-in response:", response.data);

    // Check if submission was successful
    if (response.data?.code === 3000) {
      return {
        success: true,
        message: "Check-in submitted successfully",
        data: response.data
      };
    } else {
      throw new Error(`Check-in submission failed: ${response.data?.message || 'Unknown error'} (Code: ${response.data?.code})`);
    }

  } catch (err) {
    console.error("❌ Error in submitCheckin:", err.message);
    console.error("❌ Error details:", err.response?.data || err.stack);
    throw new Error(`Failed to submit check-in: ${err.response?.data?.message || err.message}`);
  }
};

module.exports = { fetchVisitorDetails, submitCheckin }; 