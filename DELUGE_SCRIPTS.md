# Zoho Creator Deluge Scripts for Redis Sync

## 📋 Cấu trúc JSON đã phân tích:

### Từ Redis Cache:
```json
{
  "ID": "4433256000014942212",
  "Full_Name": "CAO THỊ HỒNG",
  "Email": "rose.caonguyen@gmail.com",
  "Event_Info": {
    "ID": "4433256000013547003",
    "Event_Name": "HCMC BUSINESS SUMMIT 2025: HỘI TỤ VƯƠN TẦM",
    "Event_ID": "YBAHTVT"
  },
  "Phone_Number": "915540775",
  "Check_In_Status": "Not Yet",
  "Confirm_Status": "true"
}
```

### Từ Zoho Creator API:
```json
{
  "ID": "4433256000014273041",
  "Full_Name": "LÂM TRƯỜNG HUY", 
  "Email": "lhuy7070@gmail.com",
  "Event_Info": {
    "ID": "4433256000014023023",
    "Event_Name": "The Vow's Legacy - Wedding Fair 2025",
    "Event_ID": "YBA_WDS"
  }
}
```

## 🔧 Deluge Scripts

### 1. Script cho Record Update/Delete (Form Action hoặc Record Action)

```deluge
// ========================================
// DELUGE SCRIPT: Redis Sync on Update/Delete
// ========================================
// Đặt trong: Form Action → On Update/On Delete
// Hoặc: Record Action → On Update/On Delete
// 
// ⚠️ LƯU Ý: Không cần sync cho CREATE vì đã được xử lý trực tiếp trong backend!

// Tạo record map với tất cả fields
record_map = Map();
record_map.put("ID", input.ID);
record_map.put("Full_Name", input.Full_Name);
record_map.put("Email", input.Email);
record_map.put("Phone_Number", input.Phone_Number);
record_map.put("Check_In_Status", input.Check_In_Status);
record_map.put("Confirm_Status", input.Confirm_Status);
record_map.put("Salutation", input.Salutation);
record_map.put("Group_Registration", input.Group_Registration);
record_map.put("Group_ID", input.Group_ID);
record_map.put("Group_Members", input.Group_Members);
record_map.put("Custom_Fields_Value", input.Custom_Fields_Value);
record_map.put("Buyer", input.Buyer);
record_map.put("Import", input.Import);
record_map.put("Added_User", input.Added_User);
record_map.put("Added_Time", input.Added_Time);

// Event_Info map
event_info_map = Map();
event_info_map.put("ID", input.Event_Info.ID);
event_info_map.put("Event_Name", input.Event_Info.Event_Name);
event_info_map.put("Event_ID", input.Event_Info.Event_ID);
event_info_map.put("zc_display_value", input.Event_Info.zc_display_value);
record_map.put("Event_Info", event_info_map);

// Ticket_Information map (nếu có)
if(input.Ticket_Information != null && input.Ticket_Information != "")
{
    ticket_info_map = Map();
    ticket_info_map.put("ID", input.Ticket_Information.ID);
    ticket_info_map.put("total_amount", input.Ticket_Information.total_amount);
    ticket_info_map.put("payment_status", input.Ticket_Information.payment_status);
    ticket_info_map.put("zc_display_value", input.Ticket_Information.zc_display_value);
    record_map.put("Ticket_Information", ticket_info_map);
}

// QR Codes (nếu có)
if(input.Redeem_QR != null && input.Redeem_QR != "")
{
    redeem_qr_map = Map();
    redeem_qr_map.put("value", input.Redeem_QR.value);
    redeem_qr_map.put("image", input.Redeem_QR.image);
    record_map.put("Redeem_QR", redeem_qr_map);
    record_map.put("Redeem_ID", input.Redeem_ID);
}

if(input.Badge_QR != null && input.Badge_QR != "")
{
    badge_qr_map = Map();
    badge_qr_map.put("value", input.Badge_QR.value);
    badge_qr_map.put("image", input.Badge_QR.image);
    record_map.put("Badge_QR", badge_qr_map);
}

// Business Match Making (nếu có)
if(input.Business_Match_Making != null && input.Business_Match_Making != "")
{
    record_map.put("Business_Match_Making", input.Business_Match_Making);
}

// Activities (nếu có)
if(input.Activities != null && input.Activities != "")
{
    record_map.put("Activities", input.Activities);
}

// Xác định event type (chỉ UPDATE và DELETE, không có CREATE)
event_type = "record.update";

// Gọi webhook sync
response = invokeurl
[
    url :"https://your-backend-domain.com/api/webhooks/zoho-sync"
    type :POST
    parameters:"event=" + event_type + "&form=All_Registrations&record_id=" + input.ID + "&record=" + record_map.toJSON()
    connection:""
];

// Log response
info "Redis Sync Response: " + response;

// Kiểm tra response
if(response.get("success") == true)
{
    info "✅ Record synced to Redis successfully";
}
else
{
    info "❌ Redis sync failed: " + response.get("message");
}
```

