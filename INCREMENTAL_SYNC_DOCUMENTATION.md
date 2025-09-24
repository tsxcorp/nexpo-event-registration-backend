# Incremental Sync Documentation

## Overview
The Sync Worker now uses **timestamp-based incremental sync** instead of count-based comparison, making it much more efficient by only syncing new/updated records.

## Key Improvements

### ✅ Before (Count-based):
- Compared Redis count vs Zoho count
- If different, fetched **ALL records** from Zoho
- Inefficient for large datasets
- No way to track individual record changes

### ✅ After (Timestamp-based):
- Tracks `last_sync` timestamp for each event
- Only fetches records created/modified after last sync
- Efficient for large datasets
- Tracks individual record changes

## Logic Flow

### 1. Event Detection
```javascript
// Check if event needs sync (15 minutes threshold)
const lastSyncTime = await redisService.get(`cache:event:${eventId}:last_sync`);
const timeDiff = now - lastSyncTime;
if (timeDiff > 15 * 60 * 1000) { // 15 minutes
  eventsToSync.push(eventId);
}
```

### 2. Incremental Fetch
```javascript
// Fetch only new/updated records
const response = await zohoCreatorAPI.getReportRecords('All_Registrations', {
  criteria: `Event_Info = ${eventId} AND (Created_Time > "${lastSyncTime}" OR Modified_Time > "${lastSyncTime}")`,
  max_records: 1000,
  fetchAll: true
});
```

### 3. Individual Record Sync
```javascript
// Sync each new record individually
for (const record of newRecords) {
  await redisService.updateEventRecord(eventId, record);
}
```

### 4. Update Timestamp
```javascript
// Update last sync timestamp
await redisService.set(`cache:event:${eventId}:last_sync`, new Date().toISOString(), -1);
```

## Configuration

### Environment Variables
```bash
# Sync interval (default: 5 minutes)
SYNC_INTERVAL_MS=300000

# Sync threshold (default: 15 minutes)
SYNC_THRESHOLD_MINUTES=15

# Batch size (default: 100)
SYNC_BATCH_SIZE=100

# Enable auto sync (default: true)
ENABLE_AUTO_SYNC=true

# Enable discrepancy detection (default: true)
ENABLE_DISCREPANCY_DETECTION=true
```

## Redis Keys Structure

### Per-Event Keys
```
cache:event:{eventId}:registrations    # Event registrations
cache:event:{eventId}:count           # Record count
cache:event:{eventId}:meta            # Event metadata
cache:event:{eventId}:last_sync       # Last sync timestamp ⭐ NEW
cache:event:{eventId}:record_ids      # Per-record schema
```

### Per-Record Keys
```
cache:record:{recordId}               # Individual record
```

## Benefits

### 🚀 Performance
- **Faster sync**: Only processes new records
- **Lower bandwidth**: Reduced API calls
- **Scalable**: Works efficiently with large datasets

### 🔍 Accuracy
- **Precise tracking**: Timestamp-based detection
- **Individual updates**: Each record synced separately
- **No data loss**: Handles partial syncs gracefully

### 🛡️ Reliability
- **Fault tolerant**: Continues on individual record errors
- **Audit trail**: Tracks sync timestamps
- **Configurable**: Adjustable thresholds

## Usage Examples

### Manual Incremental Sync
```bash
curl -X POST http://localhost:3000/api/sync-worker/incremental-sync
```

### Force Sync Specific Event
```bash
curl -X POST http://localhost:3000/api/sync-worker/force-sync/4433256000013547003
```

### Check Sync Status
```bash
curl -X GET http://localhost:3000/api/sync-worker/status
```

## Integration with Real-time Sync

### Hybrid Approach
1. **Real-time Sync**: Primary method (immediate via webhooks)
2. **Incremental Sync**: Secondary method (every 15 minutes)
3. **Force Sync**: Manual method (when needed)

### Sync Priority
1. **Webhook triggers**: Immediate sync
2. **Incremental worker**: Backup sync
3. **Manual force**: Emergency sync

## Monitoring

### Logs to Watch
```
Event 4433256000013547003: Last sync at 2025-09-21T07:00:00.000Z
Event 4433256000013547003: Found 5 new/updated records
Event 4433256000013547003: Incremental sync completed - 5 records synced
```

### Metrics
- `records_added`: New records synced
- `records_updated`: Modified records synced
- `last_sync_duration`: Sync performance
- `successful_syncs`: Success rate

## Troubleshooting

### Common Issues
1. **No new records**: Check timestamp format
2. **Sync errors**: Check Zoho API credentials
3. **Performance**: Adjust batch size

### Debug Commands
```bash
# Check last sync timestamp
redis-cli GET "cache:event:4433256000013547003:last_sync"

# Check sync status
curl -X GET http://localhost:3000/api/sync-worker/status
```
