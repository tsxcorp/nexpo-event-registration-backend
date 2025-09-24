const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const zohoCreatorAPI = require('../utils/zohoCreatorAPI');

/**
 * @swagger
 * components:
 *   schemas:
 *     RecordResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Operation success status
 *         data:
 *           type: array
 *           description: Array of records
 *         count:
 *           type: integer
 *           description: Number of records returned
 *         metadata:
 *           type: object
 *           properties:
 *             from:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *             reportName:
 *               type: string
 *     SingleRecordResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           description: Single record data
 *         recordId:
 *           type: string
 *     CreateRecordResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *         recordId:
 *           type: string
 *         formName:
 *           type: string
 *     BulkOperationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         results:
 *           type: object
 *           properties:
 *             success:
 *               type: array
 *             failed:
 *               type: array
 *             total:
 *               type: integer
 *         summary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             successful:
 *               type: integer
 *             failed:
 *               type: integer
 *             successRate:
 *               type: string
 */

/**
 * @swagger
 * /api/zoho-creator/reports/{reportName}/records:
 *   get:
 *     summary: Get records from a Zoho Creator report
 *     description: Retrieve records from specified report with optional filtering and pagination
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Report link name (e.g., "Registrations")
 *         example: "Registrations"
 *       - in: query
 *         name: from
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Starting record number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Maximum number of records to return
 *       - in: query
 *         name: criteria
 *         schema:
 *           type: string
 *         description: Search criteria (Zoho Creator criteria format)
 *         example: "Email == \"user@example.com\""
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field name to sort by
 *         example: "Added_Time"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecordResponse'
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.get('/reports/:reportName/records', async (req, res) => {
  try {
    const { reportName } = req.params;
    const { from, limit, max_records, criteria, sortBy, sortOrder, fetchAll, field_config } = req.query;
    
    // Validate parameters for v2.1
    const options = {};
    if (from) options.from = parseInt(from);
    if (limit) options.limit = parseInt(limit);
    if (max_records) options.max_records = Math.min(parseInt(max_records), 1000); // v2.1 Max 1000 records
    if (criteria) options.criteria = criteria;
    if (sortBy) options.sortBy = sortBy;
    if (sortOrder) options.sortOrder = sortOrder;
    if (fetchAll) options.fetchAll = fetchAll === 'true';
    if (field_config) options.field_config = field_config;
    
    logger.info("Getting records from report: ${reportName} (v2.1 API)");
    const result = await zohoCreatorAPI.getReportRecords(reportName, options);
    
    res.json(result);
    
  } catch (error) {
    logger.error("Error getting report records:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to get report records',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/reports/{reportName}/records/{recordId}:
 *   get:
 *     summary: Get specific record by ID
 *     description: Retrieve a single record from specified report by its ID
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Report link name
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: Record ID
 *     responses:
 *       200:
 *         description: Record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleRecordResponse'
 *       404:
 *         description: Record not found
 *       500:
 *         description: Server error
 */
