const axios = require('axios');
const fs = require('fs');

/**
 * Manual token generator - just provide the authorization code
 */

async function generateToken(code) {
  if (!code) {
    console.log('❌ No authorization code provided');
    console.log('Usage: node manual-token-generator.js "YOUR_AUTHORIZATION_CODE"');
    return;
  }
  
  try {
    const ZOHO_CONFIG = {
      clientId: '1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS',
      clientSecret: '81077a708d14c58fdfa61e7df589992407b196e6fd',
      redirectUri: 'http://localhost:3000/oauth/callback',
      tokenEndpoint: 'https://accounts.zoho.com/oauth/v2/token'
    };
    
    console.log('🔄 Exchanging code for tokens...');
    
    const tokenResponse = await axios.post(ZOHO_CONFIG.tokenEndpoint, {
      grant_type: 'authorization_code',
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      redirect_uri: ZOHO_CONFIG.redirectUri,
      code: code
    });
    
    const tokens = tokenResponse.data;
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    
    console.log('✅ Tokens generated successfully!');
    
    // Save tokens to file
    const tokenData = {
      accessToken: tokens.access_token,
      access_token: tokens.access_token,
      refreshToken: tokens.refresh_token,
      refresh_token: tokens.refresh_token,
      expiresAt: expiresAt,
      expires_at: expiresAt,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      scope: tokens.scope,
      created_at: new Date().toISOString()
    };
    
    fs.writeFileSync('tokens.json', JSON.stringify(tokenData, null, 2));
    console.log('✅ Tokens saved to tokens.json');
    
    console.log('\n📋 NEW TOKENS FOR PRODUCTION:');
    console.log('='.repeat(50));
    console.log(`ZOHO_ACCESS_TOKEN=${tokens.access_token}`);
    console.log(`ZOHO_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`ZOHO_TOKEN_EXPIRES_AT=${expiresAt}`);
    console.log('='.repeat(50));
    
    console.log('\n🚀 INSTRUCTIONS FOR RAILWAY:');
    console.log('1. Go to Railway dashboard');
    console.log('2. Navigate to your project');
    console.log('3. Go to Variables tab');
    console.log('4. Update these environment variables:');
    console.log('   - ZOHO_ACCESS_TOKEN');
    console.log('   - ZOHO_REFRESH_TOKEN');
    console.log('   - ZOHO_TOKEN_EXPIRES_AT');
    console.log('5. Redeploy your application');
    
    console.log('\n🎉 Token generation completed!');
    
  } catch (error) {
    console.error('❌ Token generation failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Get authorization code from command line argument
const code = process.argv[2];
generateToken(code);
