const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createServer } = require('http');
require('dotenv').config();

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Import services
const redisService = require('./services/redisService');
const socketService = require('./services/socketService');

const app = express();

// === Swagger config ===
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nexpo Event Backend API',
      version: '1.0.0',
      description: 'API backend kết nối Zoho Creator cho hệ thống đăng ký sự kiện Nexpo'
    }
  },
  apis: ['./src/routes/*.js'], // Scan tất cả file route
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());

// === Route declarations ===
const eventRoutes = require('./routes/events');               // /api/events/:id
const registrationRoutes = require('./routes/registrations'); // /api/registrations
const importRoutes = require('./routes/imports');              // /api/imports
const visitorRoutes = require('./routes/visitors');           // /api/visitors
const businessMatchingRoutes = require('./routes/businessMatching'); // /api/business-matching
const authRoutes = require('./routes/auth');                  // /api/auth (OAuth 2.0)
const zohoCreatorRoutes = require('./routes/zohoCreator');     // /api/zoho-creator (REST APIs)
const realtimeRoutes = require('./routes/realtime');          // /api/realtime (Socket.IO + Redis)
const eventFilteringRoutes = require('./routes/eventFiltering'); // /api/event-filtering (Client-side filtering)

app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/business-matching', businessMatchingRoutes);
app.use('/api/auth', authRoutes);
app.use('/oauth', authRoutes); // Additional route for OAuth callback
app.use('/api/zoho-creator', zohoCreatorRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/event-filtering', eventFilteringRoutes);

// === Initialize services and start server ===
const PORT = process.env.PORT || 3000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO
socketService.initialize(httpServer);

// Add real-time status endpoint
app.get('/api/status/realtime', (req, res) => {
  res.json({
    success: true,
    status: socketService.getStatus(),
    clients: socketService.getClientsInfo(),
    endpoints: {
      socket_io: '/socket.io',
      redis_status: redisService.isReady()
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await redisService.disconnect();
  process.exit(0);
});

// Start server and initialize Redis
httpServer.listen(PORT, async () => {
  console.log(`🚀 NEXPO Backend running at http://localhost:${PORT}`);
  console.log(`📘 Swagger UI available at /docs`);
  console.log(`🔌 Socket.IO available at /socket.io`);
  
  // Initialize Redis connection
  const redisConnected = await redisService.connect();
  if (redisConnected) {
    console.log('✅ Real-time architecture ready with Redis + Socket.IO');
  } else {
    console.log('⚠️ Running without Redis - cache and pub/sub disabled');
  }
});
