const zohoOAuthService = require('../utils/zohoOAuthService');

/**
 * Middleware to handle automatic token refresh on 401 errors
 * This middleware should be used in routes that make Zoho API calls
 */
const zohoAuthMiddleware = async (req, res, next) => {
  // Add a flag to track if we've already attempted a token refresh for this request
  req.zohoTokenRefreshed = false;
  
  // Store original send method
  const originalSend = res.send;
  
  // Override send method to catch 401 responses
  res.send = function(data) {
    // Check if response indicates 401 and we haven't already tried refreshing
    if (res.statusCode === 401 && !req.zohoTokenRefreshed) {
      req.zohoTokenRefreshed = true;
      
      // Try to refresh token
      zohoOAuthService.refreshAccessToken()
        .then(() => {
          console.log('🔄 Token auto-refreshed after 401, retrying request...');
          // Token refreshed, but we can't retry the request here
          // The client will need to retry
          originalSend.call(this, {
            success: false,
            error: 'TOKEN_REFRESHED',
            message: 'Token was refreshed automatically. Please retry your request.',
            retry: true
          });
        })
        .catch((error) => {
          console.error('❌ Auto token refresh failed:', error.message);
          originalSend.call(this, {
            success: false,
            error: 'AUTH_FAILED',
            message: 'Authentication failed and token refresh unsuccessful',
            retry: false
          });
        });
    } else {
      // Normal response, send as usual
      originalSend.call(this, data);
    }
  };
  
  next();
};

module.exports = zohoAuthMiddleware;