### 2. Script cho Record Delete

```deluge
// ========================================
// DELUGE SCRIPT: Redis Sync on Delete
// ========================================
// Đặt trong: Form Action → On Delete
// Hoặc: Record Action → On Delete

// Gọi webhook sync để xóa record
response = invokeurl
[
    url :"https://your-backend-domain.com/api/webhooks/zoho-sync"
    type :POST
    parameters:"event=record.delete&form=All_Registrations&record_id=" + input.ID + "&record=" + input.toMap().toJSON()
    connection:""
];

// Log response
info "Redis Delete Sync Response: " + response;

// Kiểm tra response
if(response.get("success") == true)
{
    info "✅ Record deleted from Redis successfully";
}
else
{
    info "❌ Redis delete sync failed: " + response.get("message");
}
```

### 3. Script đơn giản hơn (nếu chỉ cần sync cơ bản)

```deluge
// ========================================
// DELUGE SCRIPT: Simple Redis Sync (UPDATE/DELETE only)
// ========================================
// ⚠️ LƯU Ý: Chỉ dùng cho UPDATE/DELETE, CREATE đã được xử lý trực tiếp trong backend!

// Tạo record map cơ bản
record_map = Map();
record_map.put("ID", input.ID);
record_map.put("Full_Name", input.Full_Name);
record_map.put("Email", input.Email);
record_map.put("Phone_Number", input.Phone_Number);
record_map.put("Check_In_Status", input.Check_In_Status);
record_map.put("Event_Info", input.Event_Info);

// Xác định event type (chỉ UPDATE và DELETE)
event_type = "record.update";

// Gọi webhook sync
response = invokeurl
[
    url :"https://your-backend-domain.com/api/webhooks/zoho-sync"
    type :POST
    parameters:"event=" + event_type + "&form=All_Registrations&record_id=" + input.ID + "&record=" + record_map.toJSON()
    connection:""
];

info "Redis Sync: " + response;
```

## 🚀 Cách triển khai:

### 1. Trong Zoho Creator:
1. **Vào Form:** All_Registrations
2. **Settings → Actions**
3. **Add Action:**
   - **Name:** Redis Sync (UPDATE/DELETE)
   - **Type:** Form Action
   - **Trigger:** On Update, On Delete (KHÔNG cần On Add!)
   - **Script:** Copy script tương ứng ở trên

### 2. Thay đổi URL:
- Thay `https://your-backend-domain.com` bằng domain thực tế của backend

### 3. Test:
- **Tạo record:** Từ frontend → Backend → Zoho → Redis (tự động)
- **Update/Delete record:** Từ Zoho Creator → Webhook → Redis
- Kiểm tra logs trong backend
- Kiểm tra Redis cache được update

## 📊 Kết quả:

Sau khi triển khai, mỗi khi:
- ✅ **Tạo record** → Tự động sync vào Redis (trực tiếp từ backend)
- ✅ **Update record** → Tự động sync vào Redis (qua webhook)  
- ✅ **Delete record** → Tự động xóa khỏi Redis (qua webhook)
- ✅ **Widget load nhanh** từ Redis cache
- ✅ **Real-time data** luôn đồng bộ
- ✅ **Ít lòng vòng** - CREATE đi thẳng, UPDATE/DELETE qua webhook
