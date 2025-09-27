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
const zohoOAuthService = require('./utils/zohoOAuthService');
// bufferScheduler removed - functionality integrated into redisService

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
// Enhanced CORS configuration for widget compatibility
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow Zoho Creator domains and widget hosting domains
    const allowedOrigins = [
      'https://creator.zoho.com',
      'https://creator.zoho.eu',
      'https://creator.zoho.in',
      'https://creator.zoho.com.au',
      'https://creatorapp.zoho.com',
      'https://creatorapp.zoho.eu',
      'https://creatorapp.zoho.in',
      'https://creatorapp.zoho.com.au',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://nexpo-event-registration-backend-production.up.railway.app',
      'https://registration.nexpo.vn'
    ];
    
    // Check if origin is allowed or is a Zoho subdomain
    const isAllowed = allowedOrigins.includes(origin) || 
                     origin.includes('.zoho.com') || 
                     origin.includes('.zohostatic.com') ||
                     origin.includes('.zohousercontent.com') ||
                     origin.includes('.zappsusercontent.com') ||
                     origin.includes('.sigmausercontent.com') ||
                     origin.includes('.qntrlusercontent.com');
    
    if (isAllowed) {
      callback(null, origin); // Return specific origin, not wildcard
    } else {
      console.log(`⚠️ CORS blocked origin: ${origin}`);
      // For development, still return specific origin instead of wildcard
      callback(null, origin.includes('localhost') || origin.includes('127.0.0.1') ? origin : false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires', 'If-Modified-Since', 'If-None-Match'],
  maxAge: 86400 // 24 hours
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// === Route declarations ===
const eventRoutes = require('./routes/events');               // /api/events/:id (Custom API)
const eventRESTRoutes = require('./routes/eventsREST');       // /api/events-rest (REST API)
const eventProxyRoutes = require('./routes/eventsProxy');     // /api/events-proxy (REST API with Proxy Images)
const registrationRoutes = require('./routes/registrations'); // /api/registrations
const importRoutes = require('./routes/imports');              // /api/imports
const visitorRoutes = require('./routes/visitors');           // /api/visitors
const businessMatchingRoutes = require('./routes/businessMatching'); // /api/business-matching
const authRoutes = require('./routes/auth');                  // /api/auth (OAuth 2.0)
const zohoCreatorRoutes = require('./routes/zohoCreator');     // /api/zoho-creator (REST APIs)
const realtimeRoutes = require('./routes/realtime');          // /api/realtime (Socket.IO + Redis)
const eventFilteringRoutes = require('./routes/eventFiltering'); // /api/event-filtering (Client-side filtering)
const bufferRoutes = require('./routes/buffer'); // /api/buffer (Redis Buffer Management)
const cacheRoutes = require('./routes/cache'); // /api/cache (Redis Cache Management)
const webhookRoutes = require('./routes/webhooks'); // /webhooks (Zoho Webhooks)
const zohoWebhookSyncRoutes = require('./routes/zohoWebhookSync'); // /api/webhooks (Real-time Sync)
const zohoCrudRoutes = require('./routes/zohoCrud'); // /api/zoho-crud (CRUD Operations)
const syncRoutes = require('./routes/sync'); // /api/sync (Sync Management)
const syncWorkerRoutes = require('./routes/syncWorker'); // /api/sync-worker (Sync Worker Management)
const proxyImageRoutes = require('./routes/proxyImage'); // /api/proxy-image (Image Proxy)

app.use('/api/events', eventRoutes);
app.use('/api/events-rest', eventRESTRoutes);
app.use('/api/events-proxy', eventProxyRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/business-matching', businessMatchingRoutes);
app.use('/api/auth', authRoutes);
app.use('/oauth', authRoutes); // Additional route for OAuth callback
app.use('/api/zoho-creator', zohoCreatorRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/event-filtering', eventFilteringRoutes);
app.use('/api/buffer', bufferRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/webhooks', zohoWebhookSyncRoutes);
app.use('/api/zoho-crud', zohoCrudRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/sync-worker', syncWorkerRoutes);
app.use('/api', proxyImageRoutes); // Proxy image routes

// Serve static files for widget testing
app.use(express.static('./', { 
  setHeaders: (res, path) => {
    // Allow serving JS files with proper MIME type
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Add CORS headers for widget files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}));

// === Initialize services and start server ===
const PORT = process.env.PORT || 3000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO
socketService.initialize(httpServer);

// Add health check and status endpoints
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      api: 'healthy',
      websocket: socketService.io ? 'healthy' : 'unavailable',
      redis: redisService.isReady() ? 'connected' : 'disconnected'
    },
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
      has_redis_config: !!(process.env.REDIS_URL || process.env.REDIS_HOST)
    }
  };
  
  res.json(health);
});

app.get('/api/status/realtime', (req, res) => {
  res.json({
    success: true,
    status: socketService.getStatus(),
    clients: socketService.getClientsInfo(),
    endpoints: {
      socket_io: '/socket.io',
      redis_status: redisService.isReady()
    },
    redis: {
      connected: redisService.isReady(),
      config_method: process.env.REDIS_URL ? 'REDIS_URL' : 
                    process.env.REDIS_HOST ? 'REDIS_HOST' : 'none'
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
  
  // Initialize Redis connection with graceful fallback
  try {
    const redisConnected = await redisService.connect();
    if (redisConnected) {
      console.log('✅ Real-time architecture ready with Redis + Socket.IO');
      console.log('🔄 Redis caching and pub/sub enabled');
    } else {
      console.log('⚠️ Redis connection failed - running in fallback mode');
      console.log('📱 Socket.IO real-time features still available (no caching/pub-sub)');
    }
  } catch (error) {
    console.error('❌ Redis initialization error:', error.message);
    console.log('📱 Server continues without Redis - Socket.IO still functional');
  }
  
  // Always log current status regardless of Redis
  console.log('\n🌟 Backend Services Status:');
  console.log(`   📡 HTTP/REST API: ✅ Running on port ${PORT}`);
  console.log(`   🔌 WebSocket/Socket.IO: ✅ Ready`);
  console.log(`   📊 Redis Cache: ${redisService.isReady() ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`   📘 API Documentation: ✅ Available at /docs`);
  
  // Start Zoho OAuth auto-refresh timer
  try {
    zohoOAuthService.startAutoRefreshTimer();
    console.log(`   🔑 Zoho OAuth: ✅ Auto-refresh enabled`);
  } catch (error) {
    console.log(`   🔑 Zoho OAuth: ⚠️ Auto-refresh failed - ${error.message}`);
  }
  
  // Start buffer scheduler for API limit handling
  try {
    // Buffer functionality now integrated into redisService
    console.log(`   📦 Buffer System: ✅ Integrated into Redis service`);
  } catch (error) {
    console.log(`   📦 Buffer Scheduler: ⚠️ Auto-retry failed - ${error.message}`);
  }
  
  // Cache functionality now integrated into redisService
  try {
    console.log(`   🗄️ Cache System: ✅ Integrated into Redis service`);
    
    // Check if cache needs initial population
    redisService.isCacheValid().then(isValid => {
      if (!isValid) {
        console.log(`   🗄️ Cache: ⚠️ Cache invalid, will populate on first request`);
      } else {
        console.log(`   🗄️ Cache: ✅ Cache valid`);
      }
    });
    
  } catch (error) {
    console.log(`   🗄️ Cache: ⚠️ Service failed - ${error.message}`);
  }
  
  // Sync functionality now integrated into redisService
  try {
    // zohoSyncService removed - functionality integrated into redisService
    
    console.log(`   🔄 Sync System: ✅ Integrated into Redis service`);
  } catch (error) {
    console.log(`   🔄 Sync System: ⚠️ Service failed - ${error.message}`);
  }
  
  console.log('');
});
