#!/usr/bin/env node

/**
 * Migration Script: Per-Record Schema
 * 
 * This script migrates existing per-event data to the new per-record schema
 * for optimal performance with individual record operations.
 * 
 * What it does:
 * 1. Reads all existing per-event registrations
 * 2. Creates individual record keys (cache:record:{recordId})
 * 3. Creates record IDs lists (cache:event:{eventId}:record_ids)
 * 4. Maintains backward compatibility with existing per-event keys
 * 
 * Usage:
 * node scripts/migrate-to-per-record-schema.js
 */

const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

class PerRecordMigration {
  constructor() {
    this.client = null;
    this.stats = {
      eventsProcessed: 0,
      recordsMigrated: 0,
      recordIdsCreated: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async connect() {
    try {
      console.log('🔗 Connecting to Redis...');
      
      // Use REDIS_URL from environment or default config
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        }
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
      });

      await this.client.connect();
      console.log('✅ Connected to Redis successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      console.log('🔌 Disconnected from Redis');
    }
  }

  async getEventKeys() {
    try {
      console.log('🔍 Scanning for event keys...');
      const keys = await this.client.keys('cache:event:*:registrations');
      console.log(`📊 Found ${keys.length} event registration keys`);
      return keys;
    } catch (error) {
      console.error('❌ Error getting event keys:', error);
      return [];
    }
  }

  async migrateEvent(eventKey) {
    try {
      // Extract eventId from key: cache:event:4433256000013547003:registrations
      const eventId = eventKey.match(/cache:event:([^:]+):registrations/)?.[1];
      if (!eventId) {
        console.warn(`⚠️ Could not extract eventId from key: ${eventKey}`);
        return false;
      }

      console.log(`🔄 Processing event: ${eventId}`);

      // Get existing registrations
      const registrationsData = await this.client.get(eventKey);
      if (!registrationsData) {
        console.warn(`⚠️ No data found for event: ${eventId}`);
        return false;
      }

      const registrations = JSON.parse(registrationsData);
      if (!Array.isArray(registrations)) {
        console.warn(`⚠️ Invalid registrations format for event: ${eventId}`);
        return false;
      }

      console.log(`📦 Found ${registrations.length} records for event ${eventId}`);

      // Create record IDs list
      const recordIds = [];
      
      // Migrate each record to individual keys
      for (const record of registrations) {
        if (!record.ID) {
          console.warn(`⚠️ Record without ID found in event ${eventId}:`, record);
          continue;
        }

        const recordId = record.ID;
        const recordKey = `cache:record:${recordId}`;

        // Store individual record
        await this.client.set(recordKey, JSON.stringify(record));
        await this.client.persist(recordKey); // Make it persistent (no expiration)

        recordIds.push(recordId);
        this.stats.recordsMigrated++;
      }

      // Create record IDs list for this event
      const recordIdsKey = `cache:event:${eventId}:record_ids`;
      await this.client.set(recordIdsKey, JSON.stringify(recordIds));
      await this.client.persist(recordIdsKey); // Make it persistent (no expiration)

      this.stats.recordIdsCreated++;
      this.stats.eventsProcessed++;

      console.log(`✅ Migrated event ${eventId}: ${recordIds.length} records`);
      return true;

    } catch (error) {
      console.error(`❌ Error migrating event ${eventKey}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  async validateMigration() {
    try {
      console.log('\n🔍 Validating migration...');
      
      // Check individual record keys
      const recordKeys = await this.client.keys('cache:record:*');
      console.log(`📊 Individual record keys: ${recordKeys.length}`);

      // Check record IDs keys
      const recordIdsKeys = await this.client.keys('cache:event:*:record_ids');
      console.log(`📊 Record IDs keys: ${recordIdsKeys.length}`);

      // Sample validation - check a few events
      const sampleEvents = await this.client.keys('cache:event:*:record_ids');
      if (sampleEvents.length > 0) {
        const sampleEvent = sampleEvents[0];
        const eventId = sampleEvent.match(/cache:event:([^:]+):record_ids/)?.[1];
        
        if (eventId) {
          const recordIdsData = await this.client.get(sampleEvent);
          const recordIds = JSON.parse(recordIdsData);
          
          console.log(`🔍 Sample validation - Event ${eventId}:`);
          console.log(`   Record IDs: ${recordIds.length}`);
          
          // Check first few individual records
          for (let i = 0; i < Math.min(3, recordIds.length); i++) {
            const recordKey = `cache:record:${recordIds[i]}`;
            const recordData = await this.client.get(recordKey);
            if (recordData) {
              const record = JSON.parse(recordData);
              console.log(`   ✅ Record ${recordIds[i]}: ${record.Full_Name || 'No name'}`);
            } else {
              console.log(`   ❌ Record ${recordIds[i]}: Missing data`);
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Validation error:', error);
      return false;
    }
  }

  async run() {
    console.log('🚀 Starting Per-Record Schema Migration');
    console.log('=====================================');

    // Connect to Redis
    const connected = await this.connect();
    if (!connected) {
      process.exit(1);
    }

    try {
      // Get all event keys
      const eventKeys = await this.getEventKeys();
      if (eventKeys.length === 0) {
        console.log('ℹ️ No event keys found to migrate');
        return;
      }

      console.log(`\n📋 Migration Plan:`);
      console.log(`   Events to process: ${eventKeys.length}`);
      console.log(`   Estimated records: ${eventKeys.length * 100} (rough estimate)`);
      console.log(`   Target schema: Per-record with individual keys`);

      // Confirm migration
      console.log('\n⚠️ This will create individual record keys for all existing data.');
      console.log('   Existing per-event keys will be preserved for backward compatibility.');
      console.log('   This operation is safe and can be run multiple times.');

      // Process each event
      console.log('\n🔄 Starting migration...');
      for (const eventKey of eventKeys) {
        await this.migrateEvent(eventKey);
        
        // Progress indicator
        const progress = ((this.stats.eventsProcessed / eventKeys.length) * 100).toFixed(1);
        console.log(`📊 Progress: ${progress}% (${this.stats.eventsProcessed}/${eventKeys.length} events)`);
      }

      // Validate migration
      await this.validateMigration();

      // Final stats
      const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);
      console.log('\n✅ Migration Completed!');
      console.log('====================');
      console.log(`⏱️  Duration: ${duration} seconds`);
      console.log(`📊 Events processed: ${this.stats.eventsProcessed}`);
      console.log(`📦 Records migrated: ${this.stats.recordsMigrated}`);
      console.log(`🔗 Record IDs lists created: ${this.stats.recordIdsCreated}`);
      console.log(`❌ Errors: ${this.stats.errors}`);

      if (this.stats.errors === 0) {
        console.log('\n🎉 Migration successful! All data is now available in per-record schema.');
        console.log('💡 You can now use the new per-record endpoints for better performance.');
      } else {
        console.log(`\n⚠️ Migration completed with ${this.stats.errors} errors.`);
        console.log('   Please review the logs above for details.');
      }

    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new PerRecordMigration();
  migration.run().catch(console.error);
}

module.exports = PerRecordMigration;
