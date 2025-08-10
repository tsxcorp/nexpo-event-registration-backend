const express = require('express');
const router = express.Router();
const redisBufferService = require('../services/redisBufferService');
const { submitRegistration } = require('../utils/zohoRegistrationSubmit');

/**
 * @swagger
 * /api/buffer/status:
 *   get:
 *     summary: Get buffer status and statistics
 *     tags: [Buffer Management]
 *     responses:
 *       200:
 *         description: Buffer status
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await redisBufferService.getStats();
    const pendingSubmissions = await redisBufferService.getBufferedSubmissions('pending');
    const processingSubmissions = await redisBufferService.getBufferedSubmissions('processing');
    const completedSubmissions = await redisBufferService.getBufferedSubmissions('completed');
    const limitResetTime = await redisBufferService.getLimitResetTime();
    
    res.json({
      success: true,
      stats,
      summary: {
        pending: pendingSubmissions.length,
        processing: processingSubmissions.length,
        completed: completedSubmissions.length,
        total: pendingSubmissions.length + processingSubmissions.length + completedSubmissions.length
      },
      limitResetTime: limitResetTime ? limitResetTime.toISOString() : null,
      nextRetry: limitResetTime ? new Date(limitResetTime.getTime() + 24 * 60 * 60 * 1000).toISOString() : null
    });
  } catch (error) {
    console.error('❌ Error getting buffer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get buffer status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/buffer/submissions:
 *   get:
 *     summary: Get buffered submissions
 *     tags: [Buffer Management]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Buffered submissions
 */
router.get('/submissions', async (req, res) => {
  try {
    const { status } = req.query;
    const submissions = await redisBufferService.getBufferedSubmissions(status);
    
    res.json({
      success: true,
      submissions,
      count: submissions.length
    });
  } catch (error) {
    console.error('❌ Error getting buffered submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get buffered submissions',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/buffer/retry:
 *   post:
 *     summary: Manually trigger retry queue processing
 *     tags: [Buffer Management]
 *     responses:
 *       200:
 *         description: Retry processing result
 */
router.post('/retry', async (req, res) => {
  try {
    console.log('🔄 Manual retry queue processing triggered');
    
    const result = await redisBufferService.processRetryQueue(submitRegistration);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error processing retry queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process retry queue',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/buffer/cleanup:
 *   post:
 *     summary: Clean up completed submissions
 *     tags: [Buffer Management]
 *     responses:
 *       200:
 *         description: Cleanup result
 */
router.post('/cleanup', async (req, res) => {
  try {
    console.log('🧹 Manual cleanup triggered');
    
    const result = await redisBufferService.cleanupCompleted();
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error cleaning up buffer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup buffer',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/buffer/submissions/{bufferId}:
 *   get:
 *     summary: Get specific buffered submission
 *     tags: [Buffer Management]
 *     parameters:
 *       - in: path
 *         name: bufferId
 *         required: true
 *         schema:
 *           type: string
 *         description: Buffer ID
 *     responses:
 *       200:
 *         description: Buffered submission details
 */
router.get('/submissions/:bufferId', async (req, res) => {
  try {
    const { bufferId } = req.params;
    const submissions = await redisBufferService.getBufferedSubmissions();
    const submission = submissions.find(s => s.id === bufferId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found'
      });
    }
    
    res.json({
      success: true,
      submission
    });
  } catch (error) {
    console.error('❌ Error getting submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get submission',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/buffer/submissions/{bufferId}/retry:
 *   post:
 *     summary: Manually retry specific submission
 *     tags: [Buffer Management]
 *     parameters:
 *       - in: path
 *         name: bufferId
 *         required: true
 *         schema:
 *           type: string
 *         description: Buffer ID
 *     responses:
 *       200:
 *         description: Retry result
 */
router.post('/submissions/:bufferId/retry', async (req, res) => {
  try {
    const { bufferId } = req.params;
    const submissions = await redisBufferService.getBufferedSubmissions();
    const submission = submissions.find(s => s.id === bufferId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found'
      });
    }
    
    if (submission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Submission is not in pending status'
      });
    }
    
    console.log(`🔄 Manual retry for submission ${bufferId}`);
    
    // Update status to processing
    await redisBufferService.updateSubmissionStatus(bufferId, 'processing');
    
    // Attempt submission
    const result = await submitRegistration(submission.submissionData);
    
    if (result.success && result.zoho_record_id) {
      // Success - mark as completed
      await redisBufferService.updateSubmissionStatus(bufferId, 'completed', result);
      
      res.json({
        success: true,
        message: 'Submission retry successful',
        result
      });
    } else {
      // Still failed - increment attempts
      await redisBufferService.incrementAttempts(bufferId);
      
      res.json({
        success: false,
        message: 'Submission retry failed',
        error: result.error || 'Unknown error'
      });
    }
    
  } catch (error) {
    console.error('❌ Error retrying submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry submission',
      details: error.message
    });
  }
});

module.exports = router;
