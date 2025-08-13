# 🌐 Translation Support Added to Events API

## 📋 **Overview:**
Đã thêm hỗ trợ translation cho formFields trong Events API để hỗ trợ đa ngôn ngữ (Tiếng Việt - Tiếng Anh).

## 🚀 **Changes Made:**

### **✅ 1. Swagger Documentation Updated (`src/routes/events.js`):**
```javascript
translation:
  type: object
  description: Thông tin dịch thuật cho field
  properties:
    en_sectionname: Tên section tiếng Anh
    en_label: Label tiếng Anh
    en_value: Giá trị tiếng Anh (cho Select/Multi Select)
    en_placeholder: Placeholder tiếng Anh
    en_helptext: Help text tiếng Anh
    en_agreementcontent: Nội dung agreement tiếng Anh
    en_agreementtitle: Tiêu đề agreement tiếng Anh
    en_checkboxlabel: Label checkbox tiếng Anh
    en_linktext: Link text tiếng Anh
```

### **✅ 2. Code Processing Updated (`src/utils/zohoEventUtils.js`):**
```javascript
// Thêm translation object
if (field.translation) {
  processedField.translation = {
    en_sectionname: field.translation.en_sectionname || "",
    en_label: field.translation.en_label || "",
    en_value: field.translation.en_value || "",
    en_placeholder: field.translation.en_placeholder || "",
    en_helptext: field.translation.en_helptext || "",
    en_agreementcontent: field.translation.en_agreementcontent || "",
    en_agreementtitle: field.translation.en_agreementtitle || "",
    en_checkboxlabel: field.translation.en_checkboxlabel || "",
    en_linktext: field.translation.en_linktext || ""
  };
}
```

## 📊 **Translation Structure:**

### **✅ Translation Object Properties:**
```javascript
{
  "translation": {
    "en_sectionname": "Tên section tiếng Anh",
    "en_label": "Label tiếng Anh", 
    "en_value": "Giá trị tiếng Anh",
    "en_placeholder": "Placeholder tiếng Anh",
    "en_helptext": "Help text tiếng Anh",
    "en_agreementcontent": "Nội dung agreement tiếng Anh",
    "en_agreementtitle": "Tiêu đề agreement tiếng Anh",
    "en_checkboxlabel": "Label checkbox tiếng Anh",
    "en_linktext": "Link text tiếng Anh"
  }
}
```

## 🎯 **Usage Examples:**

### **✅ Agreement Field Translation:**
```javascript
{
  "field_id": "aw2025_policy",
  "label": "CHÍNH SÁCH BẢO MẬT EN",
  "type": "Agreement",
  "translation": {
    "en_label": "CHÍNH SÁCH BẢO MẬT",
    "en_agreementcontent": "<div><b>1. Purpose of information collection...</div>",
    "en_checkboxlabel": "I have read and agree to the privacy policy (required)"
  }
}
```

### **✅ Select Field Translation:**
```javascript
{
  "field_id": "aw2025_company_type",
  "label": "Loại hình doanh nghiệp",
  "type": "Select",
  "values": ["Xuất Khẩu Nhập Khẩu", "Sản Xuất", "Phân Phối"],
  "translation": {
    "en_label": "Company Type",
    "en_value": "Import Export,Manufacturing,Distribution,Service,Other"
  }
}
```

## 🔧 **API Response:**

### **✅ Events API now returns:**
```javascript
GET /api/events?eventId=4433256000012332047

Response:
{
  "event": {
    "formFields": [
      {
        "field_id": "aw2025_policy",
        "label": "CHÍNH SÁCH BẢO MẬT EN",
        "type": "Agreement",
        "translation": {
          "en_label": "CHÍNH SÁCH BẢO MẬT",
          "en_agreementcontent": "...",
          "en_checkboxlabel": "..."
        }
      }
    ]
  }
}
```

## 🎉 **Benefits:**

### **✅ Multi-language Support:**
- **Frontend**: Có thể hiển thị form theo ngôn ngữ người dùng
- **Dynamic**: Thay đổi ngôn ngữ real-time
- **Complete**: Tất cả field properties đều có translation

### **✅ Backward Compatibility:**
- **Existing Fields**: Vẫn hoạt động bình thường nếu không có translation
- **Optional**: Translation là optional, không bắt buộc
- **Fallback**: Sử dụng giá trị gốc nếu translation không có

### **✅ Developer Friendly:**
- **Clear Structure**: Translation object rõ ràng, dễ hiểu
- **Comprehensive**: Bao gồm tất cả field properties
- **Documented**: Swagger documentation đầy đủ

## 🚀 **Next Steps:**

### **✅ Frontend Integration:**
1. **Language Detection**: Detect ngôn ngữ người dùng
2. **Dynamic Rendering**: Render form theo ngôn ngữ
3. **Language Toggle**: Cho phép chuyển đổi ngôn ngữ

### **✅ Additional Languages:**
1. **Extensible**: Có thể thêm ngôn ngữ khác (zh, ja, ko, etc.)
2. **Structured**: Translation object có thể mở rộng
3. **Scalable**: Hỗ trợ nhiều ngôn ngữ

**🎉 Translation support successfully added to Events API!** 🌐
