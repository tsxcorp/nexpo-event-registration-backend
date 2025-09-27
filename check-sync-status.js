const { createClient } = require('redis');
require('dotenv').config();

async function checkSyncStatus() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await client.connect();
    console.log('✅ Connected to Redis');

    // Check sync metadata
    const syncMetadata = await client.get('sync:metadata');
    if (syncMetadata) {
      const metadata = JSON.parse(syncMetadata);
      console.log('\n📊 Sync Metadata:');
      console.log('Worker Status:', metadata.worker_status);
      console.log('Sync Stats:', metadata.sync_stats);
      console.log('Last Full Sync:', metadata.last_full_sync);
    } else {
      console.log('❌ No sync metadata found');
    }

    // Check last sync timestamps for events
    console.log('\n🕐 Event Last Sync Timestamps:');
    const eventKeys = await client.keys('cache:event:*:last_sync');
    for (const key of eventKeys) {
      const eventId = key.match(/cache:event:([^:]+):last_sync/)?.[1];
      const lastSync = await client.get(key);
      if (eventId && lastSync) {
        const lastSyncTime = new Date(lastSync);
        const now = new Date();
        const timeDiff = Math.round((now - lastSyncTime) / 1000 / 60); // minutes
        console.log(`Event ${eventId}: ${timeDiff} minutes ago (${lastSyncTime.toISOString()})`);
      }
    }

    // Check if sync worker is configured to run
    console.log('\n⚙️ Sync Worker Configuration:');
    console.log('SYNC_INTERVAL_MS:', process.env.SYNC_INTERVAL_MS || '300000 (5 minutes)');
    console.log('SYNC_THRESHOLD_MINUTES:', process.env.SYNC_THRESHOLD_MINUTES || '15 minutes');
    console.log('ENABLE_AUTO_SYNC:', process.env.ENABLE_AUTO_SYNC || 'true');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
  }
}

checkSyncStatus();
