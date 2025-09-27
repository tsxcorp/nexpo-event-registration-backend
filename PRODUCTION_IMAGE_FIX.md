# Production Image Loading Fix

## Vấn đề

Frontend production không load được ảnh vì backend URL được hardcode là `localhost:3000` thay vì sử dụng production URL.

### Lỗi gặp phải:
```
Mixed Content: The page at 'https://registration.nexpo.vn/register/4433256000012332047' 
was loaded over HTTPS, but requested an insecure element 
'http://localhost:3000/api/proxy-image?...'
```

## Giải pháp

### 1. **Fixed Backend URL Configuration**

**File:** `src/utils/zohoEventUtilsREST.js`

**Trước:**
```javascript
const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:3000';
```

**Sau:**
```javascript
const baseUrl = process.env.BACKEND_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
```

### 2. **Environment Variables Priority**

1. **`BACKEND_BASE_URL`** - Custom backend URL (highest priority)
2. **`RAILWAY_PUBLIC_DOMAIN`** - Railway auto-detected domain
3. **`http://localhost:3000`** - Local development fallback

### 3. **Railway Environment Variables**

Railway tự động cung cấp `RAILWAY_PUBLIC_DOMAIN` environment variable:
```
RAILWAY_PUBLIC_DOMAIN=https://nexpo-event-registration-backend-production.up.railway.app
```

## Kết quả

### ✅ **Local Development:**
```
Generated image URL: http://localhost:3000/api/proxy-image?recordId=4433256000012332047&fieldName=Logo&filename=test.png
```

### ✅ **Production (Railway):**
```
Generated image URL: https://nexpo-event-registration-backend-production.up.railway.app/api/proxy-image?recordId=4433256000012332047&fieldName=Logo&filename=test.png
```

## Testing

### 1. **Local Test:**
```bash
curl -I "http://localhost:3000/api/proxy-image?recordId=4433256000012332047&fieldName=Logo&filename=1749629304227605_Artwork_2.png"
# Expected: HTTP/1.1 200 OK
```

### 2. **Production Test:**
```bash
curl -I "https://nexpo-event-registration-backend-production.up.railway.app/api/proxy-image?recordId=4433256000012332047&fieldName=Logo&filename=1749629304227605_Artwork_2.png"
# Expected: HTTP/1.1 200 OK
```

## Benefits

🎯 **Auto-Detection**: Railway tự động detect domain
🚀 **Zero Config**: Không cần setup thêm environment variables
🔒 **HTTPS Ready**: Production URLs sử dụng HTTPS
📱 **Cross-Origin**: CORS đã được config cho production domain

## Deployment

1. **Deploy code mới lên Railway**
2. **Railway tự động set `RAILWAY_PUBLIC_DOMAIN`**
3. **Images sẽ load từ production backend URL**
4. **No additional configuration needed!**

## Verification

Sau khi deploy, check browser console:
- ✅ Không còn Mixed Content warnings
- ✅ Images load thành công từ HTTPS URLs
- ✅ Service Worker không báo lỗi fetch static assets
