# Business Matching API Documentation

## Overview
The Business Matching API allows visitors to request meetings with exhibitors during events. This module integrates with Zoho Creator to manage business matching requests.

## Base URL
```
https://nexpo-event-registration-backend-production.up.railway.app/api/business-matching
```

## Endpoints

### 1. Submit Business Matching Request
**POST** `/api/business-matching/submit`

Submit a business matching request between a visitor and an exhibitor.

#### Request Body
```json
{
  "event_id": "4433256000013114003",
  "registration_id": "4433256000013160039",
  "exhibitor_company": "TSX Corp",
  "date": "2025-08-15",
  "time": "14:30",
  "message": "Looking forward to discussing potential partnership opportunities."
}
```

#### Request Fields
- `event_id` (string, required): Event ID from Zoho
- `registration_id` (string, required): Visitor/Registration ID from Zoho
- `exhibitor_company` (string, required): Exhibitor company ID or name
- `date` (string, required): Meeting date in YYYY-MM-DD format (must be in the future)
- `time` (string, required): Meeting time in HH:MM format (24-hour format)
- `message` (string, optional): Meeting message or note

#### Success Response (200)
```json
{
  "success": true,
  "message": "Business matching request submitted successfully",
  "data": {
    "code": 3000,
    "result": "success"
  },
  "matching_id": "MTG-1642742400-abc123",
  "submitted_data": {
    "event_id": "4433256000013114003",
    "registration_id": "4433256000013160039",
    "exhibitor_company": "TSX Corp",
    "meeting_date": "2025-08-15",
    "meeting_time": "14:30",
    "message": "Looking forward to discussing potential partnership opportunities."
  }
}
```

#### Error Response (400)
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    "Event ID is required",
    "Date must be in YYYY-MM-DD format"
  ]
}
```

#### Error Response (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Failed to submit business matching request"
}
```

### 2. Validate Business Matching Data
**POST** `/api/business-matching/validate`

Validate business matching data without submitting to Zoho.

#### Request Body
Same as submit endpoint.

#### Success Response (200)
```json
{
  "valid": true,
  "errors": [],
  "formatted_data": {
    "event_info": {
      "event_id": "4433256000013114003"
    },
    "registration_info": {
      "registration_id": "4433256000013160039"
    },
    "exhibitor_company": "TSX Corp",
    "date": "2025-08-15",
    "time": "14:30",
    "message": "Looking forward to the meeting."
  }
}
```

#### Validation Error Response (200)
```json
{
  "valid": false,
  "errors": [
    "Event ID is required",
    "Date must be in YYYY-MM-DD format",
    "Meeting date cannot be in the past"
  ],
  "formatted_data": null
}
```

### 3. Test API Connection
**GET** `/api/business-matching/test`

Test the connection to business matching service.

#### Success Response (200)
```json
{
  "service": "Business Matching API",
  "status": "active",
  "timestamp": "2025-07-21T07:36:33.212Z",
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/business-matching/submit",
      "description": "Submit business matching request"
    },
    {
      "method": "POST",
      "path": "/api/business-matching/validate",
      "description": "Validate business matching data"
    },
    {
      "method": "GET",
      "path": "/api/business-matching/test",
      "description": "Test API connection"
    }
  ]
}
```

## Validation Rules

### Required Fields
- `event_id`: Must be provided
- `registration_id`: Must be provided  
- `exhibitor_company`: Must be provided
- `date`: Must be provided and in YYYY-MM-DD format
- `time`: Must be provided and in HH:MM format

### Date/Time Validation
- Date must be in the future (not today or past dates)
- Date format: YYYY-MM-DD (e.g., "2025-08-15")
- Time format: HH:MM in 24-hour format (e.g., "14:30", "09:00", "23:45")

### Field Formats
- Event ID and Registration ID are converted to strings
- Time must be valid 24-hour format (00:00 to 23:59)
- Message field is optional and can be empty string

## Integration with Frontend

### Frontend Data Structure
The frontend should send data in this format:
```javascript
{
  event_info: {
    event_id: "1234567890001" 
  },
  registration_info: {
    registration_id: "1234567890002"
  },
  exhibitor_company: "1234567890003",
  date: "2025-10-10",
  time: "14:30",
  message: "Looking forward to the meeting."
}
```

The backend will automatically format this to the required structure.

### Usage Example (JavaScript/Fetch)
```javascript
// Submit business matching request
const submitBusinessMatching = async (data) => {
  try {
    const response = await fetch('/api/business-matching/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Business matching submitted:', result.matching_id);
      return result;
    } else {
      console.error('Validation errors:', result.errors);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error submitting business matching:', error);
    throw error;
  }
};

// Validate before submit
const validateBusinessMatching = async (data) => {
  try {
    const response = await fetch('/api/business-matching/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error validating business matching:', error);
    throw error;
  }
};
```

## Error Handling

### Common Error Scenarios
1. **Invalid Date Format**: Date not in YYYY-MM-DD format
2. **Invalid Time Format**: Time not in HH:MM format  
3. **Past Date**: Meeting date is in the past
4. **Missing Required Fields**: Event ID, Registration ID, or Exhibitor Company missing
5. **Network Error**: Could not reach Zoho API
6. **Invalid Public Key**: Zoho API authentication failed

### Error Response Structure
All error responses follow this structure:
```json
{
  "success": false,
  "message": "Error type description",
  "errors": ["Detailed error messages array"],
  "error": "Single error message for 500 errors"
}
```

## Swagger Documentation

Full API documentation is available at:
```
http://localhost:3000/docs
```

Search for "Business Matching" in the Swagger UI to see all endpoints with interactive testing capabilities.

## Production Configuration

### Environment Variables
The backend uses these Zoho API configurations:
- **ZOHO_ORG_NAME**: Organization name (default: `tsxcorp`)
- **ZOHO_BASE_URL**: Base URL (default: `https://www.zohoapis.com`)
- **ZOHO_BUSINESS_MATCHING_PUBLIC_KEY**: Public key for business matching API
- **ZOHO_CHECKIN_PUBLIC_KEY**: Fallback public key from check-in API
- **ZOHO_VISITOR_PUBLIC_KEY**: Fallback public key from visitor API

### Development Mode
Currently running in development mode with mock responses for testing:
- Returns success response without calling Zoho API
- Allows frontend development and testing
- To disable: Set `isDevelopment = false` in `src/utils/zohoBusinessMatching.js`

### Deployment
The API is deployed on Railway at:
```
https://nexpo-event-registration-backend-production.up.railway.app
```

**Note**: Before going to production, ensure the Zoho Business Matching API is properly configured and set `isDevelopment = false`.

## Testing

### Manual Testing with curl
```bash
# Test connection
curl http://localhost:3000/api/business-matching/test

# Validate data
curl -X POST http://localhost:3000/api/business-matching/validate \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "4433256000013114003",
    "registration_id": "4433256000013160039", 
    "exhibitor_company": "TSX Corp",
    "date": "2025-08-15",
    "time": "14:30",
    "message": "Test message"
  }'

# Submit business matching
curl -X POST http://localhost:3000/api/business-matching/submit \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "4433256000013114003",
    "registration_id": "4433256000013160039",
    "exhibitor_company": "TSX Corp", 
    "date": "2025-08-15",
    "time": "14:30",
    "message": "Looking forward to our meeting"
  }'
```

### Expected Behavior
1. **Validation**: Should return validation results without submitting to Zoho
2. **Submit**: Should validate data first, then submit to Zoho API
3. **Error Handling**: Should return appropriate error messages for invalid data
4. **Response Format**: Should include matching_id for tracking purposes 