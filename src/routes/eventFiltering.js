const express = require('express');
const router = express.Router();
const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
const socketService = require('../services/socketService');
const fetch = require('node-fetch');

/**
 * @swagger
 * /api/event-filtering/registrations/{eventId}:
 *   get:
 *     summary: Get registrations for specific event (client-side filtered)
 *     tags: [Event Filtering]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID to filter
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, checked_in, not_yet]
 *         description: Check-in status filter
 *       - in: query
 *         name: group_only
 *         schema:
 *           type: boolean
 *         description: Only group registrations
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *         description: Max records to return
 *     responses:
 *       200:
 *         description: Filtered registrations
 */
router.get('/registrations/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status = 'all', group_only = false, limit = 200 } = req.query;
    
    console.log(`🎯 Event filtering request: Event=${eventId}, Status=${status}, GroupOnly=${group_only}`);

    // Get ALL registrations using direct Zoho Creator API with full pagination 
    const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
    console.log(`🔄 Fetching ALL registrations with full pagination...`);
    const allRegistrations = await zohoCreatorAPI.getReportRecords('All_Registrations', {
      max_records: 1000,
      fetchAll: true,
      useCache: false // Disable cache to get fresh data
    });

    // Client-side filtering by Event_Info.ID
    let filteredByEvent = allRegistrations.data.filter(record => {
      if (!record.Event_Info || !record.Event_Info.ID) {
        return false;
      }
      return record.Event_Info.ID === eventId;
    });

    console.log(`📊 Found ${filteredByEvent.length} registrations for event ${eventId}`);

    // Apply status filter
    if (status !== 'all') {
      filteredByEvent = filteredByEvent.filter(record => {
        const isCheckedIn = record.Check_In_Status === 'Checked In';
        if (status === 'checked_in') return isCheckedIn;
        if (status === 'not_yet') return !isCheckedIn;
        return true;
      });
    }

    // Apply group registration filter
    if (group_only === 'true' || group_only === true) {
      filteredByEvent = filteredByEvent.filter(record => {
        return record.Group_Registration === 'true';
      });
    }

    // Apply limit
    const limitedResults = filteredByEvent.slice(0, parseInt(limit));

    // Push real-time update for this specific event
    if (socketService.io) {
      await socketService.pushRegistrationData(eventId, limitedResults, 'event_filter');
    }

    // Statistics
    const stats = {
      total_for_event: filteredByEvent.length,
      checked_in: filteredByEvent.filter(r => r.Check_In_Status === 'Checked In').length,
      not_yet: filteredByEvent.filter(r => r.Check_In_Status === 'Not Yet').length,
      group_registrations: filteredByEvent.filter(r => r.Group_Registration === 'true').length,
      returned: limitedResults.length
    };

    res.json({
      success: true,
      event_id: eventId,
      data: limitedResults,
      count: limitedResults.length,
      stats,
      filters: {
        status,
        group_only,
        limit: parseInt(limit)
      },
      metadata: {
        method: 'client_side_filter',
        source_total: allRegistrations.count,
        cached: allRegistrations.metadata.cached,
        filtered_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Event filtering error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to filter registrations by event',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/event-filtering/events/list:
 *   get:
 *     summary: Get list of all events with registration counts
 *     tags: [Event Filtering]
 *     responses:
 *       200:
 *         description: List of events with stats
 */
router.get('/events/list', async (req, res) => {
  try {
    console.log('📋 Getting all events with registration counts...');

    // Get ALL registrations using direct Zoho Creator API with full pagination
    const zohoCreatorAPI = require('../utils/zohoCreatorAPI');
    console.log(`🔄 Fetching ALL registrations for events list...`);
    const allRegistrations = await zohoCreatorAPI.getReportRecords('All_Registrations', {
      max_records: 1000,
      fetchAll: true,
      useCache: false // Disable cache to get fresh data
    });

    // Group by event
    const eventMap = new Map();

    allRegistrations.data.forEach(record => {
      if (record.Event_Info && record.Event_Info.ID) {
        const eventId = record.Event_Info.ID;
        const eventName = record.Event_Info.display_value || `Event ${eventId}`;
        
        if (!eventMap.has(eventId)) {
          eventMap.set(eventId, {
            event_id: eventId,
            event_name: eventName,
            total_registrations: 0,
            checked_in: 0,
            not_yet: 0,
            group_registrations: 0,
            individual_registrations: 0
          });
        }

        const eventStats = eventMap.get(eventId);
        eventStats.total_registrations++;
        
        if (record.Check_In_Status === 'Checked In') {
          eventStats.checked_in++;
        } else {
          eventStats.not_yet++;
        }

        if (record.Group_Registration === 'true') {
          eventStats.group_registrations++;
        } else {
          eventStats.individual_registrations++;
        }
      }
    });

    // Convert to array and sort by total registrations
    const events = Array.from(eventMap.values())
      .sort((a, b) => b.total_registrations - a.total_registrations);

    // Add records without event info
    const noEventRecords = allRegistrations.data.filter(record => 
      !record.Event_Info || !record.Event_Info.ID
    );

    const summary = {
      total_events: events.length,
      total_registrations: allRegistrations.count,
      registrations_with_event: allRegistrations.count - noEventRecords.length,
      registrations_without_event: noEventRecords.length,
      cached: allRegistrations.metadata.cached
    };

    res.json({
      success: true,
      events,
      summary,
      metadata: {
        generated_at: new Date().toISOString(),
        source: 'client_side_analysis'
      }
    });

  } catch (error) {
    console.error('❌ Event list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get event list',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/event-filtering/realtime/subscribe/{eventId}:
 *   post:
 *     summary: Subscribe to real-time updates for specific event
 *     tags: [Event Filtering]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID to subscribe to
 *     responses:
 *       200:
 *         description: Subscription successful
 */
router.post('/realtime/subscribe/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Get current data for this event
    const currentData = await this.getEventRegistrations(eventId);
    
    // Push initial data
    if (socketService.io) {
      await socketService.pushRegistrationData(eventId, currentData, 'subscription_init');
    }

    res.json({
      success: true,
      message: `Subscribed to real-time updates for event ${eventId}`,
      event_id: eventId,
      initial_count: currentData.length,
      socket_room: `event_${eventId}`,
      instructions: [
        "Connect to Socket.IO at /socket.io",
        `Emit: socket.emit('join_event', '${eventId}')`,
        "Listen for: 'registration_data', 'checkin_update', 'event_update'"
      ]
    });

  } catch (error) {
    console.error('❌ Real-time subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to real-time updates',
      details: error.message
    });
  }
});

// Helper method for getting event registrations
router.getEventRegistrations = async function(eventId) {
  const allRegistrations = await zohoCreatorAPI.getReportRecords('Registrations', {
    from: 1,
    limit: 500,
    useCache: true
  });

  return allRegistrations.data.filter(record => {
    return record.Event_Info && record.Event_Info.ID === eventId;
  });
};

module.exports = router;
