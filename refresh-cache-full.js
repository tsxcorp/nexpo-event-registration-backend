#!/usr/bin/env node

/**
 * Script to trigger full cache refresh from local
 * This will fetch ALL records from Zoho (not just 1000)
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://nexpo-event-registration-backend-production.up.railway.app';

async function refreshCacheFull() {
  try {
    console.log('🚀 Starting FULL cache refresh...');
    console.log('📍 Target:', PRODUCTION_URL);
    
    // Step 1: Clear existing cache
    console.log('\n🧹 Step 1: Clearing existing cache...');
    const clearResponse = await axios.post(`${PRODUCTION_URL}/api/cache/clear`);
    console.log('✅ Cache cleared:', clearResponse.data.message);
    
    // Step 2: Clean duplicates
    console.log('\n🧹 Step 2: Cleaning duplicate cache entries...');
    const cleanResponse = await axios.post(`${PRODUCTION_URL}/api/cache/clean-duplicates`);
    console.log('✅ Duplicates cleaned:', cleanResponse.data.message);
    
    // Step 3: Populate cache with full data
    console.log('\n📦 Step 3: Populating cache with FULL data...');
    const populateResponse = await axios.post(`${PRODUCTION_URL}/api/cache/populate`, {
      force_refresh: true,
      max_records: 50000, // Much higher limit
      include_all_events: true
    });
    console.log('✅ Cache populated:', populateResponse.data.message);
    
    // Step 4: Check cache status
    console.log('\n📊 Step 4: Checking cache status...');
    const statusResponse = await axios.get(`${PRODUCTION_URL}/api/cache/status`);
    console.log('📈 Cache Status:', JSON.stringify(statusResponse.data, null, 2));
    
    // Step 5: Test specific event
    console.log('\n🎯 Step 5: Testing specific event...');
    const eventId = '4433256000012557772';
    const eventResponse = await axios.get(`${PRODUCTION_URL}/api/cache/events/${eventId}`);
    console.log(`📊 Event ${eventId} records:`, eventResponse.data.count);
    
    console.log('\n🎉 FULL CACHE REFRESH COMPLETED!');
    console.log('📱 Widget should now have access to ALL data');
    
  } catch (error) {
    console.error('❌ Error during cache refresh:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the script
refreshCacheFull();
