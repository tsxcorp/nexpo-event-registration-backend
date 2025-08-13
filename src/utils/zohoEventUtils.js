const axios = require('axios');
const { 
  getEventImageUrl,
  getGalleryImageUrl,
  getExhibitorImageUrl,
  getSessionImageUrl
} = require('./zohoImageUtils');

const {
  ZOHO_ORG_NAME,
  ZOHO_BASE_URL,
  ZOHO_PUBLIC_KEY
} = process.env;

// 🔍 Debug: Check environment variables
console.log('🔍 Zoho Event Utils Environment Variables:');
console.log('  ZOHO_ORG_NAME:', ZOHO_ORG_NAME ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_BASE_URL:', ZOHO_BASE_URL ? '✅ Set' : '❌ Missing');
console.log('  ZOHO_PUBLIC_KEY:', ZOHO_PUBLIC_KEY ? '✅ Set' : '❌ Missing');



// 🚀 Fetch full event data from Zoho Creator Custom API
const fetchEventDetails = async (eventIdInput) => {
  const apiUrl = `${ZOHO_BASE_URL}/creator/custom/${ZOHO_ORG_NAME}/NXP_getEventInfo`;

  try {
    console.log(`🔍 Fetching event data for: ${eventIdInput}`);
    
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

    // Check if this is a list all events request (when eventIdInput is "NEXPO")
    if (eventIdInput === "NEXPO") {
      // Check multiple possible response structures
      let eventsArray = null;
      
      if (data.events && Array.isArray(data.events)) {
        eventsArray = data.events;
        console.log(`📋 Found ${eventsArray.length} events in data.events`);
      } else if (Array.isArray(data)) {
        eventsArray = data;
        console.log(`📋 Found ${eventsArray.length} events in direct array`);
      } else if (data.result && data.result.events && Array.isArray(data.result.events)) {
        eventsArray = data.result.events;
        console.log(`📋 Found ${eventsArray.length} events in data.result.events`);
      }
      
      if (eventsArray) {
        // Process list of events
        const processedEvents = eventsArray.map(event => {
          const safeEventId = String(event.id);
          
          return {
            id: safeEventId,
            name: event.name || "",
            description: event.description || "",
            start_date: event.start_date || "",
            end_date: event.end_date || "",
            logo: event.logo || "",
            banner: event.banner || "",
            email: event.email || "",
            location: event.location || "",
            badge_size: event.badge_size || "",
            badge_printing: event.badge_printing || false
          };
        });

        return {
          events: processedEvents,
          total: processedEvents.length,
          mode: "list"
        };
      } else {
        console.error('❌ No events array found in NEXPO response:', {
          hasEvents: !!data.events,
          hasResult: !!data.result,
          hasResultEvents: !!data.result?.events,
          isArray: Array.isArray(data),
          responseKeys: Object.keys(data)
        });
        throw new Error("Invalid response for NEXPO mode - no events array found");
      }
    }

    // Original single event processing
    const eventData = data.result?.event;

    if (!eventData) {
      console.error('❌ No event data found in response:', {
        hasResult: !!data.result,
        hasEvent: !!data.result?.event,
        responseKeys: Object.keys(data)
      });
      throw new Error("Invalid or incomplete response from Zoho Custom API - no event data found.");
    }

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

      // Thêm translation object
      if (field.translation) {
        processedField.translation = {
          en_sectionname: field.translation.en_sectionname || "",
          en_label: field.translation.en_label || "",
          en_value: field.translation.en_value || "",
          en_placeholder: field.translation.en_placeholder || "",
          en_helptext: field.translation.en_helptext || "",
          en_agreementcontent: field.translation.en_agreementcontent || "",
          en_agreementtitle: field.translation.en_agreementtitle || "",
          en_checkboxlabel: field.translation.en_checkboxlabel || "",
          en_linktext: field.translation.en_linktext || ""
        };
      }

      return processedField;
    });

    // 🏢 Xử lý exhibitors data
    const processedExhibitors = (eventData.exhibitors || []).map(exhibitor => {
      return {
        exhibitor_profile_id: exhibitor.exhibitor_profile_id ? String(exhibitor.exhibitor_profile_id) : "",
        display_name: exhibitor.display_name || "",
        en_company_name: exhibitor.en_company_name || "",
        vi_company_name: exhibitor.vi_company_name || "",
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
      galleryUrls = eventData.gallery.obj.map(imagePath => {
        return getGalleryImageUrl(eventData.gelleryid, imagePath);
      });
    } else if (Array.isArray(eventData.gallery)) {
      // Support old structure
      galleryUrls = eventData.gallery.map(imagePath => {
        return getGalleryImageUrl(eventData.gelleryid, imagePath);
      });
    }

    // 📅 Xử lý sessions data
    const processedSessions = (eventData.sessions || []).map(session => {
      return {
        id: session.id ? String(session.id) : "",
        title: session.title || "",
        date: session.date || "",
        start_time: session.start_time || "",
        end_time: session.end_time || "",
        description: session.description || "",
        speaker_name: session.speaker_name || "",
        speaker_id: session.speaker_id ? String(session.speaker_id) : "",
        area_name: session.area_name || "",
        area_id: session.area_id ? String(session.area_id) : "",
        session_accessibility: session.session_accessibility || "",
        session_banner: session.session_banner ? getSessionImageUrl(String(session.id), "Banner", session.session_banner) : ""
      };
    });

    // 🗓️ Group sessions by date for minimalist timeline
    const groupSessionsByDate = (sessions) => {
      const grouped = {};
      sessions.forEach(session => {
        const date = session.date;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(session);
      });

      return Object.keys(grouped).sort().map(date => {
        const sessionsForDate = grouped[date];
        
        // Format date for better display
        const dateObj = new Date(date);
        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        
        return {
          date: date,
          display_date: `${String(dateObj.getDate()).padStart(2, '0')}-${monthNames[dateObj.getMonth()]}`,
          day_name: dayNames[dateObj.getDay()],
          session_count: sessionsForDate.length,
          sessions: sessionsForDate
        };
      });
    };

    const sessionsByDate = groupSessionsByDate(processedSessions);

    return {
      event: {
        id: String(eventData.id), // Ensure it's a string
        name: eventData.name,
        description: eventData.description,
        email: eventData.email,
        location: eventData.location || "",
        start_date: eventData.start_date || "",
        end_date: eventData.end_date || "",
        badge_size: eventData.badge_size || "",
        badge_custom_content: eventData.badge_custom_content || {},
        badge_printing: eventData.badge_printing || false,
        formFields: enrichedFields,
        exhibitors: processedExhibitors,
        sessions: processedSessions,
        sessions_by_date: sessionsByDate,
        banner: getEventImageUrl(String(eventData.id), "Banner", eventData.banner),
        logo: getEventImageUrl(String(eventData.id), "Logo", eventData.logo),
        header: getEventImageUrl(String(eventData.id), "Header", eventData.header),
        footer: getEventImageUrl(String(eventData.id), "Footer", eventData.footer),
        favicon: getEventImageUrl(String(eventData.id), "Favicon", eventData.favicon),
        floor_plan_pdf: eventData.floor_plan_pdf || ""
      },
      gallery: galleryUrls,
      mode: "single"
    };
  } catch (err) {
    console.error("❌ Error in fetchEventDetails:", err.message);
    throw err;
  }
};

module.exports = { 
  fetchEventDetails
};
