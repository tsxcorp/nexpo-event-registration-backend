# Sync Worker Service Documentation

## 🎯 Purpose

Sync Worker Service tự động đồng bộ dữ liệu giữa **Zoho Creator** và **Redis**, phát hiện chênh lệch và thực hiện sync incremental để đảm bảo data consistency.

## 🚨 Vấn Đề Đã Fix

### **1. Event Undefined trong Redis Sync**
- **Lỗi**: Template string sai syntax trong `src/routes/registrations.js`
- **Fix**: `logger.info("Syncing new record ${recordId}...")` → `logger.info(\`Syncing new record ${recordId}...\`)`
- **Kết quả**: Redis sync giờ sẽ hiển thị đúng event ID

### **2. Chênh Lệch Data Zoho vs Redis**
- **Vấn đề**: Zoho có 2,419 records, Redis chỉ có 2,355
- **Nguyên nhân**: Không có cơ chế tự động sync chênh lệch
- **Giải pháp**: Sync Worker Service

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Zoho Creator  │    │  Sync Worker    │    │     Redis       │
│                 │◄──►│    Service      │◄──►│                 │
│ - Events        │    │                 │    │ - Per-record    │
│ - Registrations │    │ - Full Sync     │    │ - Per-event     │
│ - Real-time     │    │ - Incremental   │    │ - Metadata      │
└─────────────────┘    │ - Discrepancy   │    └─────────────────┘
                       │   Detection     │
                       └─────────────────┘
```

## 🔧 Components

### **1. SyncWorker Class** (`src/services/syncWorker.js`)

#### **Core Methods:**
- `start()` - Start sync worker với auto sync
- `stop()` - Stop sync worker
- `performFullSync()` - Full sync tất cả events
- `performIncrementalSync()` - Sync chỉ events cần thiết
- `forceSyncEvent(eventId)` - Force sync specific event
- `getStatus()` - Get worker status và statistics

#### **Configuration:**
```javascript
{
  syncIntervalMs: 5 * 60 * 1000,    // 5 minutes
  batchSize: 100,                   // Records per batch
  maxRetries: 3,                    // Retry attempts
  enableAutoSync: true,             // Auto sync enabled
  enableDiscrepancyDetection: true  // Detect differences
}
```

### **2. API Endpoints** (`src/routes/syncWorker.js`)

#### **GET** `/api/sync-worker/status`
- Get sync worker status và statistics

#### **POST** `/api/sync-worker/start`
- Start sync worker

#### **POST** `/api/sync-worker/stop`
- Stop sync worker

#### **POST** `/api/sync-worker/full-sync`
- Perform full synchronization

#### **POST** `/api/sync-worker/incremental-sync`
- Perform incremental synchronization

#### **POST** `/api/sync-worker/force-sync/{eventId}`
- Force sync specific event

#### **GET** `/api/sync-worker/discrepancy-check`
- Check for data discrepancies

## 🚀 Usage Examples

### **1. Start Sync Worker**
```bash
curl -X POST http://localhost:3000/api/sync-worker/start
```

### **2. Check Status**
```bash
curl http://localhost:3000/api/sync-worker/status
```

### **3. Force Sync Specific Event**
```bash
curl -X POST http://localhost:3000/api/sync-worker/force-sync/4433256000013547003
```

### **4. Check Discrepancies**
```bash
curl http://localhost:3000/api/sync-worker/discrepancy-check
```

### **5. Full Sync**
```bash
curl -X POST http://localhost:3000/api/sync-worker/full-sync
```

## 📊 Monitoring & Statistics

### **Sync Stats:**
```javascript
{
  total_syncs: 0,
  successful_syncs: 0,
  failed_syncs: 0,
  records_added: 0,
  records_updated: 0,
  records_removed: 0,
  last_sync_duration: 0
}
```

### **Worker Status:**
```javascript
{
  is_running: true,
  config: { ... },
  stats: { ... },
  last_sync_time: "2024-01-01T00:00:00.000Z"
}
```

## 🔄 Sync Strategies

### **1. Full Sync**
- Fetches all events từ Zoho
- Syncs all records for each event
- Updates Redis với per-record schema
- Runs on startup và manual trigger

### **2. Incremental Sync**
- Checks cached events for staleness
- Only syncs events updated > 10 minutes ago
- Compares Redis vs Zoho record counts
- Runs automatically every 5 minutes

### **3. Force Sync**
- Manual sync for specific event
- Bypasses staleness checks
- Useful for immediate updates

## 🛠️ Environment Variables

```bash
# Sync Worker Configuration
SYNC_INTERVAL_MS=300000          # 5 minutes
SYNC_BATCH_SIZE=100              # Records per batch
SYNC_MAX_RETRIES=3               # Retry attempts
ENABLE_AUTO_SYNC=true            # Enable auto sync
ENABLE_DISCREPANCY_DETECTION=true # Enable discrepancy detection

# Logging (for Railway optimization)
LOG_LEVEL=INFO
REDIS_LOG_LEVEL=WARN
```

## 🧪 Testing

### **Test Script:**
```bash
node scripts/test-sync-worker.js
```

### **Manual Testing:**
1. Start backend: `npm start`
2. Start sync worker: `POST /api/sync-worker/start`
3. Check status: `GET /api/sync-worker/status`
4. Test force sync: `POST /api/sync-worker/force-sync/{eventId}`
5. Check discrepancies: `GET /api/sync-worker/discrepancy-check`

## 🚀 Deployment

### **1. Production Setup:**
```bash
# Set environment variables
export SYNC_INTERVAL_MS=300000
export ENABLE_AUTO_SYNC=true
export LOG_LEVEL=INFO
```

### **2. Start Auto Sync:**
```bash
# Auto start sync worker on backend startup
curl -X POST https://your-backend.com/api/sync-worker/start
```

### **3. Monitor:**
```bash
# Check sync worker status
curl https://your-backend.com/api/sync-worker/status

# Check discrepancies
curl https://your-backend.com/api/sync-worker/discrepancy-check
```

## 📈 Benefits

### **1. Data Consistency**
- ✅ Automatic detection of discrepancies
- ✅ Incremental sync reduces load
- ✅ Per-record schema for granular updates

### **2. Performance**
- ✅ Only syncs changed data
- ✅ Batch processing
- ✅ Configurable intervals

### **3. Reliability**
- ✅ Retry mechanisms
- ✅ Error handling
- ✅ Status monitoring

### **4. Monitoring**
- ✅ Real-time statistics
- ✅ Discrepancy detection
- ✅ Manual override capabilities

## 🔍 Troubleshooting

### **Common Issues:**

#### **1. Sync Worker Not Starting**
```bash
# Check status
curl /api/sync-worker/status

# Check logs for errors
# Restart if needed
curl -X POST /api/sync-worker/start
```

#### **2. High Discrepancy Count**
```bash
# Check specific event
curl /api/sync-worker/discrepancy-check

# Force sync problematic event
curl -X POST /api/sync-worker/force-sync/{eventId}
```

#### **3. Sync Failures**
```bash
# Check Zoho API connectivity
# Check Redis connection
# Review error logs
# Adjust retry settings
```

---

**Status**: ✅ **COMPLETED** - Ready for production deployment
