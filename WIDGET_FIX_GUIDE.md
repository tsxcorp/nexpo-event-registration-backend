# Widget.js Fix Guide - Sửa Lỗi Kết Nối Backend

## 🔍 Các Vấn Đề Phổ Biến

### 1. **CORS Errors (Lỗi CORS)**
```
❌ Access to fetch at 'http://localhost:3000/api/...' from origin 'https://creator.zoho.com' has been blocked by CORS policy
```

**Nguyên nhân:** Widget chạy trên domain Zoho nhưng gọi API backend khác domain

**Cách sửa:** Thêm headers CORS đúng trong widget:

```javascript
// ✅ FIX: Thêm headers CORS
function makeApiRequest(endpoint, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'include'
    };
    
    return fetch(backendUrl + endpoint, { ...defaultOptions, ...options });
}
```

### 2. **Socket.IO Connection Failed**
```
❌ WebSocket connection to 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' failed
```

**Nguyên nhân:** 
- Socket.IO library chưa được load
- URL backend không đúng
- Transport config không phù hợp

**Cách sửa:**

```javascript
// ✅ FIX: Load Socket.IO library động
function loadSocketIO() {
    return new Promise((resolve, reject) => {
        if (typeof io !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = `${backendUrl}/socket.io/socket.io.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Socket.IO'));
        document.head.appendChild(script);
    });
}

// ✅ FIX: Enhanced connection config
function connectRealTime(eventId) {
    window.realtimeSocket = io(backendUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'], // Cho phép cả 2 transport
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        withCredentials: true,
        extraHeaders: {
            'Origin': window.location.origin
        }
    });
}
```

### 3. **Backend URL Problems**
```
❌ TypeError: Failed to fetch
```

**Nguyên nhân:** URL backend không đúng giữa development và production

**Cách sửa:**

```javascript
// ✅ FIX: Auto-detect backend URL
function getBackendUrl() {
    const isZohoCreator = window.location.hostname.includes('zoho.com');
    
    const PRODUCTION_URL = 'https://nexpo-event-registration-backend-production.up.railway.app';
    const LOCAL_URL = 'http://localhost:3000';
    
    return isZohoCreator ? PRODUCTION_URL : LOCAL_URL;
}
```

### 4. **Network Timeout Issues**
```
❌ Request timeout
```

**Cách sửa:** Thêm retry logic và timeout handling:

```javascript
// ✅ FIX: Retry với exponential backoff
async function loadVisitorsWithRetry(eventId, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await makeApiRequest(`/api/visitors/${eventId}`);
            return response;
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

### 5. **Real-time Updates Not Working**
```
❌ No real-time updates received
```

**Cách sửa:** Đảm bảo subscribe đúng events:

```javascript
// ✅ FIX: Subscribe đúng events
window.realtimeSocket.on('connect', function() {
    // Join event room
    if (eventId) {
        window.realtimeSocket.emit('join_event', eventId);
    }
    
    // Subscribe to reports
    window.realtimeSocket.emit('subscribe_report', 'Registrations');
});

// ✅ FIX: Handle all update types
window.realtimeSocket.on('registration_data', handleRealTimeUpdate);
window.realtimeSocket.on('checkin_update', handleCheckInUpdate);
window.realtimeSocket.on('event_update', handleRealTimeUpdate);
```

## 🛠️ Hướng Dẫn Sử Dụng Widget Fix

### Bước 1: Include File Fix
Thêm vào đầu widget.js:

```javascript
// Load widget fix
const script = document.createElement('script');
script.src = '/widget-fix.js';
document.head.appendChild(script);
```

### Bước 2: Sử dụng Functions Đã Fix
Thay thế các function cũ:

```javascript
// ❌ Cũ:
// function setupRealTimeFeatures(eventId) { ... }

// ✅ Mới:
async function setupRealTimeFeatures(eventId) {
    return await WidgetFix.setupRealTimeFeatures(eventId);
}

// ❌ Cũ: 
// fetch(url).then(...)

// ✅ Mới:
WidgetFix.makeApiRequest('/api/visitors/123').then(...)
```

### Bước 3: Initialize Widget
```javascript
// ✅ Enhanced initialization
async function initializeWidget() {
    try {
        // Check backend health
        const isHealthy = await WidgetFix.checkBackendHealth();
        
        // Setup real-time
        await WidgetFix.setupRealTimeFeatures(eventId);
        
        // Load data with retry
        const visitors = await WidgetFix.loadVisitorsWithRetry(eventId);
        
        console.log('✅ Widget initialized successfully');
    } catch (error) {
        console.error('❌ Widget initialization failed:', error);
    }
}
```

## 🔍 Debug và Test

### 1. Kiểm tra Backend Health
```javascript
WidgetFix.checkBackendHealth().then(healthy => {
    console.log('Backend healthy:', healthy);
});
```

### 2. Test WebSocket Connection
```javascript
WidgetFix.connectRealTime('4433256000013114003');
```

### 3. Monitor Connection Status
```html
<div id="connection-status">🔌 Connecting...</div>
```

### 4. Debug trong Browser Console
Mở Developer Tools và kiểm tra:
- **Console tab:** Xem log messages
- **Network tab:** Kiểm tra API calls
- **WebSocket tab:** Monitor Socket.IO connection

## 📋 Checklist Sửa Lỗi

- [ ] ✅ Backend URL đúng (production vs development)
- [ ] ✅ CORS headers được thêm vào requests
- [ ] ✅ Socket.IO library được load đúng cách
- [ ] ✅ WebSocket transport config phù hợp
- [ ] ✅ Error handling và retry logic
- [ ] ✅ Event subscription đúng
- [ ] ✅ Connection status monitoring
- [ ] ✅ Timeout và reconnection handling

## 🚀 Test URLs

### Backend Health Check:
```
GET https://nexpo-event-registration-backend-production.up.railway.app/api/health
```

### Real-time Status:
```
GET https://nexpo-event-registration-backend-production.up.railway.app/api/status/realtime
```

### Test Page:
```
https://nexpo-event-registration-backend-production.up.railway.app/test-widget.html
```

## 💡 Tips

1. **Luôn check backend health trước khi connect**
2. **Sử dụng retry logic cho network requests**
3. **Monitor connection status trong UI**
4. **Log đầy đủ để debug**
5. **Fallback gracefully khi connection fail**
6. **Test trên cả local và production**

## 🆘 Support

Nếu vẫn gặp vấn đề, kiểm tra:
1. Backend server có đang chạy không
2. CORS configuration trong backend
3. Network connectivity
4. Browser console errors
5. API endpoint URLs
