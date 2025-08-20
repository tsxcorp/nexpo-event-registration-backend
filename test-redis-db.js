const redis = require('redis');

async function testRedisDB() {
  console.log('🧪 Testing Redis database connection...');
  
  // Test với config giống như trong app (database 0)
  const config = {
    host: 'localhost',
    port: 6379,
    db: 0, // Explicitly set database 0
    socket: {
      reconnectStrategy: (retries) => {
        if (retries >= 3) return false;
        return 1000;
      },
      connectTimeout: 5000,
      lazyConnect: true
    }
  };
  
  console.log('🔧 Redis config:', config);
  
  const client = redis.createClient(config);
  
  client.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
  });

  client.on('connect', () => {
    console.log('🔌 Redis connecting...');
  });

  client.on('ready', () => {
    console.log('✅ Redis connected and ready');
  });

  try {
    await client.connect();
    
    // Check current database
    const db = await client.select(0);
    console.log('📊 Current database:', db);
    
    // List all keys
    console.log('🔍 Listing all keys in database 0...');
    const keys = await client.keys('*');
    console.log('All keys:', keys);
    
    // Check zoho keys specifically
    const zohoKeys = keys.filter(key => key.startsWith('zoho:'));
    console.log('Zoho keys:', zohoKeys);
    
    // Test GET operations
    for (const key of zohoKeys) {
      console.log(`\n📋 Testing key: ${key}`);
      const value = await client.get(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            console.log(`   Type: Array, Length: ${parsed.length}`);
          } else if (typeof parsed === 'object') {
            console.log(`   Type: Object, Keys: ${Object.keys(parsed).length}`);
          } else {
            console.log(`   Type: ${typeof parsed}, Value: ${parsed}`);
          }
        } catch (e) {
          console.log(`   Type: String, Length: ${value.length}`);
        }
      } else {
        console.log('   Value: null');
      }
    }
    
    // Test SET operation
    console.log('\n📝 Testing SET operation...');
    const testKey = 'test:db_check';
    const testData = { test: 'data', timestamp: Date.now() };
    
    await client.setEx(testKey, 60, JSON.stringify(testData));
    console.log('✅ SET operation successful');
    
    const testValue = await client.get(testKey);
    console.log('✅ GET operation successful, value:', testValue);
    
    // List keys again to confirm
    const keysAfter = await client.keys('*');
    console.log('Keys after test:', keysAfter);
    
    await client.disconnect();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRedisDB();
