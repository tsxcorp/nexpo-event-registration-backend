# 📊 EventInfo APIs Analysis Report

## 🔍 Tổng quan các APIs liên quan đến EventInfo

### ✅ APIs hoạt động tốt (7/12)

#### 1. **Custom API - Single Event** (`/api/events?eventId=4433256000014023023`)
- **File**: `src/routes/events.js` → `src/utils/zohoEventUtils.js`
- **Method**: Custom API với Public Key authentication
- **Performance**: 2525ms
- **Data**: 
  - ✅ Event data: Có
  - ✅ Form Fields: 4 fields
  - ✅ Field Status: **CÓ** - tất cả 4 fields có status="active"
  - ❌ Registrations: Không có

#### 2. **Custom API - All Events** (`/api/events?eventId=NEXPO`)
- **File**: `src/routes/events.js` → `src/utils/zohoEventUtils.js`
- **Method**: Custom API với Public Key authentication
- **Performance**: 358ms
- **Data**:
  - ✅ Events array: Có
  - ❌ Form Fields: Không có (list mode chỉ trả về summary)
  - ❌ Field Status: Không có

#### 3. **REST API - Single Event** (`/api/events-rest?eventId=4433256000014023023`)
- **File**: `src/routes/eventsREST.js` → `src/utils/zohoEventUtilsREST.js`
- **Method**: REST API v2.1 với OAuth authentication
- **Performance**: 1751ms
- **Data**:
  - ✅ Event data: Có
  - ✅ Form Fields: 5 fields (nhiều hơn Custom API!)
  - ✅ Field Status: **CÓ** - 5 fields với status khác nhau
  - ❌ Registrations: Không có

#### 4. **REST API - All Events** (`/api/events-rest?eventId=NEXPO`)
- **File**: `src/routes/eventsREST.js` → `src/utils/zohoEventUtilsREST.js`
- **Method**: REST API v2.1 với OAuth authentication
- **Performance**: 628ms
- **Data**:
  - ✅ Events array: Có
  - ❌ Form Fields: Không có (list mode chỉ trả về summary)
  - ❌ Field Status: Không có

#### 5. **Cache API - Event Registrations** (`/api/cache/events/4433256000014023023`)
- **File**: `src/routes/cache.js`
- **Method**: Redis cache lookup
- **Performance**: 565ms
- **Data**:
  - ❌ Event data: Không có
  - ❌ Form Fields: Không có
  - ✅ Registrations: 531 records

#### 6. **Cache API - Per Record Schema** (`/api/cache/events/4433256000014023023/per-record`)
- **File**: `src/routes/cache.js`
- **Method**: Redis cache với per-record schema
- **Performance**: 1044ms
- **Data**:
  - ❌ Event data: Không có
  - ❌ Form Fields: Không có
  - ✅ Registrations: 531 records

#### 7. **Zoho CRUD - All Registrations** (`/api/zoho-crud/read?report_name=All_Registrations&event_id=4433256000014023023`)
- **File**: `src/routes/zohoCrud.js`
- **Method**: Zoho Creator API hoặc Redis cache
- **Performance**: 453ms
- **Data**:
  - ❌ Event data: Không có
  - ❌ Form Fields: Không có
  - ✅ Registrations: 100 records (limited)

### ❌ APIs có vấn đề (5/12)

#### 8. **Cache API - Event Stats** (`/api/cache/events/4433256000014023023/stats`)
- **Error**: 500 - Failed to get event statistics
- **Vấn đề**: Logic tính toán stats có lỗi

#### 9. **Event Filtering - Event Registrations** (`/api/event-filtering/registrations/4433256000014023023`)
- **Error**: Timeout 10000ms
- **Vấn đề**: Query quá chậm hoặc có lỗi logic

#### 10. **Event Filtering - Events List** (`/api/event-filtering/events/list`)
- **Error**: Timeout 10000ms
- **Vấn đề**: Fetch tất cả registrations quá chậm

#### 11. **Group Visitors - Event Specific** (`/api/group-visitors/event/4433256000014023023`)
- **Error**: 404 - Not found
- **Vấn đề**: Route không tồn tại hoặc logic routing sai

#### 12. **Import Status - Event Specific** (`/api/imports/import-status/4433256000014023023`)
- **Error**: 400 - Missing sessionId parameter
- **Vấn đề**: API design sai, cần sessionId nhưng không được cung cấp

## 🔍 Phân tích Field Status Handling

### ✅ Custom API (zohoEventUtils.js)
```javascript
// Đã được sửa để include field status
status: field.status || field.active || field.status_field || field.field_status || "active"
```
- **Field Count**: 4 fields
- **Status Values**: Tất cả "active"
- **Field IDs**: bride_name, wed_date, date, event_favorite

### ✅ REST API (zohoEventUtilsREST.js)
```javascript
// Đã có sẵn từ trước
status: field.Status || field.Active || field.Status_Field || field.Field_Status || "active"
```
- **Field Count**: 5 fields (nhiều hơn Custom API!)
- **Status Values**: Active/Inactive mixed
- **Field IDs**: auto_field_0, auto_field_1, auto_field_2, auto_field_3, auto_field_4

## 🚨 Phát hiện quan trọng

### 1. **REST API trả về nhiều fields hơn Custom API**
- Custom API: 4 fields
- REST API: 5 fields
- **Nguyên nhân**: REST API fetch từ All_Custom_Fields report, có thể có thêm fields không được Custom API trả về

### 2. **Field IDs khác nhau**
- Custom API: Sử dụng field_id thật (bride_name, wed_date, etc.)
- REST API: Sử dụng auto_field_X (có thể do missing Field_ID)

### 3. **Status values khác nhau**
- Custom API: Tất cả "active"
- REST API: Mixed "Active"/"Inactive"

### 4. **Performance khác nhau**
- Custom API: 2525ms (chậm hơn)
- REST API: 1751ms (nhanh hơn)

## 🎯 Khuyến nghị

### 1. **Sửa REST API field_id mapping**
REST API cần map đúng field_id thay vì dùng auto_field_X

### 2. **Investigate Custom API missing fields**
Tìm hiểu tại sao Custom API thiếu 1 field so với REST API

### 3. **Standardize status values**
Chuẩn hóa status values giữa 2 APIs

### 4. **Fix failed APIs**
Sửa 5 APIs bị lỗi để có complete API coverage

## 📋 Kết luận

**Cả 2 APIs chính (Custom và REST) đều đã xử lý field status đúng cách**, nhưng có sự khác biệt về:
- Số lượng fields
- Field IDs
- Status values
- Performance

**Production hiện tại có thể đang dùng Custom API** vì nó đã hoạt động ổn định với field status được xử lý đúng.
