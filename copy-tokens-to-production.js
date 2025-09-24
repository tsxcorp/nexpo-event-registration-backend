require('dotenv').config();
const fs = require('fs');

async function copyTokensToProduction() {
  try {
    console.log('📋 Copying tokens to production...');
    
    // Read local tokens
    const tokens = require('./tokens.json');
    console.log('✅ Local tokens loaded');
    
    // Copy to production path (Railway uses /app as root)
    const productionPath = '/app/tokens.json';
    
    // For local testing, just copy to current directory with production name
    const localProductionPath = './tokens-production.json';
    
    fs.writeFileSync(localProductionPath, JSON.stringify(tokens, null, 2));
    console.log('✅ Tokens copied to production format');
    
    console.log('📊 Token info:');
    console.log(`  Access Token: ${tokens.accessToken ? '✅ Present' : '❌ Missing'}`);
    console.log(`  Refresh Token: ${tokens.refreshToken ? '✅ Present' : '❌ Missing'}`);
    console.log(`  Expires At: ${tokens.expiresAt || 'N/A'}`);
    
    console.log('\n🚀 Next steps:');
    console.log('1. Copy tokens-production.json to Railway production');
    console.log('2. Rename it to tokens.json in production');
    console.log('3. Restart the production service');
    
  } catch (error) {
    console.error('❌ Error copying tokens:', error.message);
  }
}

copyTokensToProduction();
