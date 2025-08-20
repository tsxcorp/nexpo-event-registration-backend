const redis = require('redis');

async function testRedisDatabases() {
  console.log('🧪 Testing all Redis databases...');
  
  // Test tất cả databases từ 0-15
  for (let db = 0; db < 16; db++) {
    console.log(`\n📊 Testing database ${db}...`);
    
    const config = {
      host: 'localhost',
      port: 6379,
      db: db,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    };
    
    const client = redis.createClient(config);
    
    try {
      await client.connect();
      
      // Select database
      await client.select(db);
      
      // List all keys
      const keys = await client.keys('*');
      console.log(`   Keys in database ${db}: ${keys.length}`);
      
      // Check for zoho keys
      const zohoKeys = keys.filter(key => key.startsWith('zoho:'));
      if (zohoKeys.length > 0) {
        console.log(`   Zoho keys in database ${db}:`, zohoKeys);
        
        // Check zoho:all_registrations
        const allRegistrations = await client.get('zoho:all_registrations');
        if (allRegistrations) {
          try {
            const parsed = JSON.parse(allRegistrations);
            if (Array.isArray(parsed)) {
              console.log(`   zoho:all_registrations in database ${db}: ${parsed.length} records`);
            }
          } catch (e) {
            console.log(`   zoho:all_registrations in database ${db}: not JSON array`);
          }
        }
      }
      
      await client.disconnect();
      
    } catch (error) {
      console.log(`   Error testing database ${db}:`, error.message);
    }
  }
}

testRedisDatabases().catch(console.error);
