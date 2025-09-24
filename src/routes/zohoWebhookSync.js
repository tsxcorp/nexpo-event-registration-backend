const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const redisService = require('../services/redisService');

/**
 * @swagger
 * /api/webhooks/zoho-sync:
 *   post:
 *     summary: Zoho Creator webhook for real-time sync to Redis
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [record.create, record.update, record.delete]
 *               form:
 *                 type: string
 *                 example: "All_Registrations"
 *               record:
 *                 type: object
 *                 description: The registration record data
 *               record_id:
 *                 type: string
 *                 description: The record ID
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 action:
 *                   type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.post('/zoho-sync', async (req, res) => {
  try {
    // Handle both JSON body and form-data/URL parameters from Deluge
    const event = req.body.event || req.query.event;
    const form = req.body.form || req.query.form;
    const record_id = req.body.record_id || req.query.record_id;
    let record = req.body.record || req.query.record;

    // Parse record if it's a string (from URL parameters or form-data)
    if (typeof record === 'string') {
      try {
        // Unescape JSON string if needed
        let jsonString = record;
        if (record.includes('\\"')) {
          jsonString = record.replace(/\\"/g, '"');
        }
        record = JSON.parse(jsonString);
      } catch (e) {
        logger.info("⚠️ Could not parse record as JSON:", record);
        logger.info("⚠️ Parse error:", e.message);
        // If JSON parsing fails, try to create a basic record object
        record = { ID: record_id };
      }
    }

    logger.info("🪝 Zoho webhook received:", {
      event,
      form,
      record_id,
      record_type: typeof record,
      record: record
    });

    // Only process All_Registrations form
    if (form !== 'All_Registrations') {
      return res.status(200).json({
        success: true,
        message: 'Form not processed (not All_Registrations)',
        action: 'ignored'
      });
    }

    const eventId = record?.Event_Info?.ID || record?.event_id;

    if (!eventId) {
      logger.info("⚠️ No event_id found in record:", record);
      return res.status(400).json({
        success: false,
        message: 'No event_id found in record',
        debug: {
          record_type: typeof record,
          record: record,
          record_id: record_id
        }
      });
    }

    let action = 'unknown';

    switch (event) {
      case 'record.create':
      case 'record.update':
        // Update per-event cache
        await redisService.updateEventRecord(eventId, record, record_id);
        action = event === 'record.create' ? 'created' : 'updated';
        break;

      case 'record.delete':
        // Remove from per-event cache
        await redisService.removeEventRecord(eventId, record_id);
        action = 'deleted';
        break;

      default:
        logger.info("⚠️ Unknown event type:", event);
        return res.status(400).json({
          success: false,
          message: 'Unknown event type'
        });
    }

    // Update cache metadata
    await redisService.updateCacheMetadata();

    logger.info("Webhook processed: ${action} record ${record_id} for event ${eventId}");

    res.status(200).json({
      success: true,
      message: `Record ${action} successfully`,
      action,
      event_id: eventId,
      record_id
    });

  } catch (error) {
    logger.error("Webhook processing error:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
