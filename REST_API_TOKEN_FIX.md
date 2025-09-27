# REST API Token Auto-Refresh Fix

## Vấn đề

REST API liên tục bị lỗi 401 (Unauthorized) do token hết hạn, mặc dù đã có auto-refresh mechanism.

### Lỗi gặp phải:
```
[ERROR] Error fetching single event 4433256000012332047 via REST API: Request failed with status code 401
[ERROR] ❌ Error in fetchEventDetailsREST: Request failed with status code 401
```

## Nguyên nhân

**REST API và Custom API sử dụng token management khác nhau:**

- **Custom API**: Sử dụng `zohoOAuthService.executeWithTokenRefresh()` → Auto-refresh ✅
- **REST API**: Sử dụng `getZohoToken()` static function → No auto-refresh ❌

## Giải pháp

### 1. **Updated Token Management**

**File:** `src/utils/zohoEventUtilsREST.js`

**Trước:**
```javascript
const getZohoToken = () => {
  // Try environment variable first (for production)
  if (process.env.ZOHO_ACCESS_TOKEN) {
    return process.env.ZOHO_ACCESS_TOKEN;
  }
  
  // Fallback to tokens.json (for local development)
  try {
    const tokens = require('../../tokens.json');
    return tokens.accessToken || tokens.access_token;
  } catch (error) {
    logger.error('Error loading Zoho tokens:', error.message);
    throw new Error('Zoho OAuth token not available');
  }
};
```

**Sau:**
```javascript
const getZohoToken = async () => {
  const zohoOAuthService = require('./zohoOAuthService');
  
  try {
    // Use OAuth service to get valid token (with auto-refresh)
    const token = await zohoOAuthService.getValidAccessToken();
    return token;
  } catch (error) {
    logger.error('Error getting valid Zoho token:', error.message);
    throw new Error('Zoho OAuth token not available');
  }
};
```

### 2. **Updated Function Calls**

**Trước:**
```javascript
const fetchEventDetailsREST = async (eventIdInput) => {
  const token = getZohoToken(); // ❌ Static call, no auto-refresh
  
  try {
    // ... API calls
  } catch (err) {
    // ...
  }
};
```

**Sau:**
```javascript
const fetchEventDetailsREST = async (eventIdInput) => {
  try {
    const token = await getZohoToken(); // ✅ Async call with auto-refresh
    
    // ... API calls
  } catch (err) {
    // ...
  }
};
```

## Kết quả

### ✅ **Before Fix:**
```
[ERROR] Error fetching single event 4433256000012332047 via REST API: Request failed with status code 401
[ERROR] ❌ Error in fetchEventDetailsREST: Request failed with status code 401
```

### ✅ **After Fix:**
```
[INFO] 🔍 Fetching event data via REST API for: 4433256000012332047
[INFO] 🔍 Fetching event details for: 4433256000012332047
[INFO] Debug: Found 16 form fields in API_Events arrays
[INFO] Filtered 16 active fields from 16 total fields
[INFO] Extracted 49 exhibitors from event data
[INFO] Extracted 4 sessions from event data
✅ REST API Success!
Mode: single
Source: rest_api
Event ID: 4433256000012332047
Event Name: Automation World VietNam
```

## Benefits

🎯 **Unified Token Management**: REST API và Custom API cùng sử dụng OAuth service
🔄 **Auto-Refresh**: Token tự động refresh khi hết hạn
🚀 **Reliable Fallback**: REST API fallback hoạt động ổn định
📱 **Consistent Behavior**: Cả hai API có cùng behavior về token handling

## Testing

### 1. **Direct Function Test:**
```bash
node -e "
require('dotenv').config();
const { fetchEventDetailsREST } = require('./src/utils/zohoEventUtilsREST');
fetchEventDetailsREST('4433256000012332047')
  .then(result => console.log('✅ REST API Success!', result.mode))
  .catch(error => console.error('❌ REST API Failed:', error.message));
"
```

### 2. **Backend API Test:**
```bash
curl -X GET "http://localhost:3000/api/events?eventId=4433256000012332047" -H "Accept: application/json"
```

## Impact

- **Custom API**: Tiếp tục hoạt động bình thường với auto-refresh
- **REST API**: Bây giờ cũng có auto-refresh, không còn 401 errors
- **Fallback Mechanism**: Hoạt động hoàn hảo khi Custom API fail
- **Production Stability**: Token management ổn định trên production

## Deployment

1. **Deploy code mới lên Railway**
2. **REST API sẽ tự động sử dụng auto-refresh tokens**
3. **Không còn 401 errors trong production logs**
4. **Fallback mechanism hoạt động reliable**

**REST API token auto-refresh đã được fix hoàn toàn!** 🎉
