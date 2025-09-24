const axios = require('axios');
const readline = require('readline');

/**
 * Script to generate new Zoho OAuth tokens
 * This will guide you through the OAuth flow to get new tokens
 */

const ZOHO_CONFIG = {
  clientId: '1000.9JZBML2M06JN0VLET3DM4X6H3B8SCS',
  clientSecret: '81077a708d14c58fdfa61e7df589992407b196e6fd',
  redirectUri: 'http://localhost:3000/oauth/callback',
  authEndpoint: 'https://accounts.zoho.com/oauth/v2/auth',
  tokenEndpoint: 'https://accounts.zoho.com/oauth/v2/token',
  scope: 'ZohoCreator.form.CREATE,ZohoCreator.report.READ,ZohoCreator.meta.form.READ'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function generateToken() {
  try {
    console.log('🔐 ZOHO OAUTH TOKEN GENERATOR');
    console.log('='.repeat(50));
    
    // Step 1: Generate authorization URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: ZOHO_CONFIG.clientId,
      scope: ZOHO_CONFIG.scope,
      redirect_uri: ZOHO_CONFIG.redirectUri,
      access_type: 'offline',
      prompt: 'consent'
    });
    
    const authUrl = `${ZOHO_CONFIG.authEndpoint}?${authParams.toString()}`;
    
    console.log('\n📋 STEP 1: Authorization');
    console.log('Open this URL in your browser:');
    console.log(authUrl);
    console.log('\nAfter authorization, you will be redirected to a URL like:');
    console.log('http://localhost:3000/oauth/callback?code=1000.xxxxxxxxx');
    
    const code = await askQuestion('\nEnter the authorization code from the URL: ');
    
    if (!code) {
      console.error('❌ No authorization code provided');
      return;
    }
    
    console.log('\n🔄 STEP 2: Exchanging code for tokens...');
    
    // Step 2: Exchange code for tokens
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
    const fs = require('fs');
    const path = require('path');
    const tokenFile = path.join(process.cwd(), 'tokens.json');
    
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
    
    fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));
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
  } finally {
    rl.close();
  }
}

// Run the token generator
generateToken();
