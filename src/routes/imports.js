const express = require('express');
const logger = require('../utils/logger');
const multer = require('multer');
const { parseExcel } = require('../utils/parseExcel');
const { submitRegistration } = require('../utils/zohoRegistrationSubmit');

const router = express.Router();
const upload = multer();

// 📊 Import Session Tracking (In-memory storage)
const importSessions = new Map();

// 🧹 Cleanup old sessions every 30 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let cleanedCount = 0;
  
  for (const [sessionId, session] of importSessions.entries()) {
    if (session.startTime < oneHourAgo) {
      importSessions.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info("🧹 Cleaned up ${cleanedCount} old import sessions");
  }
}, 30 * 60 * 1000); // Check every 30 minutes

// Helper function to create/update import session
const updateImportSession = (sessionId, eventId, data) => {
  if (!importSessions.has(sessionId)) {
    importSessions.set(sessionId, {
      eventId,
      startTime: Date.now(),
      totalRecords: 0,
      processedRecords: [],
      currentRecord: 0,
      status: 'processing',
      lastUpdate: Date.now()
    });
  }
  
  const session = importSessions.get(sessionId);
  Object.assign(session, data, { lastUpdate: Date.now() });
  
  logger.info("Session ${sessionId} updated:", {
    processed: session.processedRecords.length,
    total: session.totalRecords,
    currentRecord: session.currentRecord,
    status: session.status
  });
};

// 📊 Helper function to show payload comparison
const showPayloadComparison = (importPayload, rowIndex) => {
  logger.info("\n🔍 PAYLOAD COMPARISON for row ${rowIndex}:");
  
  // Simulate what registration route would create (now both use same format!)
  const registrationEquivalent = {
    title: importPayload.title,
    full_name: importPayload.full_name,
    email: importPayload.email,
    mobile_number: importPayload.mobile_number,
    custom_fields_value: importPayload.custom_fields_value,
    event_info: importPayload.event_info
  };
  
  logger.info("📱 Registration route format:", JSON.stringify(registrationEquivalent, null, 2));
  logger.info("📄 Import route format:", JSON.stringify(importPayload, null, 2));
  
  // Show what zohoRegistrationSubmit.js would process each into (REST API format)
  logger.info("\n💡 After zohoRegistrationSubmit.js processing (REST API):");
  logger.info("📱 Registration → Zoho REST API:", {
    Full_Name: registrationEquivalent.full_name,
    Email: registrationEquivalent.email,
    Phone_Number: registrationEquivalent.mobile_number,
    Event_Info: registrationEquivalent.event_info,
    Custom_Fields_Value: registrationEquivalent.custom_fields_value,
    Group_Members: "[]"
  });
  
  logger.info("📄 Import → Zoho REST API:", {
    Full_Name: importPayload.full_name,
    Email: importPayload.email,
    Phone_Number: importPayload.mobile_number,
    Event_Info: importPayload.event_info,
    Custom_Fields_Value: importPayload.custom_fields_value,
    Group_Members: JSON.stringify(importPayload.group_members)
  });
  logger.info("=".repeat(50));
};

/**
 * @swagger
 * /api/imports:
 *   post:
 *     summary: Import danh sách đăng ký từ Excel
 *     parameters:
 *       - in: formData
 *         name: event_id
 *         required: true
 *         type: string
 *         description: ID của sự kiện
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import thành công
 *       500:
 *         description: Import thất bại
 */

const MAX_REQUESTS_PER_SECOND = 1; // Reduced rate to avoid Zoho limits
const RETRY_LIMIT = 3; // Increased retry attempts
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

router.post('/', upload.single('file'), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded", details: "File is required for import" });
    }
    
    if (!req.file.buffer) {
      return res.status(400).json({ error: "Invalid file", details: "File buffer is missing" });
    }
    
    // Validate event_id
    const eventId = req.body.event_id;
    if (!eventId) {
      return res.status(400).json({ error: "Missing event_id", details: "event_id is required" });
    }
    
    // Get session ID from header for tracking
    const sessionId = req.headers['x-session-id'];
    logger.info("Import request with session ID: ${sessionId}");
    
    logger.info(`📄 Processing import for event: ${eventId}, file size: ${req.file.buffer.length} bytes`);
    logger.info('🔧 Using Zoho Public REST API for imports');
    
    const records = parseExcel(req.file.buffer);
    logger.info(`📋 Parsed ${records.length} records from Excel`);

    // Initialize session tracking if sessionId provided
    if (sessionId) {
      updateImportSession(sessionId, eventId, {
        totalRecords: records.length,
        processedRecords: [],
        currentRecord: 0,
        status: 'processing'
      });
    }

    const results = [];

    for (const [i, row] of records.entries()) {
      // ✅ Format payload for REST API submission
      const payload = {
        title: row.title || row.salutation || row.Title || row.Salutation || "",
        full_name: row.full_name || row.Full_Name || row.name || row.Name || "",
        email: row.email || row.Email || "",
        mobile_number: row.mobile_number || row.phone_number || row.Mobile_Number || row.Phone_Number || "",
        event_info: eventId,
        custom_fields_value: Object.fromEntries(
          Object.entries(row).filter(([key, value]) => {
            const lowerKey = key.toLowerCase();
            return !['title', 'salutation', 'full_name', 'name', 'email', 'mobile_number', 'phone_number'].includes(lowerKey) && value !== undefined && value !== null;
          })
        ),
        group_members: [], // Empty for imports
        fieldDefinitions: [] // Import doesn't have field definitions
      };

      logger.info("Import payload for row ${i + 1}:", JSON.stringify(payload, null, 2));
      
      // Show comparison with registration format
      showPayloadComparison(payload, i + 1);

      let success = false;
      let attempt = 0;
      let lastError = '';

      while (attempt <= RETRY_LIMIT) {
        try {
          logger.info("Attempt ${attempt + 1} for row ${i + 1}...");
          
          // Update session tracking
          if (sessionId) {
            updateImportSession(sessionId, eventId, {
              currentRecord: i
            });
          }
          
          const result = await submitRegistration(payload);
          logger.info("Row ${i + 1} success:", result);
          
          // Update session with success
          if (sessionId) {
            const session = importSessions.get(sessionId);
            session.processedRecords.push({
              rowIndex: i,
              success: true,
              email: payload.email,
              zoho_id: result.zoho_record_id
            });
          }
          
          results.push({ row: i + 1, status: '✅ Success', email: payload.email, zoho_id: result.zoho_record_id });
          success = true;
          break;
        } catch (err) {
          lastError = err?.message || 'Unknown error';
          logger.error("Row ${i + 1} attempt ${attempt + 1} failed:", lastError);
          
          // Update session with error
          if (sessionId) {
            const session = importSessions.get(sessionId);
            session.processedRecords.push({
              rowIndex: i,
              success: false,
              error: lastError,
              email: payload.email
            });
          }
          
          attempt++;
          if (attempt <= RETRY_LIMIT) {
            logger.info("⏳ Waiting ${DELAY_BETWEEN_REQUESTS}ms before retry...");
            await sleep(DELAY_BETWEEN_REQUESTS);
          }
        }
      }

      if (!success) {
        results.push({ row: i + 1, status: '❌ Failed', email: payload.email, error: lastError });
      }
      
      // Add delay between records to avoid overwhelming Zoho
      if (i < records.length - 1) { // Don't delay after the last record
        logger.info("⏳ Waiting ${DELAY_BETWEEN_REQUESTS}ms before next record...");
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }

    // Mark session as completed
    if (sessionId) {
      updateImportSession(sessionId, eventId, {
        status: 'completed'
      });
      logger.info("Import session ${sessionId} completed");
    }

    res.json({ success: true, total: records.length, report: results });
  } catch (error) {
    logger.error("Import error:", error);
    res.status(500).json({ error: "Failed to import file", details: error.message });
  }
});



