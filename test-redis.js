const redis = require('redis');

async function testRedis() {
  console.log('🧪 Testing Redis connection...');
  
  // Test với config giống như trong app
  const config = {
    host: 'localhost',
    port: 6379,
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
    
    // Test SET
    console.log('📝 Testing SET operation...');
    await client.setEx('test:key', 60, JSON.stringify({ test: 'data', timestamp: Date.now() }));
    console.log('✅ SET operation successful');
    
    // Test GET
    console.log('📖 Testing GET operation...');
    const value = await client.get('test:key');
    console.log('✅ GET operation successful, value:', value);
    
    // Test với key giống như trong app
    console.log('📝 Testing app-like key...');
    await client.setEx('zoho:test_key', 300, JSON.stringify({ 
      data: [{ id: 1, name: 'test' }], 
      cached_at: new Date().toISOString() 
    }));
    console.log('✅ App-like key SET successful');
    
    const appValue = await client.get('zoho:test_key');
    console.log('✅ App-like key GET successful, value:', appValue);
    
    // List all keys
    console.log('🔍 Listing all keys...');
    const keys = await client.keys('*');
    console.log('📋 All keys:', keys);
    
    await client.disconnect();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRedis();
