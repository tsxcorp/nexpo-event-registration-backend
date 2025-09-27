#!/usr/bin/env node

/**
 * Debug Proxy Image Endpoint
 * Test the proxy-image functionality step by step
 */

const axios = require('axios');

async function testProxyImage() {
  console.log('🔍 Testing Proxy Image Endpoint...\n');
  
  // Test 1: Basic health check
  console.log('1️⃣ Testing basic endpoint...');
  try {
    const response = await axios.get('https://nexpo-event-registration-backend-production.up.railway.app/api/proxy-image?recordId=test&fieldName=test&filename=test.png', {
      timeout: 10000
    });
    console.log('✅ Basic endpoint works:', response.data);
  } catch (error) {
    console.log('❌ Basic endpoint failed:', error.response?.data || error.message);
  }
  
  console.log('\n2️⃣ Testing with real recordId...');
  try {
    const response = await axios.get('https://nexpo-event-registration-backend-production.up.railway.app/api/proxy-image?recordId=4433256000012332047&fieldName=Logo&filename=test.png', {
      timeout: 30000 // 30 second timeout
    });
    console.log('✅ Real recordId works:', response.data);
  } catch (error) {
    console.log('❌ Real recordId failed:', error.response?.data || error.message);
  }
  
  console.log('\n3️⃣ Testing with real filename...');
  try {
    const response = await axios.get('https://nexpo-event-registration-backend-production.up.railway.app/api/proxy-image?recordId=4433256000012332047&fieldName=Logo&filename=1749629304227605_Artwork_2.png', {
      timeout: 60000, // 60 second timeout
      maxRedirects: 0 // Don't follow redirects
    });
    console.log('✅ Real filename works - Content-Type:', response.headers['content-type']);
    console.log('✅ Response size:', response.data.length, 'bytes');
  } catch (error) {
    console.log('❌ Real filename failed:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('Response body:', error.response.data);
    }
  }
  
  console.log('\n4️⃣ Testing direct Zoho API call...');
  try {
    // Test direct Zoho API call to see if it's a Zoho issue
    const zohoUrl = `https://www.zohoapis.com/creator/v2.1/data/tsxcorp/nxp/report/API_Events/4433256000012332047/Logo/download?filepath=1749629304227605_Artwork_2.png`;
    const response = await axios.get(zohoUrl, {
      timeout: 30000,
      headers: {
        'Authorization': 'Zoho-oauthtoken 1000.c1bc02b1c98c07d6b2efa1e5db1358dd.aa1b13c83f5bc8a05c4d8a725ff7168c',
        'User-Agent': 'NEXPO-Backend/1.0'
      }
    });
    console.log('✅ Direct Zoho API works - Content-Type:', response.headers['content-type']);
  } catch (error) {
    console.log('❌ Direct Zoho API failed:', error.response?.status, error.response?.statusText);
  }
}

testProxyImage().catch(console.error);