router.get('/reports/:reportName/records/:recordId', async (req, res) => {
  try {
    const { reportName, recordId } = req.params;
    
    const result = await zohoCreatorAPI.getRecord(reportName, recordId);
    res.json(result);
    
  } catch (error) {
    logger.error("Error getting record:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to get record',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/forms/{formName}/records:
 *   post:
 *     summary: Create new record in form
 *     description: Create a new record in the specified Zoho Creator form
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: formName
 *         required: true
 *         schema:
 *           type: string
 *         description: Form link name
 *         example: "Registration_Form"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Record data to create
 *             example:
 *               Full_Name: "John Doe"
 *               Email: "john@example.com"
 *               Phone_Number: "1234567890"
 *               Event_Info: "4433256000012345678"
 *     responses:
 *       201:
 *         description: Record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateRecordResponse'
 *       400:
 *         description: Invalid record data
 *       500:
 *         description: Server error
 */
router.post('/forms/:formName/records', async (req, res) => {
  try {
    const { formName } = req.params;
    const recordData = req.body;
    
    if (!recordData || Object.keys(recordData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Record data is required',
        message: 'Please provide record data in request body'
      });
    }
    
    const result = await zohoCreatorAPI.createRecord(formName, recordData);
    res.status(201).json(result);
    
  } catch (error) {
    logger.error("Error creating record:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to create record',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/reports/{reportName}/records/{recordId}:
 *   patch:
 *     summary: Update existing record
 *     description: Update an existing record in the specified report
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Report link name
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: Record ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update
 *             example:
 *               Full_Name: "John Smith"
 *               Phone_Number: "0987654321"
 *     responses:
 *       200:
 *         description: Record updated successfully
 *       400:
 *         description: Invalid update data
 *       404:
 *         description: Record not found
 *       500:
 *         description: Server error
 */
router.patch('/reports/:reportName/records/:recordId', async (req, res) => {
  try {
    const { reportName, recordId } = req.params;
    const updateData = req.body;
    
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Update data is required',
        message: 'Please provide fields to update in request body'
      });
    }
    
    const result = await zohoCreatorAPI.updateRecord(reportName, recordId, updateData);
    res.json(result);
    
  } catch (error) {
    logger.error("Error updating record:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to update record',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/reports/{reportName}/records/{recordId}:
 *   delete:
 *     summary: Delete record
 *     description: Delete a record from the specified report
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Report link name
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: Record ID to delete
 *     responses:
 *       200:
 *         description: Record deleted successfully
 *       404:
 *         description: Record not found
 *       500:
 *         description: Server error
 */
router.delete('/reports/:reportName/records/:recordId', async (req, res) => {
  try {
    const { reportName, recordId } = req.params;
    
    const result = await zohoCreatorAPI.deleteRecord(reportName, recordId);
    res.json(result);
    
  } catch (error) {
    logger.error("Error deleting record:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete record',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/reports/{reportName}/search:
 *   post:
 *     summary: Search records with criteria
 *     description: Search records in specified report using Zoho Creator criteria
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Report link name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               criteria:
 *                 type: string
 *                 description: Search criteria in Zoho Creator format
 *                 example: "Email.contains(\"@company.com\") && Added_Time > \"2023-01-01\""
 *               from:
 *                 type: integer
 *                 default: 1
 *               limit:
 *                 type: integer
 *                 default: 50
 *               sortBy:
 *                 type: string
 *               sortOrder:
 *                 type: string
 *                 enum: [asc, desc]
 *             required:
 *               - criteria
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecordResponse'
 *       400:
 *         description: Invalid search criteria
 *       500:
 *         description: Server error
 */
router.post('/reports/:reportName/search', async (req, res) => {
  try {
    const { reportName } = req.params;
    const { criteria, from, limit, sortBy, sortOrder } = req.body;
    
    if (!criteria) {
      return res.status(400).json({
        success: false,
        error: 'Search criteria is required',
        message: 'Please provide search criteria in request body'
      });
    }
    
    const options = { from, limit, sortBy, sortOrder };
    const result = await zohoCreatorAPI.searchRecords(reportName, criteria, options);
    
    res.json(result);
    
  } catch (error) {
    logger.error("Error searching records:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to search records',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/forms/{formName}/metadata:
 *   get:
 *     summary: Get form metadata
 *     description: Retrieve metadata information for the specified form
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: formName
 *         required: true
 *         schema:
 *           type: string
 *         description: Form link name
 *     responses:
 *       200:
 *         description: Form metadata retrieved successfully
 *       404:
 *         description: Form not found
 *       500:
 *         description: Server error
 */
router.get('/forms/:formName/metadata', async (req, res) => {
  try {
    const { formName } = req.params;
    
    const result = await zohoCreatorAPI.getFormMetadata(formName);
    res.json(result);
    
  } catch (error) {
    logger.error("Error getting form metadata:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to get form metadata',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/zoho-creator/bulk/{operation}:
 *   post:
 *     summary: Perform bulk operations
 *     description: Perform bulk create, update, or delete operations
 *     tags: [Zoho Creator API]
 *     parameters:
 *       - in: path
 *         name: operation
 *         required: true
 *         schema:
 *           type: string
 *           enum: [create, update, delete]
 *         description: Type of bulk operation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetName:
 *                 type: string
 *                 description: Form or report link name
 *               records:
 *                 type: array
 *                 description: Array of records to process
 *                 items:
 *                   type: object
 *             required:
 *               - targetName
 *               - records
 *             example:
 *               targetName: "Registration_Form"
 *               records:
 *                 - Full_Name: "User 1"
 *                   Email: "user1@example.com"
 *                 - Full_Name: "User 2"
 *                   Email: "user2@example.com"
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkOperationResponse'
 *       400:
 *         description: Invalid operation or data
 *       500:
 *         description: Server error
 */
router.post('/bulk/:operation', async (req, res) => {
  try {
    const { operation } = req.params;
    const { targetName, records } = req.body;
    
    if (!['create', 'update', 'delete'].includes(operation)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation',
        message: 'Operation must be one of: create, update, delete'
      });
    }
    
    if (!targetName || !records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        message: 'Please provide targetName and records array'
      });
    }
    
    const result = await zohoCreatorAPI.bulkOperation(operation, targetName, records);
    res.json(result);
    
  } catch (error) {
    logger.error("Error performing bulk operation:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk operation',
      details: error.message
    });
  }
});

// Special endpoint for Registrations report (your sample request)
/**
 * @swagger
 * /api/zoho-creator/registrations:
 *   get:
 *     summary: Get registrations (Sample endpoint)
 *     description: Get records from the Registrations report - sample implementation for realtime widgets
 *     tags: [Zoho Creator API, Sample Endpoints]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Starting record number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum records to return
 *       - in: query
 *         name: event_id
 *         schema:
 *           type: string
 *         description: Filter by specific event ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by registration status
 *     responses:
 *       200:
 *         description: Registrations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RecordResponse'
 *                 - type: object
 *                   properties:
 *                     realtime:
 *                       type: object
 *                       properties:
 *                         timestamp:
 *                           type: string
 *                         cached:
 *                           type: boolean
 *                         socketRoom:
 *                           type: string
 */
router.get('/registrations', async (req, res) => {
  try {
    const { from, limit, event_id, status } = req.query;
    
    // Build search criteria if filters provided
    let criteria = null;
    const filters = [];
    
    if (event_id) {
      filters.push(`Event_Info == "${event_id}"`);
    }
    
    if (status) {
      filters.push(`Status == "${status}"`);
    }
    
    if (filters.length > 0) {
      criteria = filters.join(' && ');
    }
    
    const options = {
      from: from ? parseInt(from) : 1,
      limit: limit ? Math.min(parseInt(limit), 200) : 50,
      criteria
      // Note: Sorting might not be supported by Zoho Creator API
      // sortBy: 'Added_Time',
      // sortOrder: 'desc'
    };
    
    logger.info("Getting registrations with filters:", { event_id, status, criteria });
    
    const result = await zohoCreatorAPI.getReportRecords('Registrations', options);
    
    // Add realtime metadata for widget integration
    const enhancedResult = {
      ...result,
      realtime: {
        timestamp: new Date().toISOString(),
        cached: false, // TODO: Implement Redis caching
        socketRoom: `registrations_${event_id || 'all'}`,
        filters: { event_id, status }
      }
    };
    
    res.json(enhancedResult);
    
  } catch (error) {
    logger.error("Error getting registrations:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to get registrations',
      details: error.message
    });
  }
});

module.exports = router;
