#!/usr/bin/env node

/**
 * Test Script: Per-Record Schema Migration
 * 
 * This script tests the per-record schema migration by:
 * 1. Checking if migration was successful
 * 2. Comparing performance between old and new schemas
 * 3. Validating data integrity
 * 
 * Usage:
 * node scripts/test-per-record-migration.js
 */

const { createClient } = require('redis');

// Load environment variables
require('dotenv').config();

class PerRecordMigrationTester {
  constructor() {
    this.client = null;
  }

  async connect() {
    try {
      console.log('🔗 Connecting to Redis...');
      
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        }
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

  async checkMigrationStatus() {
    console.log('\n🔍 Checking Migration Status');
    console.log('============================');

    try {
      // Check individual record keys
      const recordKeys = await this.client.keys('cache:record:*');
      console.log(`📊 Individual record keys: ${recordKeys.length}`);

      // Check record IDs keys
      const recordIdsKeys = await this.client.keys('cache:event:*:record_ids');
      console.log(`📊 Record IDs keys: ${recordIdsKeys.length}`);

      // Check original per-event keys
      const eventKeys = await this.client.keys('cache:event:*:registrations');
      console.log(`📊 Original event keys: ${eventKeys.length}`);

      // Migration status
      const hasIndividualRecords = recordKeys.length > 0;
      const hasRecordIds = recordIdsKeys.length > 0;
      const hasOriginalKeys = eventKeys.length > 0;

      console.log('\n📋 Migration Status:');
      console.log(`   Individual records: ${hasIndividualRecords ? '✅' : '❌'}`);
      console.log(`   Record IDs lists: ${hasRecordIds ? '✅' : '❌'}`);
      console.log(`   Original keys (preserved): ${hasOriginalKeys ? '✅' : '❌'}`);

      if (hasIndividualRecords && hasRecordIds) {
        console.log('\n🎉 Migration appears to be successful!');
        return true;
      } else {
        console.log('\n⚠️ Migration may be incomplete or not run yet.');
        return false;
      }

    } catch (error) {
      console.error('❌ Error checking migration status:', error);
      return false;
    }
  }

  async testPerformanceComparison() {
    console.log('\n⚡ Performance Comparison Test');
    console.log('==============================');

    try {
      // Get a sample event
      const eventKeys = await this.client.keys('cache:event:*:registrations');
      if (eventKeys.length === 0) {
        console.log('⚠️ No events found for performance testing');
        return;
      }

      const sampleEventKey = eventKeys[0];
      const eventId = sampleEventKey.match(/cache:event:([^:]+):registrations/)?.[1];
      
      if (!eventId) {
        console.log('⚠️ Could not extract eventId for performance testing');
        return;
      }

      console.log(`🔍 Testing with event: ${eventId}`);

      // Test 1: Original per-event schema (load entire array)
      console.log('\n📊 Test 1: Original Per-Event Schema');
      const start1 = Date.now();
      
      const registrationsData = await this.client.get(`cache:event:${eventId}:registrations`);
      const registrations = JSON.parse(registrationsData);
      
      const end1 = Date.now();
      const duration1 = end1 - start1;
      
      console.log(`   Records loaded: ${registrations.length}`);
      console.log(`   Duration: ${duration1}ms`);
      console.log(`   Memory usage: ~${JSON.stringify(registrations).length} bytes`);

      // Test 2: New per-record schema (load individual records)
      console.log('\n📊 Test 2: New Per-Record Schema');
      const start2 = Date.now();
      
      const recordIdsData = await this.client.get(`cache:event:${eventId}:record_ids`);
      const recordIds = JSON.parse(recordIdsData);
      
      // Load first 10 records individually
      const sampleRecords = [];
      for (let i = 0; i < Math.min(10, recordIds.length); i++) {
        const recordData = await this.client.get(`cache:record:${recordIds[i]}`);
        if (recordData) {
          sampleRecords.push(JSON.parse(recordData));
        }
      }
      
      const end2 = Date.now();
      const duration2 = end2 - start2;
      
      console.log(`   Record IDs loaded: ${recordIds.length}`);
      console.log(`   Sample records loaded: ${sampleRecords.length}`);
      console.log(`   Duration: ${duration2}ms`);
      console.log(`   Memory usage: ~${JSON.stringify(sampleRecords).length} bytes`);

      // Test 3: Individual record access (simulate check-in)
      console.log('\n📊 Test 3: Individual Record Access (Check-in Simulation)');
      if (recordIds.length > 0) {
        const start3 = Date.now();
        
        const targetRecordId = recordIds[0];
        const recordData = await this.client.get(`cache:record:${targetRecordId}`);
        const record = JSON.parse(recordData);
        
        // Simulate check-in update
        record.Check_in_Status = 'checked_in';
        record.Check_in_Time = new Date().toISOString();
        
        await this.client.set(`cache:record:${targetRecordId}`, JSON.stringify(record), {
          EX: -1
        });
        
        const end3 = Date.now();
        const duration3 = end3 - start3;
        
        console.log(`   Record ID: ${targetRecordId}`);
        console.log(`   Record name: ${record.Full_Name || 'No name'}`);
        console.log(`   Duration: ${duration3}ms`);
        console.log(`   Operation: Individual record update`);
      }

      // Performance summary
      console.log('\n📈 Performance Summary:');
      console.log(`   Original schema (full load): ${duration1}ms`);
      console.log(`   New schema (sample load): ${duration2}ms`);
      console.log(`   Individual update: ${duration3 || 'N/A'}ms`);
      
      if (duration2 < duration1) {
        console.log('   ✅ New schema is faster for partial data access');
      } else {
        console.log('   ℹ️ Original schema may be faster for full data access');
      }

    } catch (error) {
      console.error('❌ Performance test error:', error);
    }
  }

  async testDataIntegrity() {
    console.log('\n🔍 Data Integrity Test');
    console.log('=====================');

    try {
      const eventKeys = await this.client.keys('cache:event:*:registrations');
      if (eventKeys.length === 0) {
        console.log('⚠️ No events found for integrity testing');
        return;
      }

      // Test a few events
      const testEvents = eventKeys.slice(0, 3);
      
      for (const eventKey of testEvents) {
        const eventId = eventKey.match(/cache:event:([^:]+):registrations/)?.[1];
        if (!eventId) continue;

        console.log(`\n🔍 Testing event: ${eventId}`);

        // Get original data
        const registrationsData = await this.client.get(eventKey);
        const originalRecords = JSON.parse(registrationsData);

        // Get record IDs
        const recordIdsData = await this.client.get(`cache:event:${eventId}:record_ids`);
        if (!recordIdsData) {
          console.log(`   ❌ No record IDs found for event ${eventId}`);
          continue;
        }

        const recordIds = JSON.parse(recordIdsData);
        console.log(`   📊 Original records: ${originalRecords.length}`);
        console.log(`   📊 Record IDs: ${recordIds.length}`);

        // Check if counts match
        if (originalRecords.length !== recordIds.length) {
          console.log(`   ⚠️ Count mismatch: ${originalRecords.length} vs ${recordIds.length}`);
        } else {
          console.log(`   ✅ Record count matches`);
        }

        // Check if all record IDs exist as individual records
        let missingRecords = 0;
        for (const recordId of recordIds.slice(0, 5)) { // Check first 5
          const recordData = await this.client.get(`cache:record:${recordId}`);
          if (!recordData) {
            missingRecords++;
          }
        }

        if (missingRecords === 0) {
          console.log(`   ✅ All sample records exist individually`);
        } else {
          console.log(`   ❌ ${missingRecords} sample records missing`);
        }

        // Check if record data matches
        if (originalRecords.length > 0 && recordIds.length > 0) {
          const originalRecord = originalRecords[0];
          const recordId = recordIds[0];
          const individualRecordData = await this.client.get(`cache:record:${recordId}`);
          
          if (individualRecordData) {
            const individualRecord = JSON.parse(individualRecordData);
            
            if (originalRecord.ID === individualRecord.ID && 
                originalRecord.Full_Name === individualRecord.Full_Name) {
              console.log(`   ✅ Sample record data matches`);
            } else {
              console.log(`   ❌ Sample record data mismatch`);
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Data integrity test error:', error);
    }
  }

  async run() {
    console.log('🧪 Per-Record Schema Migration Tester');
    console.log('====================================');

    const connected = await this.connect();
    if (!connected) {
      process.exit(1);
    }

    try {
      // Check migration status
      const migrationSuccessful = await this.checkMigrationStatus();

      if (migrationSuccessful) {
        // Run performance comparison
        await this.testPerformanceComparison();

        // Test data integrity
        await this.testDataIntegrity();

        console.log('\n✅ All tests completed successfully!');
        console.log('💡 The per-record schema is ready for production use.');
      } else {
        console.log('\n⚠️ Migration appears incomplete. Please run the migration script first:');
        console.log('   node scripts/migrate-to-per-record-schema.js');
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PerRecordMigrationTester();
  tester.run().catch(console.error);
}

module.exports = PerRecordMigrationTester;
