const express = require('express');
const router = express.Router();
const { fetchVisitorDetails, submitCheckin } = require('../utils/zohoVisitorUtils');
const socketService = require('../services/socketService');
const redisPopulationService = require('../services/redisPopulationService');
const axios = require('axios');

/**
 * @swagger
 * /api/visitors:
 *   get:
 *     summary: Lấy thông tin chi tiết visitor từ Zoho Creator
 *     description: API trả về thông tin đầy đủ của visitor đã đăng ký sự kiện
 *     parameters:
 *       - in: query
 *         name: visid
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của visitor trong Zoho Creator
 *         example: "4433256000012345678"
 *     responses:
 *       200:
 *         description: Dữ liệu visitor thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 visitor:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID của visitor
 *                       example: "4433256000012345678"
 *                     salutation:
 *                       type: string
 *                       description: Danh xưng (Mr., Ms., Dr., etc.)
 *                       example: "Mr."
 *                     name:
 *                       type: string
 *                       description: Tên đầy đủ của visitor
 *                       example: "Nguyen Van A"
 *                     email:
 *                       type: string
 *                       description: Email của visitor
 *                       example: "nguyenvana@example.com"
 *                     phone:
 *                       type: string
 *                       description: Số điện thoại
 *                       example: "0901234567"
 *                     company:
 *                       type: string
 *                       description: Tên công ty
 *                       example: "ABC Corporation"
 *                     job_title:
 *                       type: string
 *                       description: Chức vụ
 *                       example: "Manager"
 *                     registration_date:
 *                       type: string
 *                       description: Ngày đăng ký
 *                       example: "2025-01-15 10:30:00.0"
 *                     status:
 *                       type: string
 *                       description: Trạng thái đăng ký
 *                       example: "confirmed"
 *                     event_id:
 *                       type: string
 *                       description: ID sự kiện đã đăng ký
 *                       example: "4433256000012332047"
 *                     event_name:
 *                       type: string
 *                       description: Tên sự kiện
 *                       example: "Automation World VietNam"
 *                     group_id:
 *                       type: string
 *                       description: ID nhóm đăng ký (nếu có)
 *                       example: "GRP-1750414070451"
 *                     group_redeem_id:
 *                       type: string
 *                       description: ID redeem của nhóm
 *                     badge_qr:
 *                       type: string
 *                       description: QR code của badge
 *                     redeem_qr:
 *                       type: string
 *                       description: QR code để redeem
 *                     redeem_id:
 *                       type: string
 *                       description: ID redeem
 *                     encrypt_key:
 *                       type: string
 *                       description: Key mã hóa
 *                     head_mark:
 *                       type: boolean
 *                       description: Đánh dấu head
 *                     check_in_history:
 *                       type: array
 *                       description: Lịch sử check-in
 *                       items:
 *                         type: object
 *                         properties:
 *                           event_name:
 *                             type: string
 *                             description: Tên sự kiện đã check-in
 *                             example: "VIET NAM INTERNATIONAL LOGISTICS EXHIBITION 2025"
 *                           qr_scan:
 *                             type: string
 *                             description: QR code đã scan
 *                             example: "VILOG2510000930"
 *                           valid_check:
 *                             type: boolean
 *                             description: Check-in có hợp lệ không
 *                             example: true
 *                           event_id:
 *                             type: string
 *                             description: ID sự kiện đã check-in
 *                             example: "4433256000012557772"
 *                           group_registration_id:
 *                             type: string
 *                             description: ID đăng ký nhóm (nếu có)
 *                             example: ""
 *                           checkintime:
 *                             type: string
 *                             description: Thời gian check-in
 *                             example: "2025-07-22 20:28:36.0"
 *                     matching_list:
 *                       type: array
 *                       description: Danh sách business matching
 *                       items:
 *                         type: object
 *                         properties:
 *                           exhibitor_profile_id:
 *                             type: integer
 *                             description: ID của exhibitor
 *                             example: 4433256000012938592
 *                           time:
 *                             type: string
 *                             description: Thời gian hẹn
 *                             example: "10:00:00"
 *                           confirmed:
 *                             type: boolean
 *                             description: Trạng thái xác nhận
 *                             example: false
 *                           date:
 *                             type: string
 *                             description: Ngày hẹn
 *                             example: "2025-08-01"
 *                           message:
 *                             type: string
 *                             description: Ghi chú
 *                             example: "test"
 *                     custom_fields:
 *                       type: object
 *                       description: Các trường custom đã điền (parsed object)
 *                       example: {"vilog2025_confdatetime": "Thứ Bảy ngày 02/08", "vilog2025_jobtitle": "Chuyển phát nhanh", "Introduce Expo": "true"}
 *                     formFields:
 *                       type: array
 *                       description: Danh sách các field trong form (nếu có)
 *                       items:
 *                         type: object
 *                         properties:
 *                           field_id:
 *                             type: string
 *                             description: ID duy nhất của field
 *                           sort:
 *                             type: integer
 *                             description: Thứ tự hiển thị field
 *                           label:
 *                             type: string
 *                             description: Nhãn hiển thị của field
 *                           type:
 *                             type: string
 *                             description: Loại field
 *                           required:
 *                             type: boolean
 *                             description: Field có bắt buộc không
 *                           values:
 *                             type: array
 *                             description: Danh sách options (nếu có)
 *                             items:
 *                               type: string
 *       400:
 *         description: Thiếu visid parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing visid"
 *       500:
 *         description: Lỗi khi lấy dữ liệu từ Zoho
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch visitor data"
 *                 details:
 *                   type: string
 *                   description: Chi tiết lỗi
 */

