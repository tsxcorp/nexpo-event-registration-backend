# Per-Record Schema Migration Scripts

This directory contains scripts to migrate existing Redis data from the per-event schema to the new per-record schema for optimal performance.

## 🎯 What is Per-Record Schema?

**Per-record schema** is a Redis data organization strategy that stores each registration record individually, enabling:

- ✅ **Faster individual operations** (check-in, updates)
- ✅ **Concurrent updates** without conflicts
- ✅ **Memory efficiency** (load only needed records)
- ✅ **Better scalability** for large events

### Schema Comparison

| Aspect | Per-Event Schema (Old) | Per-Record Schema (New) |
|--------|----------------------|------------------------|
| **Storage** | `cache:event:{eventId}:registrations` → [array] | `cache:record:{recordId}` → {object} |
| **Event Index** | Single array per event | `cache:event:{eventId}:record_ids` → [ids] |
| **Update 1 record** | Load 2,422 records → Update → Save | Update 1 record key |
| **Check-in operation** | O(n) complexity | O(1) complexity |
| **Memory usage** | Load large arrays | Load only needed records |

## 📁 Scripts

### 1. `migrate-to-per-record-schema.js`
**Main migration script** that converts existing data to per-record schema.

```bash
node scripts/migrate-to-per-record-schema.js
```

**What it does:**
- Reads all existing `cache:event:*:registrations` keys
- Creates individual `cache:record:{recordId}` keys
- Creates `cache:event:{eventId}:record_ids` lists
- Preserves original keys for backward compatibility
- Provides detailed progress and statistics

**Features:**
- ✅ Safe to run multiple times
- ✅ Preserves existing data
- ✅ Progress tracking
- ✅ Error handling
- ✅ Validation

### 2. `test-per-record-migration.js`
**Testing and validation script** that verifies migration success.

```bash
node scripts/test-per-record-migration.js
```

**What it does:**
- Checks migration status
- Compares performance between schemas
- Validates data integrity
- Tests individual record operations

**Tests:**
- 📊 Migration completeness check
- ⚡ Performance comparison
- 🔍 Data integrity validation
- 🎯 Individual record access test

## 🚀 Usage Guide

### Step 1: Backup (Recommended)
```bash
# Create Redis backup before migration
redis-cli --rdb backup-$(date +%Y%m%d-%H%M%S).rdb
```

### Step 2: Run Migration
```bash
node scripts/migrate-to-per-record-schema.js
```

**Expected Output:**
```
🚀 Starting Per-Record Schema Migration
=====================================
🔗 Connecting to Redis...
✅ Connected to Redis successfully
🔍 Scanning for event keys...
📊 Found 12 event registration keys

📋 Migration Plan:
   Events to process: 12
   Estimated records: 1200 (rough estimate)
   Target schema: Per-record with individual keys

🔄 Starting migration...
🔄 Processing event: 4433256000013547003
📦 Found 2424 records for event 4433256000013547003
✅ Migrated event 4433256000013547003: 2424 records
📊 Progress: 8.3% (1/12 events)
...

✅ Migration Completed!
====================
⏱️  Duration: 15.23 seconds
📊 Events processed: 12
📦 Records migrated: 15132
🔗 Record IDs lists created: 12
❌ Errors: 0

🎉 Migration successful! All data is now available in per-record schema.
```

### Step 3: Test Migration
```bash
node scripts/test-per-record-migration.js
```

**Expected Output:**
```
🧪 Per-Record Schema Migration Tester
====================================

🔍 Checking Migration Status
============================
📊 Individual record keys: 15132
📊 Record IDs keys: 12
📊 Original event keys: 12

📋 Migration Status:
   Individual records: ✅
   Record IDs lists: ✅
   Original keys (preserved): ✅

🎉 Migration appears to be successful!

⚡ Performance Comparison Test
==============================
🔍 Testing with event: 4433256000013547003

📊 Test 1: Original Per-Event Schema
   Records loaded: 2424
   Duration: 45ms
   Memory usage: ~2048576 bytes

📊 Test 2: New Per-Record Schema
   Record IDs loaded: 2424
   Sample records loaded: 10
   Duration: 12ms
   Memory usage: ~8192 bytes

📈 Performance Summary:
   Original schema (full load): 45ms
   New schema (sample load): 12ms
   Individual update: 3ms
   ✅ New schema is faster for partial data access
```

## 🔧 API Usage After Migration

### New Per-Record Endpoints

**1. Get Event Data (Optimized)**
```bash
curl "http://localhost:3000/api/cache/events/4433256000013547003/per-record?limit=100"
```

**2. Get Individual Record**
```bash
curl "http://localhost:3000/api/cache/records/4433256000015047187"
```

**3. Update Individual Record (Check-in)**
```bash
curl -X PUT "http://localhost:3000/api/cache/records/4433256000015047187" \
  -H "Content-Type: application/json" \
  -d '{
    "Check_in_Status": "checked_in",
    "Check_in_Time": "2025-09-20T12:00:00Z"
  }'
```

### Backward Compatibility

**Original endpoints still work:**
```bash
curl "http://localhost:3000/api/cache/events/4433256000013547003"
```

## 📊 Performance Benefits

### Check-in Operations
- **Before:** Load 2,422 records → Find → Update → Save (O(n))
- **After:** Direct update 1 record (O(1))

### Memory Usage
- **Before:** Load entire event array (2MB+ for large events)
- **After:** Load only needed records (few KB)

### Concurrent Updates
- **Before:** Race conditions with array updates
- **After:** No conflicts with individual record updates

### Scalability
- **Before:** Performance degrades with event size
- **After:** Consistent performance regardless of event size

## 🛠️ Troubleshooting

### Migration Errors
```bash
❌ Error migrating event cache:event:4433256000013547003:registrations: ...
```
- Check Redis connection
- Verify data format
- Check available memory

### Missing Records After Migration
```bash
⚠️ Record 4433256000015047187: Missing data
```
- Re-run migration script (safe to run multiple times)
- Check Redis memory limits
- Verify record ID format

### Performance Issues
- Ensure Redis has sufficient memory
- Check network latency to Redis
- Monitor Redis CPU usage

## 🔄 Rollback (If Needed)

If you need to rollback to the original schema:

1. **Disable per-record endpoints** in `src/routes/cache.js`
2. **Use original endpoints only**
3. **Optional:** Remove individual record keys:
   ```bash
   redis-cli --scan --pattern "cache:record:*" | xargs redis-cli del
   redis-cli --scan --pattern "cache:event:*:record_ids" | xargs redis-cli del
   ```

## 📈 Monitoring

### Key Metrics to Monitor
- Individual record count: `redis-cli dbsize`
- Memory usage: `redis-cli info memory`
- Performance: Monitor API response times
- Error rates: Check application logs

### Health Check
```bash
# Check migration status
redis-cli eval "return #redis.call('keys', 'cache:record:*')" 0

# Check record IDs lists
redis-cli eval "return #redis.call('keys', 'cache:event:*:record_ids')" 0
```

## 🎯 Next Steps

After successful migration:

1. **Update frontend** to use new per-record endpoints for check-ins
2. **Monitor performance** improvements
3. **Consider removing** old per-event keys after full validation
4. **Update documentation** for new API endpoints

---

**Need help?** Check the application logs or contact the development team.
