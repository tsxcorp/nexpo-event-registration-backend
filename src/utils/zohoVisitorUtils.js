const axios = require('axios');

const {
  ZOHO_ORG_NAME,
  ZOHO_APP_NAME,
  ZOHO_BASE_URL,
  ZOHO_VISITOR_PUBLIC_KEY,
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
    }

    if (data?.code !== 3000) {
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

    const result = {
      visitor: {
        id: safeVisitorId,
        name: visitorData.name || visitorData.full_name || visitorData.Full_Name || "",
        email: visitorData.email || visitorData.Email || "",
        phone: visitorData.phone || visitorData.mobile_number || visitorData.Phone_Number || "",
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
        check_in_history: visitorData.check_in_history || [],
        custom_fields: visitorData.custom_fields || visitorData.Custom_Fields_Value || visitorData.custom_fields_value || {},
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

module.exports = { fetchVisitorDetails }; 