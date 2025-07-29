const express = require('express');
const router = express.Router();
const { submitRegistration } = require('../utils/zohoSubmit');
const { fetchEventDetails } = require('../utils/zohoEventUtils');

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
 *                 description: Additional custom fields from the event form (supports both custom_fields_value and Custom_Fields_Value)
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
    
    if (!result?.zoho_record_id) {
      return res.status(500).json({
        success: false,
        error: 'Missing Zoho record ID',
        zohoResponse: result
      });
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