# Railway Auto-Update Configuration

## Tổng quan

Hệ thống đã được cập nhật để **tự động refresh và update Zoho tokens** trong Railway production environment mà không cần can thiệp thủ công.

## Cách hoạt động

### 1. **Local Development**
- ✅ Token được lưu vào `tokens.json`
- ✅ Tự động sync vào `.env` file
- ✅ Environment variables luôn được update

### 2. **Production (Railway)**
- ✅ Token được update trong `process.env` ngay lập tức
- ✅ Tự động gọi Railway API để update environment variables
- ✅ Fallback: Log token ra console nếu Railway API không khả dụng

## Setup Railway Auto-Update

### Bước 1: Lấy Railway Credentials

1. **Railway Project ID**:
   - Vào Railway dashboard
   - Chọn project
   - Copy Project ID từ URL hoặc settings

2. **Railway API Token**:
   - Vào Railway settings > API
   - Tạo API token mới
   - Copy token

### Bước 2: Chạy Setup Script

```bash
node setup-railway-auto-update.js
```

Script sẽ:
- Hỏi Railway Project ID và API Token
- Thêm vào `.env` file
- Test Railway API connection
- Hướng dẫn setup production

### Bước 3: Deploy to Railway

Thêm environment variables vào Railway dashboard:
```
RAILWAY_PROJECT_ID=your-project-id
RAILWAY_TOKEN=your-api-token
```

## Kết quả

### ✅ **Fully Automated**
- Token refresh mỗi 5 phút
- Tự động update Railway environment variables
- Không cần can thiệp thủ công

### ✅ **Fallback Protection**
- Nếu Railway API fail → update memory + log console
- Nếu Railway API not configured → update memory + log console
- Hệ thống vẫn hoạt động bình thường

### ✅ **Zero Downtime**
- Token được update trong memory ngay lập tức
- Không cần restart ứng dụng
- API calls tiếp tục hoạt động với token mới

## Monitoring

### Log Messages

**Success:**
```
✅ Environment variables updated in memory
✅ Railway environment variables updated via API
```

**Fallback:**
```
⚠️ Railway API not configured - tokens updated in memory only
🔄 FALLBACK - NEW TOKENS FOR MANUAL UPDATE:
```

**Error:**
```
⚠️ Failed to update Railway environment variables: [error details]
```

## Troubleshooting

### 1. Railway API không hoạt động
- Kiểm tra `RAILWAY_PROJECT_ID` và `RAILWAY_TOKEN`
- Đảm bảo API token có quyền update environment variables
- Token vẫn được update trong memory, hệ thống vẫn hoạt động

### 2. Token không được refresh
- Kiểm tra auto-refresh timer (mỗi 5 phút)
- Kiểm tra Zoho refresh token còn valid
- Xem logs để debug

### 3. Environment variables không sync
- Local: Kiểm tra `.env` file permissions
- Production: Kiểm tra Railway API credentials

## Benefits

🎯 **Zero Manual Intervention**: Không cần copy/paste token nữa
🚀 **High Availability**: Token luôn fresh, không bị expire
🔒 **Secure**: Token được update tự động qua API
📊 **Reliable**: Fallback mechanisms đảm bảo hệ thống luôn hoạt động
