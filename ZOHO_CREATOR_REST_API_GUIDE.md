# Zoho Creator REST API Integration Guide

## 🎯 Overview

This guide demonstrates how to use the new Zoho Creator REST API integration with OAuth 2.0 authentication. The system supports realtime data updates for Zoho Creator widgets through a Node.js backend with Redis caching and Socket.IO.

## 🏗️ Architecture

```
                      +-------------------------+
                      |     Zoho Creator       |
                      |   (Form / Report API)  |
                      +-----------+-------------+
                                  |
                            (REST API / OAuth 2.0)
                                  |
                                  v
                    +-----------------------------+
                    |     Node.js Backend App     |
                    |-----------------------------|
                    | - Express.js Routes         |
                    | - OAuth 2.0 Service         |
                    | - Redis (cache, pub/sub)    |
                    | - Socket.IO (WebSocket)     |
                    +-----------------------------+
                        |                   |
                        |                   |
                   [Redis Cache]     [Socket.IO Server]
                        |                   |
                        v                   v
             +----------------+     +--------------------+
             | Zoho Widget A  |     |  Zoho Widget B ... |
             +----------------+     +--------------------+
```

## 🔧 Configuration

### Environment Variables
```env
# Zoho Creator OAuth Configuration
ZOHO_REDIRECT_URI=http://localhost:3000/api/auth/zoho/callback

# Optional for realtime features
REDIS_URL=redis://localhost:6379
SOCKET_IO_PORT=3001
```

### Zoho Creator App Configuration
- **Account Owner:** tsxcorp
- **App Link Name:** nxp
- **Client ID:** 1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS
- **Scopes:** ZohoCreator.form.CREATE,ZohoCreator.report.READ,ZohoCreator.meta.form.READ

## 🚀 Quick Start

### Step 1: Authentication Setup

1. **Get Authorization URL:**
```bash
curl http://localhost:3000/api/auth/zoho/authorize
```

2. **Visit the authorization URL and grant permissions**

3. **Exchange authorization code for tokens:**
```bash
curl -X POST http://localhost:3000/api/auth/zoho/token \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR_AUTHORIZATION_CODE"}'
```

### Step 2: Use REST APIs

**Get Registrations (Sample):**
```bash
curl http://localhost:3000/api/zoho-creator/registrations?limit=10&event_id=123
```

**Get Records from Any Report:**
```bash
curl "http://localhost:3000/api/zoho-creator/reports/Registrations/records?from=1&limit=50"
```

**Create New Record:**
```bash
curl -X POST http://localhost:3000/api/zoho-creator/forms/Registration_Form/records \
  -H "Content-Type: application/json" \
  -d '{
    "Full_Name": "John Doe",
    "Email": "john@example.com",
    "Phone_Number": "1234567890",
    "Event_Info": "4433256000012345678"
  }'
```

## 📡 API Endpoints

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/zoho/authorize` | Get authorization URL |
| POST | `/api/auth/zoho/token` | Exchange code for tokens |
| POST | `/api/auth/zoho/refresh` | Refresh access token |
| GET | `/api/auth/zoho/status` | Check token status |
| POST | `/api/auth/zoho/clear` | Clear all tokens |

### Zoho Creator REST API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zoho-creator/reports/{reportName}/records` | Get report records |
| GET | `/api/zoho-creator/reports/{reportName}/records/{id}` | Get specific record |
| POST | `/api/zoho-creator/forms/{formName}/records` | Create new record |
| PATCH | `/api/zoho-creator/reports/{reportName}/records/{id}` | Update record |
| DELETE | `/api/zoho-creator/reports/{reportName}/records/{id}` | Delete record |
| POST | `/api/zoho-creator/reports/{reportName}/search` | Search records |
| GET | `/api/zoho-creator/forms/{formName}/metadata` | Get form metadata |
| POST | `/api/zoho-creator/bulk/{operation}` | Bulk operations |

### Sample Endpoint (For Widgets)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zoho-creator/registrations` | Get registrations with filters |

## 🔍 Query Parameters

### For Report Records:
- `from` (int): Starting record number (default: 1)
- `limit` (int): Max records to return (default: 50, max: 200)
- `criteria` (string): Zoho Creator search criteria
- `sortBy` (string): Field name to sort by
- `sortOrder` (string): 'asc' or 'desc'

### Sample Criteria Examples:
```
Email == "user@example.com"
Added_Time > "2023-01-01"
Email.contains("@company.com") && Status == "Confirmed"
```

## 📊 Sample Responses

