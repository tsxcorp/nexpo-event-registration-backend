# 🔒 CSP (Content Security Policy) Fix Instructions

## ❌ **Vấn Đề Hiện Tại**

Widget đang bị Zoho Creator CSP chặn vì:
```
Refused to connect to 'http://localhost:3000/...' because it violates the following Content Security Policy directive: "connect-src https://*.zappsusercontent.com https://*.zohostatic.com ..."
```

## 🔍 **Nguyên Nhân**

Zoho Creator có CSP **rất nghiêm ngặt** chỉ cho phép kết nối đến:
- `https://*.zappsusercontent.com`
- `https://*.zohostatic.com`
- `https://*.sigmausercontent.com`
- `https://*.qntrlusercontent.com`
- `https://www.zohoapis.com`
- `https://creator.zoho.com`
- `https://accounts.zoho.com`

## ✅ **Solutions**

### **Option 1: Force Production URL (RECOMMENDED)**

Widget đã được fix với `FORCE_PRODUCTION = true`:

```javascript
// Widget sẽ luôn dùng production URL
const FORCE_PRODUCTION = true;

if (FORCE_PRODUCTION) {
    return {
        BASE_URL: 'https://nexpo-event-registration-backend-production.up.railway.app'
    };
}
```

### **Option 2: Whitelist Backend Domain trong Zoho CSP**

**Contact Zoho Support** để thêm backend domain vào CSP whitelist:
```
https://nexpo-event-registration-backend-production.up.railway.app
```

### **Option 3: Use Zoho APIs Only**

Nếu CSP vẫn block, có thể cần dùng **ZOHO.CREATOR.API** thay vì external backend.

## 🛠️ **Fix Implemented**

### **1. Widget Auto-Detection Enhanced**
```javascript
function getBackendConfig() {
    const FORCE_PRODUCTION = true; // ← ALWAYS use production
    
    if (FORCE_PRODUCTION) {
        return {
            BASE_URL: 'https://nexpo-event-registration-backend-production.up.railway.app'
        };
    }
    
    // Backup detection logic...
}
```

### **2. Enhanced Environment Detection**
```javascript
const isZohoCreator = currentHostname.includes('zoho.com') || 
                     currentHostname.includes('zappsusercontent.com') ||
                     currentHostname.includes('zohostatic.com') ||
                     // More Zoho domains...
```

### **3. Backend CORS Updated**
```javascript
// Backend now allows all Zoho domains
const isAllowed = origin.includes('.zoho.com') || 
                 origin.includes('.zappsusercontent.com') ||
                 origin.includes('.sigmausercontent.com') ||
                 // All CSP domains...
```

## 🧪 **Testing**

### **1. Check Widget Logs**
Upload widget và check console:
```javascript
🔍 Environment Detection: {
    hostname: "xxx.zappsusercontent.com",
    isZohoCreator: true,
    selectedURL: "https://nexpo-event-registration-backend-production.up.railway.app"
}
```

### **2. Verify Backend Connection**
Nên thấy:
```javascript
✅ Backend config loaded: https://nexpo-event-registration-backend-production.up.railway.app
✅ API health check passed: ok
```

### **3. Check CSP Errors**
Nếu vẫn có CSP errors, cần contact Zoho support.

## 📋 **Deployment Steps**

### **Step 1: Upload Fixed Widget**
```javascript
// File: /Users/travisvo/Projects/nxp_organizer_portal/app/widget.js
// FORCE_PRODUCTION = true đã được set
```

### **Step 2: Test in Zoho Creator**
1. Upload widget.js
2. Check browser console
3. Verify production URL được sử dụng

### **Step 3: Monitor Logs**
```javascript
// Expected logs:
🔒 FORCE_PRODUCTION enabled - using production URL
🌐 Making API request to: https://nexpo-event-registration-backend-production.up.railway.app/api/health
✅ API health check passed
```

## 🆘 **If Still Blocked**

### **Option A: Contact Zoho Support**
Request thêm domain vào CSP:
```
Domain: nexpo-event-registration-backend-production.up.railway.app
Reason: External API integration for event management
```

### **Option B: Proxy Through Zoho**
Tạo Zoho Custom Function làm proxy:
```javascript
// Zoho Custom Function
function proxyApiCall(endpoint) {
    const response = invokeurl [
        url: "https://nexpo-event-registration-backend-production.up.railway.app" + endpoint
        type: GET
    ];
    return response;
}
```

### **Option C: Use Zoho APIs Only**
Chuyển từ external backend sang full Zoho Creator APIs.

## 🎯 **Expected Result**

Sau khi fix:
- ✅ Widget tự động dùng production URL
- ✅ No more CSP errors
- ✅ API calls work trong Zoho Creator
- ✅ Real-time features hoạt động

## 🔗 **Files Updated**

1. **Widget:** `/Users/travisvo/Projects/nxp_organizer_portal/app/widget.js`
   - `FORCE_PRODUCTION = true`
   - Enhanced detection
   
2. **Backend:** `src/index.js`
   - Enhanced CORS for all Zoho domains
   - Added CSP domains support

Upload widget.js và test ngay! 🚀
