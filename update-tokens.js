const fs = require('fs');

// Update tokens.json with new access token
const newTokens = {
  accessToken: "1000.a88b91731d6bc565c3bd58fdb563f302.2dc5cbcd49aa2318e75e75ed0b8e1c3c",
  access_token: "1000.a88b91731d6bc565c3bd58fdb563f302.2dc5cbcd49aa2318e75e75ed0b8e1c3c",
  refreshToken: null, // We'll need to get this from the OAuth flow
  refresh_token: null,
  expiresAt: Date.now() + (3600 * 1000), // 1 hour from now
  expires_at: Date.now() + (3600 * 1000),
  expires_in: 3600,
  token_type: "Bearer",
  scope: "ZohoCreator.form.CREATE ZohoCreator.report.READ ZohoCreator.meta.form.READ",
  api_domain: "https://www.zohoapis.com",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Load existing tokens to preserve refresh token if exists
try {
  if (fs.existsSync('tokens.json')) {
    const existingTokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
    if (existingTokens.refreshToken || existingTokens.refresh_token) {
      newTokens.refreshToken = existingTokens.refreshToken || existingTokens.refresh_token;
      newTokens.refresh_token = existingTokens.refreshToken || existingTokens.refresh_token;
      console.log('✅ Preserved existing refresh token');
    }
  }
} catch (error) {
  console.log('⚠️ Could not load existing tokens:', error.message);
}

// Save updated tokens
fs.writeFileSync('tokens.json', JSON.stringify(newTokens, null, 2));
console.log('✅ Tokens updated successfully!');

console.log('\n📋 NEW TOKENS FOR PRODUCTION:');
console.log('='.repeat(50));
console.log(`ZOHO_ACCESS_TOKEN=${newTokens.accessToken}`);
console.log(`ZOHO_REFRESH_TOKEN=${newTokens.refreshToken || 'NEED_TO_GET_FROM_OAUTH'}`);
console.log(`ZOHO_TOKEN_EXPIRES_AT=${newTokens.expiresAt}`);
console.log('='.repeat(50));

console.log('\n🚀 INSTRUCTIONS FOR RAILWAY:');
console.log('1. Go to Railway dashboard');
console.log('2. Navigate to your project');
console.log('3. Go to Variables tab');
console.log('4. Update these environment variables:');
console.log('   - ZOHO_ACCESS_TOKEN');
console.log('   - ZOHO_REFRESH_TOKEN (if you have it)');
console.log('   - ZOHO_TOKEN_EXPIRES_AT');
console.log('5. Redeploy your application');
