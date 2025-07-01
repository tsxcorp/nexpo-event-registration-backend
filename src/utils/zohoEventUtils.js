const axios = require('axios');

const {
  ZOHO_ORG_NAME,
  ZOHO_APP_NAME,
  ZOHO_BASE_URL,
  ZOHO_PUBLIC_KEY,
  ZOHO_PRIVATELINK_ALL_EVENTS,
  ZOHO_PRIVATELINK_GALLERY
} = process.env;

// 📸 Build public image URL
const getPublicImageUrl = (recordId, fieldName, filePath) => {
  if (!filePath) return "";
  return `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/All_Events/${recordId}/${fieldName}/image-download/${ZOHO_PRIVATELINK_ALL_EVENTS}?filepath=/${filePath}`;
};

// 🖼 Build public gallery image URLs
const getGalleryImageUrls = (galleryId, galleryObj) => {
  if (!galleryId || !Array.isArray(galleryObj?.obj)) return [];
  return galleryObj.obj.map(imagePath => {
    return `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/All_Event_Libraries/${galleryId}/Upload_Image/image-download/${ZOHO_PRIVATELINK_GALLERY}?filepath=/${imagePath.trim()}`;
  });
};

// 🚀 Fetch full event data from Zoho Creator Custom API
const fetchEventDetails = async (eventIdInput) => {
  const apiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/NXP_getEventInfo`;

  try {
    const response = await axios.get(apiUrl, {
      headers: { Accept: 'application/json' },
      params: {
        event_id: eventIdInput,
        publickey: ZOHO_PUBLIC_KEY
      },
      responseType: 'text' // 🛑 tránh mất số khi parse
    });

    const data = JSON.parse(response.data, (key, value) => {
      if (key === 'id' && typeof value === 'number') {
        return value.toString();
      }
      return value;
    });

    const eventData = data.result?.event;

    if (data?.code !== 3000 || !eventData) {
      throw new Error("Invalid or incomplete response from Zoho Custom API.");
    }

    const safeEventId = String(eventIdInput); // 🟢 Dùng ID từ query param

    // 🔄 Xử lý formFields để bao gồm tất cả properties có sẵn
    const enrichedFields = (eventData.formFields || []).map(field => {
      const processedField = {
        sort: field.sort,
        label: field.label,
        type: field.type,
        required: field.required,
        groupmember: field.groupmember,
        helptext: field.helptext || "",
        placeholder: field.placeholder || "",
        field_condition: field.field_condition || "",
        section_name: field.section_name || "",
        section_sort: field.section_sort || 0,
        section_condition: field.section_condition || "",
        matching_field: field.matching_field || false
      };

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

    return {
      event: {
        id: safeEventId,
        name: eventData.name,
        description: eventData.description,
        email: eventData.email,
        formFields: enrichedFields,
        banner: getPublicImageUrl(safeEventId, "Banner", eventData.banner),
        logo: getPublicImageUrl(safeEventId, "Logo", eventData.logo),
        header: getPublicImageUrl(safeEventId, "Header", eventData.header),
        footer: getPublicImageUrl(safeEventId, "Footer", eventData.footer)
      },
      gallery: getGalleryImageUrls(eventData.gelleryid, eventData.gallery)
    };
  } catch (err) {
    console.error("❌ Error in fetchEventDetails:", err.message);
    throw err;
  }
};

module.exports = { fetchEventDetails };
