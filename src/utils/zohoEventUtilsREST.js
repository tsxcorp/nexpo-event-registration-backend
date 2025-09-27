const axios = require('axios');
// Temporarily use console.log instead of logger to avoid production crash
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};
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
logger.info('🔍 Zoho Event Utils REST Environment Variables:');
logger.info(`  ZOHO_ORG_NAME: ${ZOHO_ORG_NAME ? '✅ Set' : '❌ Missing'}`);
logger.info(`  ZOHO_BASE_URL: ${ZOHO_BASE_URL ? '✅ Set' : '❌ Missing'}`);
logger.info(`  ZOHO_PUBLIC_KEY: ${ZOHO_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);

/**
 * Get Zoho OAuth token with automatic refresh
 */
const getZohoToken = async () => {
  const zohoOAuthService = require('./zohoOAuthService');
  
  try {
    // Use OAuth service to get valid token (with auto-refresh)
    const token = await zohoOAuthService.getValidAccessToken();
    return token;
  } catch (error) {
    logger.error('Error getting valid Zoho token:', error.message);
    throw new Error('Zoho OAuth token not available');
  }
};

/**
 * Fetch event data using Zoho Creator REST API v2.1
 */
const fetchEventDetailsREST = async (eventIdInput) => {
  try {
    const token = await getZohoToken();
    logger.info(`🔍 Fetching event data via REST API for: ${eventIdInput}`);
    
    // Check if this is a list all events request
    if (eventIdInput === "NEXPO") {
      return await fetchAllEventsREST(token);
    }
    
    // Fetch single event details
    return await fetchSingleEventREST(eventIdInput, token);
    
  } catch (err) {
    logger.error("❌ Error in fetchEventDetailsREST:", err.message);
    throw err;
  }
};

/**
 * Fetch all events using REST API
 */
const fetchAllEventsREST = async (token) => {
  try {
    // Get all events from API_Events report
    const eventsUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/API_Events`;
    
    logger.info(`📋 Fetching all events from REST API...`);
    
    const response = await axios.get(eventsUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Accept': 'application/json'
      },
      params: {
        field_config: 'all' // Get all fields
      }
    });

    if (response.data.code !== 3000 || !response.data.data) {
      throw new Error(`Invalid response from Zoho REST API: ${JSON.stringify(response.data)}`);
    }

    const eventsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
    
    logger.info(`📋 Found ${eventsData.length} events via REST API`);

    const processedEvents = eventsData.map(event => {
      const safeEventId = String(event.ID);
      
      return {
        id: safeEventId,
        name: event.Event_Name || "",
        description: event.Description || "",
        start_date: event.Start_Date || "",
        end_date: event.End_Date || "",
        logo: event.Logo || "",
        banner: event.Banner || "",
        email: event.Email || "",
        location: event.Location || "",
        badge_size: event.Badge_Size || "",
        badge_printing: event.Badge_Printing === true || event.Badge_Printing === "true",
        ticket_mode: event.Ticketing_Enable === true || event.Ticketing_Enable === "true",
        one_time_check_in: event.One_Time_Check_In === true || event.One_Time_Check_In === "true"
      };
    });

    return {
      events: processedEvents,
      total: processedEvents.length,
      mode: "list",
      source: "rest_api"
    };

  } catch (error) {
    logger.error('Error fetching all events via REST API:', error.message);
    throw error;
  }
};

/**
 * Fetch single event details using REST API
 */
