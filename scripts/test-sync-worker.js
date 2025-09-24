#!/usr/bin/env node

/**
 * Test Script for Sync Worker
 * Tests discrepancy detection and sync functionality
 */

// Set up path for require
const path = require('path');
const projectRoot = path.join(__dirname, '..');

const syncWorker = require(path.join(projectRoot, 'src/services/syncWorker'));
const redisService = require(path.join(projectRoot, 'src/services/redisService'));
const logger = require(path.join(projectRoot, 'src/utils/logger'));

async function testSyncWorker() {
  console.log('🧪 Testing Sync Worker...\n');

  try {
    // Test 1: Check sync worker status
    console.log('📊 Test 1: Sync Worker Status');
    const status = syncWorker.getStatus();
    console.log('Status:', JSON.stringify(status, null, 2));
    console.log('✅ Sync worker status check passed\n');

    // Test 2: Discrepancy check
    console.log('🔍 Test 2: Discrepancy Check');
    try {
      await redisService.connect();
      
      // Get all cached events
      const eventKeys = await redisService.client.keys('cache:event:*:meta');
      console.log(`Found ${eventKeys.length} cached events`);
      
      for (const key of eventKeys.slice(0, 3)) { // Test first 3 events
        const eventId = key.match(/cache:event:([^:]+):meta/)?.[1];
        if (!eventId) continue;

        console.log(`\nChecking event: ${eventId}`);
        
        // Get Redis count
        const redisCount = await redisService.get(`cache:event:${eventId}:count`) || 0;
        console.log(`  Redis count: ${redisCount}`);
        
        // Get Zoho count
        const zohoCount = await syncWorker.getZohoRecordCount(eventId);
        console.log(`  Zoho count: ${zohoCount}`);
        
        const difference = zohoCount - redisCount;
        console.log(`  Difference: ${difference}`);
        
        if (difference !== 0) {
          console.log(`  ⚠️ Event ${eventId} needs sync!`);
        } else {
          console.log(`  ✅ Event ${eventId} is in sync`);
        }
      }
      
      console.log('✅ Discrepancy check completed\n');
      
    } catch (error) {
      console.error('❌ Discrepancy check failed:', error.message);
    }

    // Test 3: Force sync specific event
    console.log('🔄 Test 3: Force Sync Event');
    const testEventId = '4433256000013547003'; // Use the event from your logs
    
    try {
      console.log(`Force syncing event: ${testEventId}`);
      const result = await syncWorker.forceSyncEvent(testEventId);
      
      if (result.success) {
        console.log(`✅ Force sync successful: ${result.recordCount} records`);
      } else {
        console.log(`❌ Force sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Force sync test failed:', error.message);
    }

    console.log('\n✅ Sync worker testing completed');

  } catch (error) {
    console.error('❌ Sync worker test failed:', error);
  } finally {
    // Cleanup
    try {
      await redisService.disconnect();
    } catch (error) {
      console.error('Error disconnecting Redis:', error.message);
    }
  }
}

// Run test if called directly
if (require.main === module) {
  testSyncWorker().catch(console.error);
}

module.exports = { testSyncWorker };