/**
 * @swagger
 * /api/imports/import-status/{eventId}:
 *   get:
 *     summary: Get real-time import status
 *     description: Track progress of ongoing import process
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của sự kiện
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID để track specific import batch
 *     responses:
 *       200:
 *         description: Import status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: object
 *                   properties:
 *                     processed:
 *                       type: integer
 *                       description: Số records đã xử lý
 *                       example: 45
 *                     total:
 *                       type: integer
 *                       description: Tổng số records
 *                       example: 100
 *                     currentBatch:
 *                       type: integer
 *                       description: Batch hiện tại
 *                       example: 2
 *                     totalBatches:
 *                       type: integer
 *                       description: Tổng số batches
 *                       example: 3
 *                 processedRecords:
 *                   type: array
 *                   description: Chi tiết từng record đã xử lý
 *                   items:
 *                     type: object
 *                     properties:
 *                       rowIndex:
 *                         type: integer
 *                         description: Index của row trong file
 *                         example: 0
 *                       success:
 *                         type: boolean
 *                         description: Import thành công hay không
 *                         example: true
 *                       email:
 *                         type: string
 *                         description: Email của record
 *                         example: "user@example.com"
 *                       error:
 *                         type: string
 *                         description: Lỗi nếu có
 *                         example: "Email already exists"
 *                 currentRecord:
 *                   type: integer
 *                   description: Record đang xử lý hiện tại
 *                   example: 46
 *                 completed:
 *                   type: boolean
 *                   description: Import đã hoàn thành chưa
 *                   example: false
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Session not found"
 *       403:
 *         description: Session does not belong to this event
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Session does not belong to this event"
 */

// 📊 Import Status Endpoint
router.get('/import-status/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { sessionId } = req.query;
    
    logger.info("Status request for event ${eventId}, session ${sessionId}");
    
    if (!sessionId) {
      return res.status(400).json({ 
        error: 'Missing sessionId parameter',
        message: 'sessionId is required to track import progress'
      });
    }
    
    if (!importSessions.has(sessionId)) {
      return res.status(404).json({ 
        error: 'Session not found',
        message: `Import session ${sessionId} not found or expired`,
        availableSessions: Array.from(importSessions.keys())
      });
    }
    
    const session = importSessions.get(sessionId);
    
    // Check if session belongs to this event
    if (session.eventId !== eventId) {
      return res.status(403).json({ 
        error: 'Session does not belong to this event',
        message: `Session ${sessionId} belongs to event ${session.eventId}, not ${eventId}`
      });
    }
    
    // Calculate batch information
    const batchSize = 50; // Match frontend BATCH_SIZE
    const currentBatch = Math.floor(session.currentRecord / batchSize) + 1;
    const totalBatches = Math.ceil(session.totalRecords / batchSize);
    
    const response = {
      status: {
        processed: session.processedRecords.length,
        total: session.totalRecords,
        currentBatch: currentBatch,
        totalBatches: totalBatches
      },
      processedRecords: session.processedRecords,
      currentRecord: session.currentRecord,
      completed: session.status === 'completed',
      sessionInfo: {
        sessionId: sessionId,
        startTime: new Date(session.startTime).toISOString(),
        lastUpdate: new Date(session.lastUpdate).toISOString(),
        duration: Math.floor((Date.now() - session.startTime) / 1000) // seconds
      }
    };
    
    logger.info("Status response for session ${sessionId}:", {
      processed: response.status.processed,
      total: response.status.total,
      completed: response.completed
    });
    
    res.json(response);
    
  } catch (error) {
    logger.error("Error in import status endpoint:", error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;
