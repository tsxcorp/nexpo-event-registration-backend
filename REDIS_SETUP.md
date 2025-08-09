# Redis Setup and Troubleshooting Guide

## Environment Configuration

Create a `.env` file in your project root with the following configuration:

### Method 1: Redis URL (Recommended for Cloud Deployments)
```env
# For cloud Redis providers (Railway, Heroku, etc.)
REDIS_URL=redis://username:password@host:port
# or for SSL/TLS
REDIS_URL=rediss://username:password@host:port
```

### Method 2: Individual Redis Settings
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

### Method 3: Local Development (No Redis)
```env
# Leave Redis variables empty for local development
# The system will gracefully fallback to standalone mode
```

## Common Redis Connection Issues

### 1. Connection Refused
**Error**: `ECONNREFUSED 127.0.0.1:6379`
**Solution**: 
- Install Redis locally: `brew install redis` (macOS) or `apt-get install redis-server` (Ubuntu)
- Start Redis: `redis-server`
- Or use cloud Redis and set `REDIS_URL`

### 2. Authentication Failed
**Error**: `WRONGPASS invalid username-password pair`
**Solution**: 
- Check your Redis password in the connection string
- Ensure the format is correct: `redis://username:password@host:port`

### 3. SSL/TLS Issues
**Error**: `Error: socket hang up`
**Solution**:
- Use `rediss://` (with double 's') for SSL connections
- Check if your Redis provider requires SSL

### 4. Timeout Issues
**Error**: `Connection timeout`
**Solution**:
- Check network connectivity
- Verify firewall settings
- Increase timeout in Redis configuration

## Testing Redis Connection

Run the test script to verify your Redis connection:

```bash
node test-redis.js
```

## Fallback Mode

If Redis is unavailable, the backend will automatically run in fallback mode:

✅ **What Still Works:**
- All REST API endpoints
- Socket.IO real-time features
- WebSocket connections
- Data processing

❌ **What's Disabled:**
- Redis caching (slower API responses)
- Cross-instance pub/sub (for scaling)
- Session persistence across restarts

## Production Recommendations

1. **Use Redis URL format** for cloud deployments
2. **Enable SSL/TLS** for production Redis instances
3. **Set proper timeouts** for network stability
4. **Monitor Redis health** in your deployment

## Environment Variables Summary

```env
# Required for production
NODE_ENV=production
PORT=3000

# Redis (choose one method)
REDIS_URL=your_redis_connection_string
# OR
REDIS_HOST=your_host
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Zoho Configuration
ZOHO_ORG_NAME=tsxcorp
ZOHO_BUSINESS_MATCHING_PUBLIC_KEY=your_key
ZOHO_CHECKIN_PUBLIC_KEY=your_key
ZOHO_VISITOR_PUBLIC_KEY=your_key
```

## Widget Integration

The widget (`widget.js`) connects to the backend via:

1. **HTTP/REST API**: Always available
2. **WebSocket/Socket.IO**: Available even without Redis
3. **Real-time updates**: Works in standalone mode

If you see connection errors in the widget, check:
- Backend server is running
- CORS configuration allows your domain
- Network connectivity between widget and backend
