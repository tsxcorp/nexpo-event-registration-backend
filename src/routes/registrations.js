const express = require('express');
const router = express.Router();
const { submitRegistration } = require('../utils/zohoRegistrationSubmit');
const { fetchEventDetails } = require('../utils/zohoEventUtils');
const socketService = require('../services/socketService');
const redisService = require('../services/redisService');

/**
 * @swagger
 * /api/registrations:
 *   post:
 *     summary: Đăng ký tham gia sự kiện
 *     parameters:
 *       - in: query
 *         name: Event_Info
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sự kiện trong Zoho. Có thể truyền qua query param (?Event_Info=123) hoặc trong request body
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Event_Info:
 *                 type: string
 *                 description: ID của sự kiện (optional if provided as query param)
 *               title:
 *                 type: string
 *                 description: Salutation (Mr., Ms., etc.)
 *               full_name:
 *                 type: string
 *                 description: Full name of the registrant
 *               email:
 *                 type: string
 *                 description: Email address
 *               mobile_number:
 *                 type: string
 *                 description: Phone number
 *               custom_fields_value:
 *                 type: object
 *                 description: "Custom fields with metadata support. Supports 3 formats: 1) Metadata format: field_id: {field_label, field_condition, value}, 2) Simple format: field_id: value, 3) Legacy format: field_label: value"
 *                 additionalProperties:
 *                   oneOf:
 *                     - type: object
 *                       description: "Metadata format with field information"
 *                       properties:
 *                         field_label:
 *                           type: string
 *                           description: "Display label for the field"
 *                         field_condition:
 *                           type: string
 *                           description: "Field condition (required, optional, etc.)"
 *                         value:
 *                           type: string
 *                           description: "Actual field value"
 *                       required:
 *                         - value
 *                     - type: string
 *                       description: "Simple value format (legacy)"
 *                 example:
 *                   vilog2025_jobtitle:
 *                     field_label: "Job Title"
 *                     field_condition: "required"
 *                     value: "CEO"
 *                   vilog2025_company:
 *                     field_label: "Company Name"
 *                     field_condition: "optional"
 *                     value: "ABC Corp"
 *               group_members:
 *                 type: array
 *                 description: Array of group members for group registration
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: Salutation (Mr., Ms., etc.)
 *                     full_name:
 *                       type: string
 *                       description: Full name of group member
 *                     email:
 *                       type: string
 *                       description: Email address of group member
 *                     mobile_number:
 *                       type: string
 *                       description: Phone number of group member
 *                   required:
 *                     - full_name
 *                     - email
 *             required:
 *               - full_name
 *               - email
 *               - mobile_number
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 *       500:
 *         description: Gửi đăng ký thất bại
 */
router.post('/', async (req, res) => {
  try {
    // Get eventId from query params as per Swagger documentation
    const eventId = req.query.Event_Info || req.query.event_info || req.body.Event_Info || req.body.event_info;
    let fieldDefinitions = [];
    
    // Fetch field definitions from event data for proper field_id processing
    if (eventId) {
      try {
        console.log(`🔍 Fetching event details for field definitions: ${eventId}`);
        const eventDetails = await fetchEventDetails(eventId);
        fieldDefinitions = eventDetails.event.formFields || [];
        console.log(`📋 Found ${fieldDefinitions.length} field definitions`);
      } catch (eventError) {
        console.warn(`⚠️ Could not fetch event details for field processing: ${eventError.message}`);
        // Continue without field definitions - will use backward compatibility mode
      }
    }
    
    // Add field definitions and eventId to the request data for processing
    const dataWithFieldDefs = {
      ...req.body,
      Event_Info: eventId, // Ensure Event_Info is included regardless of source (query or body)
      fieldDefinitions: fieldDefinitions
    };
    
    const customFieldsData = req.body.Custom_Fields_Value || req.body.custom_fields_value;
    console.log('📥 Registration request received:', {
      eventId,
      eventIdSource: req.query.Event_Info ? 'query.Event_Info' : 
                     req.query.event_info ? 'query.event_info' : 
                     req.body.Event_Info ? 'body.Event_Info' : 
                     req.body.event_info ? 'body.event_info' : 'not_found',
      hasCustomFields: !!customFieldsData,
      customFieldsCount: customFieldsData ? Object.keys(customFieldsData).length : 0,
      fieldDefinitionsCount: fieldDefinitions.length
    });

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'Missing Event_Info',
        message: 'Event_Info must be provided as query parameter or in request body'
      });
    }
    
    const result = await submitRegistration(dataWithFieldDefs);
    
    // Check if this is a buffered submission
    if (result?.status === 'buffered') {
      return res.status(202).json(result);
    }
    
    if (!result?.zoho_record_id) {
      return res.status(500).json({
        success: false,
        error: 'Missing Zoho record ID',
        zohoResponse: result
      });
    }

    // 🚀 REAL-TIME UPDATE: Update Redis cache and notify clients
    try {
      console.log('🔄 Updating Redis cache with new registration...');
      
      // Update Redis cache with new record
      const eventId = result.event_id || result.Event_Info?.ID || result.Event_Info;
      const recordId = result.zoho_record_id || result.ID;
      
      console.log('🔍 Debug result for Redis sync:', {
        event_id: result.event_id,
        Event_Info: result.Event_Info,
        Event_Info_ID: result.Event_Info?.ID,
        zoho_record_id: result.zoho_record_id,
        ID: result.ID
      });
      
      if (eventId && recordId) {
        console.log(`📝 Syncing new record ${recordId} to Redis for event ${eventId}`);
        await redisService.updateEventRecord(eventId, result, recordId);
        await redisService.updateCacheMetadata();
        console.log('✅ Redis cache updated successfully');
      } else {
        console.warn('⚠️ Missing eventId or recordId, skipping Redis sync');
      }
      
      // Broadcast to Socket.IO clients
      const registrationData = {
        type: 'new_registration',
        event_id: eventId,
        zoho_record_id: result.zoho_record_id,
        timestamp: new Date().toISOString(),
        message: 'New registration received'
      };
      
      socketService.pushRegistrationData(eventId, registrationData, 'new_registration');
      
      console.log('✅ Real-time updates sent successfully');
    } catch (updateError) {
      console.warn('⚠️ Real-time update failed (registration still successful):', updateError.message);
      // Don't fail the request - registration was successful
    }

    res.status(200).json(result); // ✅ Trả toàn bộ object gốc luôn

  } catch (err) {
    console.error("❌ Zoho submission error:", err.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to submit form',
      details: err.message,
    });
  }
});

module.exports = router;