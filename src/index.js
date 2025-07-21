const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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

app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/business-matching', businessMatchingRoutes);

// === Start server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NEXPO Backend running at http://localhost:${PORT}`);
  console.log(`📘 Swagger UI available at /docs`);
});
