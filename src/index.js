const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const importExcelRoute = require('./routes/importExcel');

require('dotenv').config();

const eventInfoRoutes = require('./routes/eventInfo');
const registerRoutes = require('./routes/register');

const app = express();

// Enable CORS for all origins (can restrict later if needed)
app.use(cors());

// Parse application/json
app.use(bodyParser.json());

// Route declarations
app.use('/api', eventInfoRoutes);
app.use('/api', registerRoutes);
app.use('/import-excel', importExcelRoute); // ✅ mount route ở /import-excel

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NEXPO Backend server is running on http://localhost:${PORT}`);
});
