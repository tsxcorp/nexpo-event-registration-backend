const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { 
  submitBusinessMatching, 
  validateBusinessMatchingData, 
  formatBusinessMatchingData 
} = require('../utils/zohoBusinessMatching');

// Business Matching API - Simple endpoint for testing

/**
 * @swagger
 * /api/business-matching/submit:
 *   post:
 *     summary: Submit business matching request
 *     tags: [Business Matching]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_id:
 *                 type: string
 *                 example: "4433256000013114003"
 *               registration_id:
 *                 type: string
 *                 example: "4433256000013160039"
 *               exhibitor_company:
 *                 type: string
 *                 example: "TSX Corp"
 *               date:
 *                 type: string
 *                 example: "2025-08-15"
 *               time:
 *                 type: string
 *                 example: "14:30"
 *               message:
 *                 type: string
 *                 example: "Looking forward to meeting"
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Validation error
 */

router.post('/submit', async (req, res) => {
  try {
    logger.info("Business matching submit request received:", req.body);

    // Format the input data
    const formattedData = formatBusinessMatchingData(req.body);
    logger.info('🔧 Formatted business matching data:', formattedData);

    // Validate the data
    const validation = validateBusinessMatchingData(formattedData);
    if (!validation.isValid) {
      logger.info("❌ Validation failed:", validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    // Submit to Zoho API
    const zohoResponse = await submitBusinessMatching(formattedData);
    
    // Generate a matching ID for tracking
    const matchingId = `MTG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    logger.info("Business matching submitted successfully:", {
      matchingId,
      zohoResponse
    });

    res.json({
      success: true,
      message: 'Business matching request submitted successfully',
      data: zohoResponse,
      matching_id: matchingId,
      submitted_data: {
        event_id: formattedData.event_info.event_id,
        registration_id: formattedData.registration_info.registration_id,
        exhibitor_company: formattedData.exhibitor_company,
        meeting_date: formattedData.date,
        meeting_time: formattedData.time,
        message: formattedData.message
      }
    });

  } catch (error) {
    logger.error("Error in business matching submit:", error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Validate endpoint removed for simplicity - validation is done automatically in submit endpoint

module.exports = router; 