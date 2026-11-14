const { handler } = require('./netlify/functions/api.js');

async function testDirectApi() {
  console.log('Testing handler with direct MONGODB_URI (no .env)...');
  
  // Test 1: GET /status
  const statusRes = await handler({
    httpMethod: 'GET',
    path: '/api/status',
    queryStringParameters: null,
    body: null
  });
  console.log('Status endpoint response:', statusRes.statusCode, statusRes.body);

  // Test 2: GET /rewards?phone=9876543210
  const rewardsRes = await handler({
    httpMethod: 'GET',
    path: '/api/rewards',
    queryStringParameters: { phone: '9876543210' },
    body: null
  });
  console.log('Rewards endpoint response:', rewardsRes.statusCode, 'Count:', JSON.parse(rewardsRes.body).length);
}

testDirectApi().then(() => {
  console.log('✅ Direct URI API handler test completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error testing API handler:', err);
  process.exit(1);
});
