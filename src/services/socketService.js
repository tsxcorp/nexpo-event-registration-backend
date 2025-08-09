const { Server } = require('socket.io');
const redisService = require('./redisService');

/**
 * WebSocket Service for real-time data push to Zoho Widgets
 * Integrates with Redis pub/sub for scalability
 */
class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.rooms = new Set();
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'https://creator.zoho.com'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.setupRedisSubscriptions();
    
    console.log('✅ Socket.IO server initialized');
    return this.io;
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      // Store client info
      this.connectedClients.set(socket.id, {
        id: socket.id,
        connected_at: new Date().toISOString(),
        rooms: new Set()
      });

      // Handle room joining for event-specific updates
      socket.on('join_event', (eventId) => {
        if (eventId) {
          const room = `event_${eventId}`;
          socket.join(room);
          this.rooms.add(room);
          this.connectedClients.get(socket.id)?.rooms.add(room);
          
          console.log(`📍 Client ${socket.id} joined event room: ${room}`);
          socket.emit('joined_event', { event_id: eventId, room });
        }
      });

      // Handle report subscription
      socket.on('subscribe_report', (reportName) => {
        if (reportName) {
          const room = `report_${reportName}`;
          socket.join(room);
          this.rooms.add(room);
          this.connectedClients.get(socket.id)?.rooms.add(room);
          
          console.log(`📊 Client ${socket.id} subscribed to report: ${room}`);
          socket.emit('subscribed_report', { report: reportName, room });
        }
      });

      // Handle custom room joining
      socket.on('join_room', (roomName) => {
        if (roomName) {
          socket.join(roomName);
          this.rooms.add(roomName);
          this.connectedClients.get(socket.id)?.rooms.add(roomName);
          
          console.log(`🏠 Client ${socket.id} joined custom room: ${roomName}`);
          socket.emit('joined_room', { room: roomName });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
        this.connectedClients.delete(socket.id);
      });

      // Send welcome message with connection info
      socket.emit('connected', {
        client_id: socket.id,
        server_time: new Date().toISOString(),
        available_events: ['join_event', 'subscribe_report', 'join_room'],
        message: 'Connected to Zoho Real-time API'
      });
    });
  }

  /**
   * Setup Redis subscriptions for cross-instance communication
   */
  async setupRedisSubscriptions() {
    if (!redisService.isReady()) {
      console.log('⚠️ Redis not ready, skipping Redis subscriptions');
      return;
    }

    // Subscribe to all Zoho updates
    await redisService.subscribe('zoho:*', (data, timestamp) => {
      this.handleZohoUpdate(data, timestamp);
    });

    // Subscribe to registration updates specifically
    await redisService.subscribe('zoho:Registrations:*', (data, timestamp) => {
      this.handleRegistrationUpdate(data, timestamp);
    });

    console.log('✅ Redis subscriptions setup for Socket.IO');
  }

  /**
   * Handle Zoho data updates from Redis
   */
  handleZohoUpdate(data, timestamp) {
    const { type, report, event_id, data: updateData } = data;
    
    // Broadcast to report subscribers
    if (report) {
      this.broadcastToRoom(`report_${report}`, 'zoho_update', {
        type,
        report,
        event_id,
        data: updateData,
        timestamp
      });
    }

    // Broadcast to event subscribers
    if (event_id) {
      this.broadcastToRoom(`event_${event_id}`, 'event_update', {
        type,
        report,
        event_id,
        data: updateData,
        timestamp
      });
    }
  }

  /**
   * Handle specific registration updates
   */
  handleRegistrationUpdate(data, timestamp) {
    const { type, event_id, data: updateData } = data;
    
    // Send to all registration subscribers
    this.broadcastToRoom('report_Registrations', 'registration_update', {
      type,
      event_id,
      data: updateData,
      timestamp,
      count: Array.isArray(updateData) ? updateData.length : 1
    });

    // If it's a check-in update, send special notification
    if (updateData && updateData.Check_In_Status === 'Checked In') {
      this.broadcastToAll('checkin_notification', {
        registration: updateData,
        event_id,
        timestamp,
        message: `${updateData.Full_Name} has checked in!`
      });
    }
  }

  // ==================== BROADCAST METHODS ====================

  /**
   * Broadcast to specific room
   */
  broadcastToRoom(room, event, data) {
    if (!this.io) return false;
    
    const clientsInRoom = this.io.sockets.adapter.rooms.get(room);
    const clientCount = clientsInRoom ? clientsInRoom.size : 0;
    
    if (clientCount > 0) {
      this.io.to(room).emit(event, {
        ...data,
        room,
        server_timestamp: new Date().toISOString()
      });
      
      console.log(`📡 Broadcast to room ${room}: ${clientCount} clients`);
      return true;
    }
    
    return false;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(event, data) {
    if (!this.io) return false;
    
    const clientCount = this.connectedClients.size;
    
    this.io.emit(event, {
      ...data,
      server_timestamp: new Date().toISOString()
    });
    
    console.log(`📡 Broadcast to ALL: ${clientCount} clients`);
    return clientCount > 0;
  }

  /**
   * Send to specific client
   */
  sendToClient(clientId, event, data) {
    if (!this.io) return false;
    
    this.io.to(clientId).emit(event, {
      ...data,
      server_timestamp: new Date().toISOString()
    });
    
    console.log(`📤 Sent to client ${clientId}`);
    return true;
  }

  // ==================== ZOHO WIDGET HELPERS ====================

  /**
   * Push registration data to widgets
   */
  async pushRegistrationData(eventId, registrations, updateType = 'data_refresh') {
    const payload = {
      type: updateType,
      event_id: eventId,
      registrations,
      count: registrations.length,
      last_updated: new Date().toISOString()
    };

    // Cache the data first
    if (redisService.isReady()) {
      await redisService.cacheZohoData('Registrations', { event_id: eventId }, payload, 300);
      
      // Publish to Redis for other instances
      await redisService.publishZohoUpdate('Registrations', eventId, updateType, payload);
    }

    // Send to event-specific room
    if (eventId) {
      this.broadcastToRoom(`event_${eventId}`, 'registration_data', payload);
    }

    // Send to general registration subscribers
    this.broadcastToRoom('report_Registrations', 'registration_data', payload);

    return payload;
  }

  /**
   * Push check-in status updates
   */
  async pushCheckInUpdate(eventId, registrationId, newStatus, registrationData) {
    const payload = {
      type: 'checkin_update',
      event_id: eventId,
      registration_id: registrationId,
      new_status: newStatus,
      registration: registrationData,
      timestamp: new Date().toISOString()
    };

    // Publish to Redis
    if (redisService.isReady()) {
      await redisService.publishZohoUpdate('Registrations', eventId, 'checkin_update', payload);
    }

    // Real-time push
    if (eventId) {
      this.broadcastToRoom(`event_${eventId}`, 'checkin_update', payload);
    }
    
    this.broadcastToRoom('report_Registrations', 'checkin_update', payload);

    return payload;
  }

  // ==================== STATUS & MONITORING ====================

  /**
   * Get service status
   */
  getStatus() {
    return {
      connected_clients: this.connectedClients.size,
      active_rooms: this.rooms.size,
      redis_connected: redisService.isReady(),
      uptime: process.uptime(),
      memory_usage: process.memoryUsage()
    };
  }

  /**
   * Get connected clients info
   */
  getClientsInfo() {
    return Array.from(this.connectedClients.entries()).map(([id, info]) => ({
      id,
      connected_at: info.connected_at,
      rooms: Array.from(info.rooms)
    }));
  }
}

// Export singleton instance
const socketService = new SocketService();
module.exports = socketService;
