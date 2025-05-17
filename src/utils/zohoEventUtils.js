const axios = require('axios');

const {
  ZOHO_APP_NAME,
  ZOHO_ORG_NAME,
  ZOHO_PRIVATELINK_ALL_EVENTS,
  ZOHO_BASE_URL,
} = process.env;

// Hàm tạo link ảnh đúng cấu trúc
const getPublicImageUrl = (recordId, fieldName, fieldValue) => {
  if (!fieldValue) return "";
  const filepathMatch = fieldValue.match(/filepath=([a-zA-Z0-9._-]+)/);
  const filepath = filepathMatch ? filepathMatch[1] : "";

  return `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/All_Events/${recordId}/${fieldName}/image-download/${ZOHO_PRIVATELINK_ALL_EVENTS}?filepath=/${filepath}`;
};

const normalizeFormFields = (formFields = []) => {
  return formFields
    .sort((a, b) => Number(a.Sort) - Number(b.Sort)) // 🔥 sort theo thứ tự tăng dần
    .map(field => ({
      label: field.Label,
      type: field.Type_field,
      required: false,
      default: field.Value || ""
    }));
};


const fetchEventDetails = async (eventId) => {
  const eventURL = `${ZOHO_BASE_URL}/creator/v2.1/publish/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/report/All_Events/${eventId}?privatelink=${ZOHO_PRIVATELINK_ALL_EVENTS}&field_config=all`;
  const axiosConfig = { headers: { Accept: 'application/json' } };

  try {
    const eventRes = await axios.get(eventURL, axiosConfig);
    const eventData = eventRes.data.data;

    const formFields = normalizeFormFields(eventData.Form_Fields || []);

    return {
      event: {
        id: eventData.ID,
        name: eventData.Event_Name,
        description: eventData.Description,
        email: eventData.Email_Contact,
        formFields,
        banner: getPublicImageUrl(eventData.ID, "Banner", eventData.Banner),
        logo: getPublicImageUrl(eventData.ID, "Logo", eventData.Logo),
        header: getPublicImageUrl(eventData.ID, "Header", eventData.Header),
        footer: getPublicImageUrl(eventData.ID, "Footer", eventData.Footer)
      },
      gallery: []
    };
  } catch (err) {
    console.error("❌ Error in fetchEventDetails:", err.message);
    throw err;
  }
};

module.exports = { fetchEventDetails };
