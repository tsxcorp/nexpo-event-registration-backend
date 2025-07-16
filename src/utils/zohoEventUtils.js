const axios = require('axios');

const {
  ZOHO_ORG_NAME,
  ZOHO_APP_NAME,
  ZOHO_BASE_URL,
  ZOHO_PUBLIC_KEY,
  ZOHO_PRIVATELINK_ALL_EVENTS,
  ZOHO_PRIVATELINK_GALLERY,
  ZOHO_PRIVATELINK_EXHIBITOR_PROFILES
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

// 🏢 Build public exhibitor image URLs
const getExhibitorImageUrl = (recordId, fieldName, filePath) => {
  if (!filePath) return "";
  return `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/${ZOHO_APP_NAME}/All_Exhibitor_Profiles/${recordId}/${fieldName}/image-download/${ZOHO_PRIVATELINK_EXHIBITOR_PROFILES}?filepath=/${filePath}`;
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
    const enrichedFields = (eventData.formFields || []).map((field, index) => {
      const processedField = {
        field_id: field.field_id || `auto_field_${index}`, // Auto-generate if missing
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

    // 🏢 Xử lý exhibitors data
    const processedExhibitors = (eventData.exhibitors || []).map(exhibitor => {
      return {
        exhibitor_profile_id: exhibitor.exhibitor_profile_id ? String(exhibitor.exhibitor_profile_id) : "",
        display_name: exhibitor.display_name || "",
        booth_no: exhibitor.booth_no || "",
        category: exhibitor.category || "",
        country: exhibitor.country || "",
        email: exhibitor.email || "",
        tel: exhibitor.tel || "",
        mobile: exhibitor.mobile || "",
        fax: exhibitor.fax || "",
        website: exhibitor.website || "",
        zip_code: exhibitor.zip_code || "",
        vie_address: exhibitor.vie_address || "",
        eng_address: exhibitor.eng_address || "",
        vie_company_description: exhibitor.vie_company_description || "",
        eng_company_description: exhibitor.eng_company_description || "",
        vie_display_products: exhibitor.vie_display_products || "",
        eng_display_products: exhibitor.eng_display_products || "",
        introduction_video: exhibitor.introduction_video || "",
        company_logo: exhibitor.company_logo ? getExhibitorImageUrl(String(exhibitor.exhibitor_profile_id), "Company_Logo", exhibitor.company_logo) : "",
        cover_image: exhibitor.cover_image ? getExhibitorImageUrl(String(exhibitor.exhibitor_profile_id), "Cover_Image", exhibitor.cover_image) : ""
      };
    });

    // 🖼️ Xử lý gallery - support both old and new structure
    let galleryUrls = [];
    if (eventData.gallery && eventData.gallery.obj && Array.isArray(eventData.gallery.obj)) {
      galleryUrls = getGalleryImageUrls(eventData.gelleryid, eventData.gallery);
    } else if (Array.isArray(eventData.gallery)) {
      // Support old structure
      galleryUrls = getGalleryImageUrls(eventData.gelleryid, { obj: eventData.gallery });
    }

    return {
      event: {
        id: safeEventId,
        name: eventData.name,
        description: eventData.description,
        email: eventData.email,
        location: eventData.location || "",
        start_date: eventData.start_date || "",
        end_date: eventData.end_date || "",
        formFields: enrichedFields,
        exhibitors: processedExhibitors,
        banner: getPublicImageUrl(safeEventId, "Banner", eventData.banner),
        logo: getPublicImageUrl(safeEventId, "Logo", eventData.logo),
        header: getPublicImageUrl(safeEventId, "Header", eventData.header),
        footer: getPublicImageUrl(safeEventId, "Footer", eventData.footer),
        favicon: getPublicImageUrl(safeEventId, "Favicon", eventData.favicon)
      },
      gallery: galleryUrls
    };
  } catch (err) {
    console.error("❌ Error in fetchEventDetails:", err.message);
    throw err;
  }
};

module.exports = { fetchEventDetails };
