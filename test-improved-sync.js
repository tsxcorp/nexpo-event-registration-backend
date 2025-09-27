/**
 * Test script for improved sync mechanism
 */

const { createClient } = require('redis');
const ImprovedSyncWorker = require('./improved-sync-worker');
require('dotenv').config();

async function testImprovedSync() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await client.connect();
    console.log('✅ Connected to Redis');

    const eventId = '4433256000013547003';
    const syncWorker = new ImprovedSyncWorker();

    console.log('\n🔍 Testing discrepancy detection...');
    const discrepancy = await syncWorker.detectMissingRecords(eventId);
    
    if (discrepancy) {
      console.log('📊 Discrepancy Analysis:');
      console.log(`   Zoho records: ${discrepancy.zohoCount}`);
      console.log(`   Redis records: ${discrepancy.redisCount}`);
      console.log(`   Missing in Redis: ${discrepancy.missingInRedis.length}`);
      console.log(`   Extra in Redis: ${discrepancy.extraInRedis.length}`);
      
      if (discrepancy.missingInRedis.length > 0) {
        console.log('\n❌ Missing records (first 5):');
        discrepancy.missingInRedis.slice(0, 5).forEach(id => console.log(`   ${id}`));
      }
      
      if (discrepancy.extraInRedis.length > 0) {
        console.log('\n➕ Extra records (first 5):');
        discrepancy.extraInRedis.slice(0, 5).forEach(id => console.log(`   ${id}`));
      }
    }

    console.log('\n🧠 Testing smart sync...');
    const result = await syncWorker.smartSyncEvent(eventId);
    console.log('📋 Smart sync result:', result);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
  }
}

// Run test
testImprovedSync();
