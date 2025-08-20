const redis = require('redis');

async function testRedisCloud() {
  console.log('🧪 Testing Redis cloud services...');
  
  // Test các Redis cloud services phổ biến
  const configs = [
    {
      name: 'Redis Cloud (default)',
      config: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      }
    },
    {
      name: 'Redis Cloud (Railway)',
      config: {
        url: process.env.REDIS_URL_RAILWAY || 'redis://localhost:6379'
      }
    },
    {
      name: 'Redis Cloud (Heroku)',
      config: {
        url: process.env.REDIS_URL_HEROKU || 'redis://localhost:6379'
      }
    },
    {
      name: 'Redis Cloud (Upstash)',
      config: {
        url: process.env.REDIS_URL_UPSTASH || 'redis://localhost:6379'
      }
    },
    {
      name: 'Redis Cloud (Redis Labs)',
      config: {
        url: process.env.REDIS_URL_REDISLABS || 'redis://localhost:6379'
      }
    }
  ];
  
  for (const { name, config } of configs) {
    console.log(`\n📊 Testing ${name}...`);
    console.log(`   URL: ${config.url}`);
    
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
  
  // Check environment variables
  console.log('\n🔍 Environment variables:');
  console.log(`   REDIS_URL: ${process.env.REDIS_URL ? 'Set' : 'Not set'}`);
  console.log(`   REDIS_HOST: ${process.env.REDIS_HOST ? 'Set' : 'Not set'}`);
  console.log(`   REDIS_PORT: ${process.env.REDIS_PORT ? 'Set' : 'Not set'}`);
  console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? 'Set' : 'Not set'}`);
}

testRedisCloud().catch(console.error);