const fetchSingleEventREST = async (eventId, token) => {
  try {
    // 1. Get event basic info
    const eventUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/API_Events/${eventId}`;
    
    logger.info(`🔍 Fetching event details for: ${eventId}`);
    
    const eventResponse = await axios.get(eventUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Accept': 'application/json'
      },
      params: {
        field_config: 'all'
      }
    });

    if (eventResponse.data.code !== 3000 || !eventResponse.data.data) {
      throw new Error(`Invalid event response from Zoho REST API: ${JSON.stringify(eventResponse.data)}`);
    }

    const eventData = eventResponse.data.data;

     // 2. Extract form fields from API_Events response (Form_Fields arrays)
     let formFields = [];
     if (eventData['Form_Fields.Field_ID'] && Array.isArray(eventData['Form_Fields.Field_ID'])) {
       const fieldCount = eventData['Form_Fields.Field_ID'].length;
       logger.info(`Debug: Found ${fieldCount} form fields in API_Events arrays`);
       
       // Build formFields from arrays - each index represents one field
       const allFormFields = Array.from({ length: fieldCount }, (_, index) => {
         const field_id = eventData['Form_Fields.Field_ID']?.[index] || `auto_field_${index}`;
         const label = eventData['Form_Fields.Label']?.[index] || '';
         const type = eventData['Form_Fields.Type_field']?.[index] || '';
         const required = eventData['Form_Fields.Required']?.[index] === 'true';
         const sort = parseInt(eventData['Form_Fields.Sort']?.[index]) || index;
         const status = eventData['Form_Fields.Status']?.[index] || 'active';
         const helptext = eventData['Form_Fields.Help_Text']?.[index] || '';
         const placeholder = eventData['Form_Fields.Placeholder']?.[index] || '';
         const field_condition = eventData['Form_Fields.Field_Condition']?.[index] || '';
         const section_id = eventData['Form_Fields.Section_ID']?.[index] || '';
         const section_name = eventData['Form_Fields.Section_Name']?.[index] || '';
         const section_sort = eventData['Form_Fields.Section_Sort']?.[index] || '';
         const section_condition = eventData['Form_Fields.Section_Condition']?.[index] || '';
         const matching_field = eventData['Form_Fields.Matching_Field']?.[index] === 'true';
         const groupmember = eventData['Form_Fields.Group_Member_Field']?.[index] === 'true';
         const value = eventData['Form_Fields.Value']?.[index] || '';
         const values = value ? value.split(',').map(v => v.trim()) : [];
         const content = eventData['Form_Fields.Content']?.[index] || '';
         const checkbox_label = eventData['Form_Fields.Checkbox_Label']?.[index] || null;
         const link_text = eventData['Form_Fields.Link_Text']?.[index] || null;
         const link_url = eventData['Form_Fields.Link_URL']?.[index] || null;
         // Ensure link_url is null if empty object
         const final_link_url = (link_url && typeof link_url === 'object' && Object.keys(link_url).length === 0) ? null : link_url;
         const title = eventData['Form_Fields.Title']?.[index] || null;
         
         // Build translation object
         const en_label = eventData['Form_Fields.en_Label']?.[index];
         const translation = en_label ? {
           label: en_label,
           placeholder: eventData['Form_Fields.en_Placeholder']?.[index] || '',
           helptext: eventData['Form_Fields.en_HelpText']?.[index] || '',
           value: eventData['Form_Fields.en_Value']?.[index] || ''
         } : null;
         
         return {
           field_id,
           sort,
           label,
           type,
           required,
           groupmember,
           helptext,
           placeholder,
           field_condition,
           section_id,
           section_name,
           section_sort,
           section_condition,
           matching_field,
           values,
           content,
           checkbox_label,
           link_text,
           link_url: final_link_url,
           title,
           translation,
           status: status.toLowerCase()
         };
       });
       
       // Filter only Active fields
       formFields = allFormFields.filter(field => field.status === 'active');
       
       logger.info(`Filtered ${formFields.length} active fields from ${allFormFields.length} total fields`);
     }

    // 3. Extract exhibitors from event data (already included in API_Events response)
    let exhibitors = [];
    if (eventData.Exhibitor_List && Array.isArray(eventData.Exhibitor_List)) {
      exhibitors = eventData.Exhibitor_List.map(exhibitor => ({
        id: String(exhibitor.ID),
        event_info: {
          id: String(exhibitor.Event_Info?.ID || ""),
          name: exhibitor.Event_Info?.Event_Name || ""
        }
      }));
      logger.info(`Extracted ${exhibitors.length} exhibitors from event data`);
    }

    // 4. Extract sessions from event data (already included in API_Events response)
    let sessions = [];
    if (eventData.Sessions && Array.isArray(eventData.Sessions)) {
      sessions = eventData.Sessions.map(session => ({
        id: String(session.ID),
        event_info: {
          id: String(session.Event_Info?.ID || ""),
          name: session.Event_Info?.Event_Name || ""
        }
      }));
      logger.info(`Extracted ${sessions.length} sessions from event data`);
    }

    // 5. Get gallery images from Event_Gallery report
    let galleryUrls = [];
    try {
      galleryUrls = await fetchEventGallery(eventId, token);
    } catch (error) {
      logger.warn(`Failed to fetch gallery for event ${eventId}:`, error.message);
    }

    // Helper function to build proxy image URLs (via backend)
    const buildProxyImageUrl = (relativeUrl, recordId, fieldName) => {
      if (!relativeUrl) return "";
      
      // Extract filename from relative URL
      // Example: /api/v2.1/tsxcorp/nxp/report/API_Events/4433256000013547003/Banner/download?filepath=1757774775515574_HTTV___YBA__1920x600_.jpg
      const filepathMatch = relativeUrl.match(/filepath=([^&]+)/);
      if (!filepathMatch) return "";
      
      const filename = filepathMatch[1];
      
      // Build absolute proxy URL through backend (no token needed for frontend)
      // Frontend can use this URL directly in <img> or Next.js Image
      const baseUrl = process.env.BACKEND_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
      return `${baseUrl}/api/proxy-image?recordId=${recordId}&fieldName=${fieldName}&filename=${encodeURIComponent(filename)}`;
    };

    // Build image URLs with proxy URLs (via backend)
    const banner = buildProxyImageUrl(eventData.Banner, eventData.ID, "Banner");
    const logo = buildProxyImageUrl(eventData.Logo, eventData.ID, "Logo");
    const header = buildProxyImageUrl(eventData.Header, eventData.ID, "Header");
    const footer = buildProxyImageUrl(eventData.Footer, eventData.ID, "Footer");
    const favicon = buildProxyImageUrl(eventData.Favicon, eventData.ID, "Favicon");
    const floor_plan_pdf = buildProxyImageUrl(eventData.Floor_Plan, eventData.ID, "Floor_Plan");

    // Process the event data
    const processedEvent = {
      id: String(eventData.ID),
      name: eventData.Event_Name || "",
      description: eventData.Description || "",
      email: eventData.Email || "",
      location: eventData.Location || "",
      start_date: eventData.Start_Date || "",
      end_date: eventData.End_Date || "",
      badge_size: eventData.Badge_Size || "",
      badge_custom_content: parseBadgeCustomContent(eventData.Badge_Custom_Content),
      badge_printing: eventData.Badge_Printing === true || eventData.Badge_Printing === "true",
      ticket_mode: eventData.Ticketing_Enable === true || eventData.Ticketing_Enable === "true",
      one_time_check_in: eventData.One_Time_Check_In === true || eventData.One_Time_Check_In === "true",
      formFields: formFields,
      exhibitors: exhibitors,
      sessions: sessions,
      sessions_by_date: groupSessionsByDate(sessions),
      banner: banner,
      logo: logo,
      header: header,
      footer: footer,
      favicon: favicon,
      floor_plan_pdf: floor_plan_pdf
    };

    return {
      event: processedEvent,
      gallery: galleryUrls,
      mode: "single",
      source: "rest_api"
    };

  } catch (error) {
    logger.error(`Error fetching single event ${eventId} via REST API:`, error.message);
    throw error;
  }
};


/**
 * Fetch exhibitors for an event
 */
const fetchEventExhibitors = async (eventId, token) => {
  try {
    const exhibitorsUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/Exhibitor_List`;
    
    const response = await axios.get(exhibitorsUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Accept': 'application/json'
      },
      params: {
        field_config: 'all',
        criteria: `Event_Info = ${eventId}`
      }
    });

    if (response.data.code !== 3000 || !response.data.data) {
      logger.warn(`No exhibitors found for event ${eventId}`);
      return [];
    }

    const exhibitorsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
    
    return exhibitorsData.map(exhibitor => ({
      exhibitor_profile_id: exhibitor.Exhibitor_Profile_ID ? String(exhibitor.Exhibitor_Profile_ID) : "",
      display_name: exhibitor.Display_Name || "",
      en_company_name: exhibitor.EN_Company_Name || "",
      vi_company_name: exhibitor.VI_Company_Name || "",
      booth_no: exhibitor.Booth_No || "",
      category: exhibitor.Category || "",
      country: exhibitor.Country || "",
      email: exhibitor.Email || "",
      tel: exhibitor.Tel || "",
      mobile: exhibitor.Mobile || "",
      fax: exhibitor.Fax || "",
      website: exhibitor.Website || "",
      zip_code: exhibitor.Zip_Code || "",
      vie_address: exhibitor.VIE_Address || "",
      eng_address: exhibitor.ENG_Address || "",
      vie_company_description: exhibitor.VIE_Company_Description || "",
      eng_company_description: exhibitor.ENG_Company_Description || "",
      vie_display_products: exhibitor.VIE_Display_Products || "",
      eng_display_products: exhibitor.ENG_Display_Products || "",
      introduction_video: exhibitor.Introduction_Video || "",
      company_logo: exhibitor.Company_Logo ? getExhibitorImageUrl(String(exhibitor.Exhibitor_Profile_ID), "Company_Logo", exhibitor.Company_Logo) : "",
      cover_image: exhibitor.Cover_Image ? getExhibitorImageUrl(String(exhibitor.Exhibitor_Profile_ID), "Cover_Image", exhibitor.Cover_Image) : ""
    }));

  } catch (error) {
    logger.error(`Error fetching exhibitors for event ${eventId}:`, error.message);
    return [];
  }
};