// 🚀 Fetch group visitors from custom Zoho API
const fetchGroupVisitors = async (groupId) => {
  const apiUrl = 'https://www.zohoapis.com/creator/custom/tsxcorp/getGroupVisitors';
  const publicKey = 'yNCkueSrUthmff4ZKzKUAwjJu';
  
  try {
    console.log("🔍 Fetching group visitors from:", apiUrl);
    console.log("📋 Parameters:", {
      visid: groupId,
      publickey: publicKey ? "***" + publicKey.slice(-4) : "NOT_SET"
    });

    const response = await axios.get(apiUrl, {
      headers: { Accept: 'application/json' },
      params: {
        visid: groupId,
        publickey: publicKey
      },
      timeout: 30000,
      responseType: 'text' // 🛑 tránh mất số khi parse
    });

    console.log("📤 Raw Zoho response:", response.data);

    const data = JSON.parse(response.data, (key, value) => {
      if (key === 'id' && typeof value === 'number') {
        return value.toString();
      }
      return value;
    });

    console.log("📊 Parsed Zoho data:", JSON.stringify(data, null, 2));

    // Check if API returned error
    if (data?.code && data.code !== 3000) {
      console.error("❌ Zoho API returned error code:", data?.code);
      throw new Error(`Zoho API error: ${data?.message || 'Unknown error'} (Code: ${data?.code})`);
    }

    // Return array of visitors
    let visitors = [];
    if (Array.isArray(data)) {
      visitors = data;
    } else if (data?.result && Array.isArray(data.result)) {
      visitors = data.result;
    } else if (data?.result && !Array.isArray(data.result)) {
      // If result is not an array, try to parse it
      try {
        visitors = JSON.parse(data.result);
      } catch (e) {
        visitors = [data.result];
      }
    }
    
    console.log("✅ Group visitors fetched successfully:", visitors.length, "visitors");
    console.log("📋 First visitor sample:", JSON.stringify(visitors[0], null, 2));
    return visitors;

  } catch (err) {
    console.error("❌ Error in fetchGroupVisitors:", err.message);
    console.error("❌ Error stack:", err.stack);
    throw err;
  }
};

router.get('/', async (req, res) => {
  const visitorId = req.query.visid;
  if (!visitorId) return res.status(400).json({ error: 'Missing visid' });

  try {
    // 🔍 Check if visitorId contains "GRP" - if so, fetch group visitors
    console.log("🔍 Checking visitorId:", visitorId, "contains GRP:", visitorId.includes('GRP'));
    
    if (visitorId.includes('GRP')) {
      console.log("🔍 Detected group ID, fetching group visitors:", visitorId);
      
      try {
        const groupVisitors = await fetchGroupVisitors(visitorId);
        
        // Transform group visitors to match single visitor format
        const visitors = groupVisitors.map(visitorData => {
          // Parse custom_fields_value if it's a JSON string
          let customFields = {};
          try {
            if (typeof visitorData.custom_fields_value === 'string') {
              customFields = JSON.parse(visitorData.custom_fields_value);
            } else if (visitorData.custom_fields_value && typeof visitorData.custom_fields_value === 'object') {
              customFields = visitorData.custom_fields_value;
            }
          } catch (parseError) {
            console.warn("⚠️ Failed to parse custom_fields_value:", parseError.message);
            customFields = visitorData.custom_fields_value || {};
          }

          return {
            visitor: {
              id: String(visitorData.id),
              salutation: visitorData.salutation || "",
              name: visitorData.full_name || visitorData.name || "",
              email: visitorData.email || "",
              phone: visitorData.phone_number || visitorData.phone || "",
              company: visitorData.company || "",
              job_title: visitorData.job_title || "",
              registration_date: visitorData.registration_date || "",
              status: visitorData.status || "",
              event_id: visitorData.event_id || "",
              event_name: visitorData.event_name || "",
              group_id: visitorData.group_id || "",
              group_redeem_id: visitorData.group_redeem_id || "",
              badge_qr: visitorData.badge_qr || "",
              redeem_qr: visitorData.redeem_qr || "",
              redeem_id: visitorData.redeem_id || "",
              encrypt_key: visitorData.encrypt_key || "",
              head_mark: visitorData.head_mark || false,
              check_in_history: visitorData.check_in_history || [],
              matching_list: visitorData.matching_list || [],
              custom_fields: customFields,
              formFields: []
            }
          };
        });
        
        console.log("✅ Group visitors data fetched successfully for ID:", visitorId);
        res.status(200).json({ visitors, count: visitors.length });
        
      } catch (groupError) {
        console.error("❌ Error fetching group visitors:", groupError.message);
        console.error("❌ Group error stack:", groupError.stack);
        res.status(500).json({ error: 'Failed to fetch group visitors', details: groupError.message });
      }
      
    } else {
      // 🔍 Regular visitor ID - fetch single visitor
      const result = await fetchVisitorDetails(visitorId);
      console.log("✅ Visitor data fetched successfully for ID:", visitorId);
      res.status(200).json(result);
    }
    
  } catch (err) {
    console.error("❌ Error fetching visitor data:", err.message);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({ error: 'Failed to fetch visitor data', details: err.message });
  }
});

