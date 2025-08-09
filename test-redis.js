const redis = require('redis');

async function testRedisConnection() {
  const connections = [
    'redis://default:08kSQGKgEDsL8ASOsWthaM6gLW74LaUi@redis-14581.c292.ap-southeast-1-1.ec2.redns.redis-cloud.com:14581',
    'rediss://default:08kSQGKgEDsL8ASOsWthaM6gLW74LaUi@redis-14581.c292.ap-southeast-1-1.ec2.redns.redis-cloud.com:14581'
  ];

  for (const url of connections) {
    console.log(`\n🔄 Testing: ${url.split('@')[0]}@***`);
    
    try {
      const client = redis.createClient({ url });
      
      client.on('error', (err) => {
        console.log(`❌ Error: ${err.message}`);
      });

      console.log('⏳ Connecting...');
      await client.connect();
      
      console.log('⏳ Testing PING...');
      const result = await client.ping();
      console.log(`✅ SUCCESS: ${result}`);
      
      await client.disconnect();
      break; // Success, stop testing
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

testRedisConnection();
