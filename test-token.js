#!/usr/bin/env node

/**
 * Test Token Endpoint
 * Simple endpoint to test if tokens are working
 */

const axios = require('axios');

async function testTokenEndpoint() {
  console.log('🔍 Testing Token Endpoint...\n');
  
  try {
    // Test a simple endpoint that uses token
    const response = await axios.get('https://nexpo-event-registration-backend-production.up.railway.app/api/events?eventId=4433256000012332047', {
      timeout: 15000
    });
    
    console.log('✅ Events API works - Status:', response.status);
    console.log('✅ Response has event data:', !!response.data.event);
    
    if (response.data.event && response.data.event.logo) {
      console.log('✅ Logo URL:', response.data.event.logo);
    }
    
  } catch (error) {
    console.log('❌ Events API failed:', error.response?.status, error.response?.statusText);
    console.log('Error details:', error.response?.data);
  }
}

testTokenEndpoint().catch(console.error);
