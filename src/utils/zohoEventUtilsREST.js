const axios = require('axios');
const logger = require('./logger');
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
 * Get Zoho OAuth token from tokens.json
 */
const getZohoToken = () => {
  try {
    const tokens = require('../../tokens.json');
    return tokens.accessToken || tokens.access_token;
  } catch (error) {
    logger.error('Error loading Zoho tokens:', error.message);
    throw new Error('Zoho OAuth token not available');
  }
};

/**
 * Fetch event data using Zoho Creator REST API v2.1
 */
const fetchEventDetailsREST = async (eventIdInput) => {
  const token = getZohoToken();
  
  try {
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
    // Get all events from All_Events report
    const eventsUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/All_Events`;
    
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
        ticket_mode: event.Ticketing_Enable === true || event.Ticketing_Enable === "true"
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
    const eventUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/All_Events/${eventId}`;
    
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

    // 2. Get form fields from All_Events response (Form_Fields field)
    let formFields = [];
    if (eventData.Form_Fields && Array.isArray(eventData.Form_Fields)) {
      formFields = eventData.Form_Fields.map((field, index) => ({
        field_id: field.ID || `auto_field_${index}`,
        sort: parseInt(field.Sort) || index,
        label: field.Label || "",
        type: field.Type_field || "",
        required: false, // Not available in this response
        groupmember: false, // Not available in this response
        helptext: "", // Not available in this response
        placeholder: "", // Not available in this response
        field_condition: "", // Not available in this response
        section_id: "", // Not available in this response
        section_name: "", // Not available in this response
        section_sort: 0, // Not available in this response
        section_condition: "", // Not available in this response
        matching_field: false, // Not available in this response
        values: [], // Not available in this response
        translation: null // Not available in this response
      }));
      logger.info(`Found ${formFields.length} form fields in All_Events response`);
    }

    // 3. Get exhibitors from Event_Exhibitors report
    let exhibitors = [];
    try {
      exhibitors = await fetchEventExhibitors(eventId, token);
    } catch (error) {
      logger.warn(`Failed to fetch exhibitors for event ${eventId}:`, error.message);
    }

    // 4. Get sessions from Event_Sessions report
    let sessions = [];
    try {
      sessions = await fetchEventSessions(eventId, token);
    } catch (error) {
      logger.warn(`Failed to fetch sessions for event ${eventId}:`, error.message);
    }

    // 5. Get gallery images from Event_Gallery report
    let galleryUrls = [];
    try {
      galleryUrls = await fetchEventGallery(eventId, token);
    } catch (error) {
      logger.warn(`Failed to fetch gallery for event ${eventId}:`, error.message);
    }

    // Helper function to build Custom API style image URLs
    const buildCustomStyleImageUrl = (relativeUrl, recordId, fieldName) => {
      if (!relativeUrl) return "";
      
      // Extract filename from relative URL
      // Example: /api/v2.1/tsxcorp/nxp/report/All_Events/4433256000013547003/Banner/download?filepath=1757774775515574_HTTV___YBA__1920x600_.jpg
      const filepathMatch = relativeUrl.match(/filepath=([^&]+)/);
      if (!filepathMatch) return "";
      
      const filename = filepathMatch[1];
      
      // Use private link from environment variable
      const privateLink = process.env.ZOHO_PRIVATELINK_ALL_EVENTS;
      
      if (!privateLink) {
        logger.warn(`ZOHO_PRIVATELINK_ALL_EVENTS not set, using fallback URL`);
        return `https://www.zohoapis.com${relativeUrl}`;
      }
      
      // Build Custom API style URL
      // Format: https://creatorexport.zoho.com/file/{org}/{app}/{table}/{recordId}/{field}/image-download/{private_link}
      const baseUrl = `https://creatorexport.zoho.com/file/${ZOHO_ORG_NAME}/nxp/All_Events/${recordId}/${fieldName}/image-download/${privateLink}`;
      
      return `${baseUrl}?filepath=/${filename}`;
    };

    // Build image URLs with Custom API style
    const banner = buildCustomStyleImageUrl(eventData.Banner, eventData.ID, "Banner");
    const logo = buildCustomStyleImageUrl(eventData.Logo, eventData.ID, "Logo");
    const header = buildCustomStyleImageUrl(eventData.Header, eventData.ID, "Header");
    const footer = buildCustomStyleImageUrl(eventData.Footer, eventData.ID, "Footer");
    const favicon = buildCustomStyleImageUrl(eventData.Favicon, eventData.ID, "Favicon");
    const floor_plan_pdf = buildCustomStyleImageUrl(eventData.Floor_Plan, eventData.ID, "Floor_Plan");

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
 * Fetch form fields for an event
 */
const fetchEventFormFields = async (eventId, token) => {
  try {
    const formFieldsUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/Event_Forms`;
    
    const response = await axios.get(formFieldsUrl, {
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
      logger.warn(`No form fields found for event ${eventId}`);
      return [];
    }

    const formFieldsData = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
    
    return formFieldsData.map((field, index) => ({
      field_id: field.Field_ID || `auto_field_${index}`,
      sort: field.Sort_Order || index,
      label: field.Label || "",
      type: field.Field_Type || "",
      required: field.Required === true || field.Required === "true",
      groupmember: field.Group_Member === true || field.Group_Member === "true",
      helptext: field.Help_Text || "",
      placeholder: field.Placeholder || "",
      field_condition: field.Field_Condition || "",
      section_id: field.Section_ID || "",
      section_name: field.Section_Name || "",
      section_sort: field.Section_Sort || 0,
      section_condition: field.Section_Condition || "",
      matching_field: field.Matching_Field === true || field.Matching_Field === "true",
      values: field.Values ? field.Values.split(',').map(v => v.trim()) : [],
      translation: field.Translation ? JSON.parse(field.Translation) : null
    }));

  } catch (error) {
    logger.error(`Error fetching form fields for event ${eventId}:`, error.message);
    return [];
  }
};

/**
 * Fetch exhibitors for an event
 */
const fetchEventExhibitors = async (eventId, token) => {
  try {
    const exhibitorsUrl = `${ZOHO_BASE_URL}/creator/v2.1/data/${ZOHO_ORG_NAME}/nxp/report/Event_Exhibitors`;
    
    const response = await axios.get(exhibitorsUrl, {
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
        criteria: `Event_ID = ${eventId}`
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
