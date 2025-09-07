#!/usr/bin/env node

/**
 * Manual Token Update Script
 * Manually update tokens.json with new values
 */

const fs = require('fs');
const path = require('path');

function updateToken() {
  try {
    console.log('🔑 Manual Token Update');
    console.log('=====================');
    console.log('');
    console.log('Please provide the new token values:');
    console.log('');
    
    // Get new token from command line or prompt
    const newAccessToken = process.argv[2];
    const newRefreshToken = process.argv[3];
    
    if (!newAccessToken) {
      console.log('Usage: node manual-token.js ACCESS_TOKEN [REFRESH_TOKEN]');
      console.log('');
      console.log('Example:');
      console.log('node manual-token.js 1000.abc123... 1000.def456...');
      return;
    }
    
    // Calculate expiration time (1 hour from now)
    const expiresAt = Date.now() + (60 * 60 * 1000);
    
    const tokens = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken || '1000.64092362fd7d72dc6d515226e3b26870.d51070dcaf39533acba278091be48bc0',
      expiresAt: expiresAt
    };
    
    // Save to file
    const tokenFile = path.join(__dirname, 'tokens.json');
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
    
    console.log('✅ Token updated successfully!');
    console.log('🆕 Access token:', tokens.accessToken.substring(0, 20) + '...');
    console.log('📅 Token expires at:', new Date(tokens.expiresAt).toISOString());
    console.log('⏰ Token valid for:', Math.round((tokens.expiresAt - Date.now()) / 1000 / 60), 'minutes');
    console.log('');
    console.log('🎉 Ready to use! Backend should work now.');
    
  } catch (error) {
    console.error('❌ Token update failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateToken();
}

module.exports = { updateToken };
