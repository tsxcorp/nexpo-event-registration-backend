# Hướng dẫn CRUD từ Zoho vào Redis

## Tổng quan

Hệ thống này cung cấp nhiều phương án để update CRUD từ Zoho vào Redis sau mỗi thay đổi, đảm bảo dữ liệu luôn đồng bộ và real-time.

## 🎯 Các phương án triển khai

### 1. **Webhook-based Real-time Updates** (Khuyến nghị)

#### Setup Webhook trên Zoho Creator:
```javascript
// URL endpoint cho webhook
POST https://your-domain.com/webhooks/zoho-changes

// Payload structure
{
  "event_type": "record_updated",
  "record_id": "123456789",
  "event_id": "event_123",
  "data": { /* record data */ },
  "signature": "sha256=...",
  "timestamp": "2025-01-20T10:00:00Z"
}
```

#### Các event types được hỗ trợ:
- `record_created` / `CREATE` - Tạo record mới
- `record_updated` / `UPDATE` - Cập nhật record
- `record_deleted` / `DELETE` - Xóa record  
- `bulk_operation` / `BULK_UPDATE` - Thay đổi hàng loạt

### 2. **Real-time Sync Service với Change Detection**

Tự động detect changes và sync mỗi 2-5 phút:

```bash
# Khởi động real-time sync
POST /api/sync/start

# Dừng real-time sync
POST /api/sync/stop

# Kiểm tra status
GET /api/sync/status
```

### 3. **CRUD API Endpoints**

Sử dụng các API endpoints để thực hiện CRUD operations với auto sync:

```bash
# Tạo record mới
POST /api/zoho-crud/create
{
  "report_name": "All_Registrations",
  "data": { /* record data */ },
  "update_cache": true
}

# Đọc dữ liệu
GET /api/zoho-crud/read?report_name=All_Registrations&event_id=123&use_cache=true

# Cập nhật record
PUT /api/zoho-crud/update
{
  "report_name": "All_Registrations", 
  "record_id": "123456789",
  "data": { /* updated data */ },
  "update_cache": true
}

# Xóa record
DELETE /api/zoho-crud/delete
{
  "report_name": "All_Registrations",
  "record_id": "123456789",
  "update_cache": true
}
```

## 🔧 Cấu hình và Setup

### 1. Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Webhook Security
ZOHO_WEBHOOK_SECRET=your_webhook_secret

# Zoho API
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REDIRECT_URI=your_redirect_uri
```

### 2. Khởi tạo Services

```javascript
const zohoSyncService = require('./services/zohoSyncService');
const redisPopulationService = require('./services/redisPopulationService');

// Khởi động real-time sync
await zohoSyncService.startRealTimeSync();

// Khởi tạo cache
await redisPopulationService.populateFromZoho();
```

## 🚀 Hướng dẫn sử dụng

### Phương án 1: Setup Webhook (Khuyến nghị)

1. **Cấu hình Webhook trên Zoho Creator:**
   - Vào Settings > Webhooks
   - Thêm webhook URL: `https://your-domain.com/webhooks/zoho-changes`
   - Chọn events: Create, Update, Delete
   - Thêm signature secret (optional)

2. **Test webhook:**
```bash
curl -X POST https://your-domain.com/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "record_updated",
    "record_id": "test_123",
    "event_id": "event_456"
  }'
```

### Phương án 2: Sử dụng Real-time Sync Service

1. **Khởi động sync service:**
```bash
POST /api/sync/start
```

2. **Thêm event cụ thể vào monitoring:**
```bash
POST /api/sync/add-event
{
  "event_id": "4433256000013114003",
  "priority": "fast"  // fast(5min), normal(15min), slow(60min)
}
```

3. **Kiểm tra status:**
```bash
GET /api/sync/status
```

### Phương án 3: Manual CRUD Operations

1. **Tạo record mới và auto-sync:**
```bash
POST /api/zoho-crud/create
{
  "report_name": "All_Registrations",
  "data": {
    "full_name": "Nguyen Van A",
    "email": "test@example.com",
    "event_info": "4433256000013114003"
  },
  "update_cache": true
}
```