/**
 * @swagger
 * /api/visitors/checkin:
 *   post:
 *     summary: Submit check-in data for a visitor
 *     description: Submit visitor check-in information to Zoho Creator
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               visitor:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: ID của visitor
 *                     example: "4433256000013160039"
 *                   name:
 *                     type: string
 *                     description: Tên đầy đủ của visitor
 *                     example: "NGUYỄN THÁI PHI"
 *                   email:
 *                     type: string
 *                     description: Email của visitor
 *                     example: "ceo@ozcorp.vn"
 *                   phone:
 *                     type: string
 *                     description: Số điện thoại
 *                     example: "+840901234567"
 *                   company:
 *                     type: string
 *                     description: Tên công ty
 *                     example: "ABC Corporation"
 *                   job_title:
 *                     type: string
 *                     description: Chức vụ
 *                     example: "CEO"
 *                   registration_date:
 *                     type: string
 *                     description: Ngày đăng ký
 *                   status:
 *                     type: string
 *                     description: Trạng thái đăng ký
 *                   event_id:
 *                     type: string
 *                     description: ID sự kiện
 *                     example: "4433256000013114003"
 *                   event_name:
 *                     type: string
 *                     description: Tên sự kiện
 *                     example: "CHUỖI SỰ KIỆN THÁNG 07"
 *                   group_id:
 *                     type: string
 *                     description: ID nhóm đăng ký
 *                     example: "GRP-1752671254685"
 *                   group_redeem_id:
 *                     type: string
 *                     description: ID redeem của nhóm
 *                   badge_qr:
 *                     type: string
 *                     description: QR code của badge
 *                     example: "NDQzMzI1NjAwMDAxMzE2MDAzOQ=="
 *                   redeem_qr:
 *                     type: string
 *                     description: QR code để redeem
 *                     example: "CNG10001131"
 *                   redeem_id:
 *                     type: string
 *                     description: ID redeem
 *                     example: "CNG10001131"
 *                   encrypt_key:
 *                     type: string
 *                     description: Key mã hóa
 *                     example: "NDQzMzI1NjAwMDAxMzE2MDAzOQ=="
 *                   head_mark:
 *                     type: boolean
 *                     description: Đánh dấu head
 *                     example: false
 *                   check_in_history:
 *                     type: array
 *                     description: Lịch sử check-in
 *                     items:
 *                       type: object
 *                   custom_fields:
 *                     type: string
 *                     description: Các trường custom (JSON string)
 *                     example: "{\"Bạn sẽ tham dự chương trình\":\"\",\"Tên Công Ty\":\"CÔNG TY XD KIẾN TRÚC ÂN GIA\"}"
 *                   formFields:
 *                     type: array
 *                     description: Danh sách các field trong form
 *                     items:
 *                       type: object
 *     responses:
 *       200:
 *         description: Check-in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Check-in submitted successfully"
 *                 data:
 *                   type: object
 *                   description: Response data từ Zoho
 *       400:
 *         description: Thiếu dữ liệu visitor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing visitor data"
 *       500:
 *         description: Lỗi khi submit check-in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to submit check-in"
 *                 details:
 *                   type: string
 *                   description: Chi tiết lỗi
 */

router.post('/checkin', async (req, res) => {
  const { visitor } = req.body;
  
  if (!visitor) {
    return res.status(400).json({ error: 'Missing visitor data' });
  }

  try {
    console.log("🔄 Starting check-in process for visitor:", visitor.id);
    const startTime = Date.now();
    
    const result = await submitCheckin({ visitor });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log("✅ Check-in completed in", duration, "ms for visitor:", visitor.id, result);
    
    // Handle error response (configuration or Zoho API issues)
    if (!result.success) {
      console.error("❌ Check-in failed:", result.error);
      console.error("❌ Details:", result.details);
      
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
    
    // Handle warning response (Zoho Custom Function failed but process continued)
    if (result.warning) {
      console.warn("⚠️ Check-in warning:", result.message);
      console.warn("⚠️ Details:", result.details);
      
      // Return 200 with warning info instead of error
      return res.status(200).json({
        success: true,
        warning: true,
        message: result.message,
        details: result.details,
        error: result.error
      });
    }
    
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error submitting check-in:", err.message);
    res.status(500).json({ error: 'Failed to submit check-in', details: err.message });
  }
});

module.exports = router; 