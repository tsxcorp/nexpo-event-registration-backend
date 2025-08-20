const redis = require('redis');

async function testRedisConfigs() {
  console.log('🧪 Testing Redis configurations...');
  
  // Test các configuration khác nhau
  const configs = [
    {
      name: 'Localhost default',
      config: {
        host: 'localhost',
        port: 6379
      }
    },
    {
      name: 'Localhost with db 1',
      config: {
        host: 'localhost',
        port: 6379,
        db: 1
      }
    },
    {
      name: 'Localhost with db 15',
      config: {
        host: 'localhost',
        port: 6379,
        db: 15
      }
    },
    {
      name: 'Redis URL localhost',
      config: {
        url: 'redis://localhost:6379'
      }
    },
    {
      name: 'Redis URL localhost db 1',
      config: {
        url: 'redis://localhost:6379/1'
      }
    },
    {
      name: 'Redis URL localhost db 15',
      config: {
        url: 'redis://localhost:6379/15'
      }
    }
  ];
  
  for (const { name, config } of configs) {
    console.log(`\n📊 Testing ${name}...`);
    
    const client = redis.createClient(config);
    
    try {
      await client.connect();
      
      // List all keys
      const keys = await client.keys('*');
      console.log(`   Keys: ${keys.length}`);
      
      // Check for zoho keys
      const zohoKeys = keys.filter(key => key.startsWith('zoho:'));
      if (zohoKeys.length > 0) {
        console.log(`   Zoho keys:`, zohoKeys);
        
        // Check zoho:all_registrations
        const allRegistrations = await client.get('zoho:all_registrations');
        if (allRegistrations) {
          try {
            const parsed = JSON.parse(allRegistrations);
            if (Array.isArray(parsed)) {
              console.log(`   zoho:all_registrations: ${parsed.length} records`);
            }
          } catch (e) {
            console.log(`   zoho:all_registrations: not JSON array`);
          }
        }
      }
      
      await client.disconnect();
      
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }
}

testRedisConfigs().catch(console.error);