### Get Registrations Response:
```json
{
  "success": true,
  "data": [
    {
      "ID": "4433256000012345678",
      "Full_Name": "John Doe",
      "Email": "john@example.com",
      "Phone_Number": "1234567890",
      "Event_Info": "Event Name",
      "Added_Time": "2023-12-01 10:30:00",
      "Status": "Confirmed"
    }
  ],
  "count": 1,
  "metadata": {
    "from": 1,
    "limit": 50,
    "total": 1,
    "reportName": "Registrations"
  },
  "realtime": {
    "timestamp": "2023-12-01T10:30:00.000Z",
    "cached": false,
    "socketRoom": "registrations_123",
    "filters": {
      "event_id": "123",
      "status": null
    }
  }
}
```

## 🔄 Token Management

### Automatic Token Refresh
The system automatically handles token refresh when:
- Access token is expired (with 5-minute buffer)
- API returns 401 Unauthorized
- Token refresh is available

### Manual Token Operations:
```javascript
// Check token status
const status = await fetch('/api/auth/zoho/status');

// Manual refresh
const refreshed = await fetch('/api/auth/zoho/refresh', { method: 'POST' });

// Clear tokens (logout)
const cleared = await fetch('/api/auth/zoho/clear', { method: 'POST' });
```

## 🚨 Error Handling

### Common Error Responses:

**Authentication Required:**
```json
{
  "success": false,
  "error": "Authentication failed. Please re-authenticate.",
  "suggestion": "You may need to re-authenticate using /api/auth/zoho/authorize"
}
```

**Invalid Criteria:**
```json
{
  "success": false,
  "error": "Zoho API Error: Invalid criteria format",
  "details": "Please check the criteria syntax"
}
```

## 🔧 Integration with Zoho Widgets

### For Realtime Updates:
1. **Use the sample endpoint** `/api/zoho-creator/registrations`
2. **Poll for updates** or implement Socket.IO for realtime push
3. **Cache responses** using Redis for better performance
4. **Filter by event/status** using query parameters

### Widget JavaScript Example:
```javascript
// Fetch registrations for widget
async function fetchRegistrations(eventId) {
  const response = await fetch(`/api/zoho-creator/registrations?event_id=${eventId}&limit=100`);
  const data = await response.json();
  
  if (data.success) {
    updateWidget(data.data);
    // Subscribe to realtime updates
    subscribeToRoom(data.realtime.socketRoom);
  }
}

// Subscribe to realtime updates (requires Socket.IO setup)
function subscribeToRoom(room) {
  socket.join(room);
  socket.on('registrations_updated', (newData) => {
    updateWidget(newData);
  });
}
```

## 📋 Next Steps for Realtime Architecture

### TODO: Implement Redis Caching
```javascript
// Cache GET responses for 5 minutes
app.use('/api/zoho-creator/reports', cacheMiddleware(300));

// Invalidate cache on CREATE/UPDATE/DELETE
app.post('/api/zoho-creator/forms/:formName/records', invalidateCache, createRecord);
```

### TODO: Implement Socket.IO
```javascript
// Emit updates when data changes
io.to(`registrations_${eventId}`).emit('registrations_updated', newData);

// Auto-refresh widgets when backend receives updates
webhook.on('zoho_record_updated', (data) => {
  io.emit('data_changed', data);
});
```

### TODO: Add Webhook Support
```javascript
// Receive notifications from Zoho Creator
app.post('/webhooks/zoho/record-updated', (req, res) => {
  const { reportName, recordId, operation } = req.body;
  
  // Invalidate cache
  cache.del(`report:${reportName}`);
  
  // Notify connected widgets
  io.emit('data_changed', { reportName, recordId, operation });
  
  res.json({ success: true });
});
```

## 🛠️ Development & Testing

### Use Swagger UI:
Visit `http://localhost:3000/docs` for interactive API documentation and testing.

### Test Authentication:
```bash
# 1. Get auth URL
curl http://localhost:3000/api/auth/zoho/authorize

# 2. Visit URL, get code, exchange for tokens
curl -X POST http://localhost:3000/api/auth/zoho/token \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR_CODE"}'

# 3. Test API calls
curl http://localhost:3000/api/zoho-creator/registrations
```

## 📚 Additional Resources

- [Zoho Creator REST API Documentation](https://www.zoho.com/creator/help/api/rest-api/)
- [OAuth 2.0 Flow Documentation](https://www.zoho.com/creator/help/api/rest-api/oauth-steps.html)
- [Swagger UI Documentation](http://localhost:3000/docs)

---

🎉 **Your Zoho Creator REST API integration is ready!** Start building realtime widgets and applications with this solid foundation.
