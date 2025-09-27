#!/usr/bin/env node

/**
 * Railway Auto-Update Setup Script
 * 
 * This script helps configure Railway API credentials for automatic token updates.
 * 
 * Usage:
 * 1. Get Railway Project ID from Railway dashboard
 * 2. Get Railway API Token from Railway settings
 * 3. Run: node setup-railway-auto-update.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupRailwayAutoUpdate() {
  console.log('🚀 Railway Auto-Update Setup');
  console.log('=====================================\n');
  
  console.log('This will enable automatic token updates in Railway production environment.\n');
  
  console.log('📋 Prerequisites:');
  console.log('1. Railway Project ID (from Railway dashboard)');
  console.log('2. Railway API Token (from Railway settings > API)\n');
  
  const projectId = await question('🔑 Enter Railway Project ID: ');
  const apiToken = await question('🔑 Enter Railway API Token: ');
  
  if (!projectId || !apiToken) {
    console.log('❌ Project ID and API Token are required!');
    rl.close();
    return;
  }
  
  // Update .env file
  const envFile = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
  }
  
  // Remove existing Railway entries
  envContent = envContent.replace(/^RAILWAY_PROJECT_ID=.*$/gm, '');
  envContent = envContent.replace(/^RAILWAY_TOKEN=.*$/gm, '');
  
  // Add new Railway entries
  const newEnvContent = envContent.trim() + '\n' +
    `RAILWAY_PROJECT_ID=${projectId}\n` +
    `RAILWAY_TOKEN=${apiToken}\n`;
  
  fs.writeFileSync(envFile, newEnvContent);
  
  console.log('\n✅ Railway credentials added to .env file');
  console.log('\n📋 Next steps for production:');
  console.log('1. Add these environment variables to Railway dashboard:');
  console.log(`   RAILWAY_PROJECT_ID=${projectId}`);
  console.log(`   RAILWAY_TOKEN=${apiToken}`);
  console.log('2. Deploy to Railway');
  console.log('3. Tokens will now auto-update without manual intervention!\n');
  
  console.log('🧪 Testing Railway API connection...');
  
  // Test the connection
  try {
    const axios = require('axios');
    const railwayApiUrl = 'https://backboard.railway.app/graphql/v1';
    
    const query = `
      query getProject($id: String!) {
        project(id: $id) {
          id
          name
        }
      }
    `;
    
    const response = await axios.post(railwayApiUrl, {
      query: query,
      variables: { id: projectId }
    }, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.data && response.data.data.project) {
      console.log(`✅ Railway API connection successful!`);
      console.log(`📦 Project: ${response.data.data.project.name} (${projectId})`);
    } else {
      console.log('⚠️ Railway API connection failed - check credentials');
    }
    
  } catch (error) {
    console.log('⚠️ Railway API connection failed:', error.response?.data?.errors?.[0]?.message || error.message);
  }
  
  rl.close();
}

setupRailwayAutoUpdate().catch(console.error);
