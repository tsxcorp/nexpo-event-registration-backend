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

    // 🔄 Xử lý formFields thêm "value" nếu là Select hoặc Multi Select
    const enrichedFields = (eventData.formFields || []).map(field => ({
      sort: field.sort,
      label: field.label,
      helptext: field.helptext,
      type: field.type,
      required: field.required,
      ...(["Select", "Multi Select"].includes(field.type) && field.values
        ? { values: field.values }
        : {})
    }));

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