/**
 * Fetch sessions for an event
 */
const fetchEventSessions = async (eventId, token) => {
  try {
    const sessionsUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/Event_Sessions`;
    
    const response = await axios.get(sessionsUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Accept': 'application/json'
      },
      params: {
        field_config: 'all',
        criteria: `Event_Info = ${eventId}`
      }
    });

    if (response.data.code !== 3000 || !response.data.data) {
      logger.warn(`No sessions found for event ${eventId}`);
      return [];
    }

    const sessionsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
    
    return sessionsData.map(session => ({
      id: session.ID ? String(session.ID) : "",
      title: session.Title || "",
      date: session.Date || "",
      start_time: session.Start_Time || "",
      end_time: session.End_Time || "",
      description: session.Description || "",
      speaker_name: session.Speaker_Name || "",
      speaker_id: session.Speaker_ID ? String(session.Speaker_ID) : "",
      area_name: session.Area_Name || "",
      area_id: session.Area_ID ? String(session.Area_ID) : "",
      session_accessibility: session.Session_Accessibility || "",
      session_banner: session.Session_Banner ? getSessionImageUrl(String(session.ID), "Banner", session.Session_Banner) : ""
    }));

  } catch (error) {
    logger.error(`Error fetching sessions for event ${eventId}:`, error.message);
    return [];
  }
};

/**
 * Fetch gallery images for an event
 */
const fetchEventGallery = async (eventId, token) => {
  try {
    const galleryUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/Event_Gallery`;
    
    const response = await axios.get(galleryUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Accept': 'application/json'
      },
      params: {
        field_config: 'all',
        criteria: `Event_ID = ${eventId}`
      }
    });

    if (response.data.code !== 3000 || !response.data.data) {
      logger.warn(`No gallery images found for event ${eventId}`);
      return [];
    }

    const galleryData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
    
    return galleryData.map(image => {
      if (image.Image_Path) {
        return getGalleryImageUrl(eventId, image.Image_Path);
      }
      return "";
    }).filter(url => url !== "");

  } catch (error) {
    logger.error(`Error fetching gallery for event ${eventId}:`, error.message);
    return [];
  }
};

/**
 * Parse badge custom content from string or object
 */
const parseBadgeCustomContent = (badgeContent) => {
  if (!badgeContent) return {};
  
  if (typeof badgeContent === 'string') {
    try {
      return JSON.parse(badgeContent);
    } catch (error) {
      return {};
    }
  }
  
  return badgeContent;
};

/**
 * Group sessions by date
 */
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

module.exports = { 
  fetchEventDetailsREST
};