2. **Bulk sync toàn bộ dữ liệu:**
```bash
POST /api/zoho-crud/bulk-sync
{
  "report_name": "All_Registrations",
  "force_refresh": true
}
```

## 📊 Monitoring và Metrics

### 1. Webhook Metrics
```bash
GET /webhooks/metrics?date=2025-01-20
```

### 2. Sync Status
```bash
GET /api/sync/status
```

### 3. Cache Status  
```bash
GET /api/zoho-crud/sync-status
```

### 4. Health Checks
```bash
GET /api/health
GET /webhooks/health
GET /api/sync/health
```

## 🔄 Real-time Updates qua Socket.IO

Clients có thể lắng nghe real-time updates:

```javascript
const socket = io('https://your-domain.com');

// Lắng nghe các events
socket.on('record_created', (data) => {
  console.log('New record created:', data);
});

socket.on('record_updated', (data) => {
  console.log('Record updated:', data);
});

socket.on('record_deleted', (data) => {
  console.log('Record deleted:', data);
});

socket.on('bulk_update', (data) => {
  console.log('Bulk update completed:', data);
});
```

## ⚡ Performance và Optimization

### 1. Cache TTL Strategy
```javascript
// Smart TTL cho different data types
eventData: 900,        // 15 minutes
allRegistrations: 1800, // 30 minutes  
metadata: 3600,         // 1 hour
```

### 2. Batch Processing
```javascript
// Process changes trong batches để tránh overwhelm
batchSize: 50,
maxConcurrentSyncs: 3,
retryDelay: 5000
```

### 3. Change Detection
```javascript
// Detect changes mỗi 2 phút
changeDetectionInterval: 2, // minutes
fastSync: 5,        // High-priority events
normalSync: 15,     // Normal events  
slowSync: 60,       // Low-priority events
```

## 🛡️ Security và Validation

### 1. Webhook Signature Validation
```javascript
// Validate webhook signature using HMAC-SHA256
const isValid = validateWebhookSignature(req, signature);
```

### 2. Rate Limiting
```javascript
// Built-in rate limiting để protect endpoints
maxRetries: 3,
retryDelay: 5000
```

### 3. Error Handling
```javascript
// Graceful error handling với fallback mechanisms
try {
  await updateCache(data);
} catch (error) {
  // Fallback to full sync if individual update fails
  await triggerFullSync();
}
```

## 🧪 Testing

### 1. Test Webhook
```bash
POST /webhooks/test
{
  "event_type": "record_updated",
  "record_id": "test_123",
  "data": { "test": true }
}
```

### 2. Test Sync
```bash
POST /api/sync/trigger-full
```

### 3. Test CRUD
```bash
# Test read with cache
GET /api/zoho-crud/read?report_name=All_Registrations&use_cache=true

# Test integrity
GET /api/zoho-crud/sync-status
```

## 📈 Troubleshooting

### 1. Cache Issues
```bash
# Clear cache
POST /api/cache/clear

# Force refresh
POST /api/zoho-crud/bulk-sync
{
  "force_refresh": true
}
```

### 2. Sync Issues
```bash
# Restart sync service
POST /api/sync/stop
POST /api/sync/start

# Check sync status
GET /api/sync/status
```

### 3. Webhook Issues
```bash
# Check webhook metrics
GET /webhooks/metrics

# Test webhook manually
POST /webhooks/test
```

## 🏆 Best Practices

1. **Sử dụng Webhook làm primary method** cho real-time updates
2. **Backup với Sync Service** để đảm bảo consistency
3. **Monitor metrics** thường xuyên để detect issues
4. **Setup proper TTL** cho các loại data khác nhau
5. **Implement proper error handling** và fallback mechanisms
6. **Use batch processing** cho bulk operations
7. **Validate webhook signatures** để đảm bảo security

## 📞 Support

Nếu có vấn đề gì, hãy check:
1. Server logs cho error details
2. Redis connection status
3. Zoho API rate limits
4. Webhook configuration

Hoặc sử dụng health check endpoints để diagnose issues.


