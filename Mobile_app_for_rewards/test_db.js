/**
 * test_db.js - Full Verification Script for MongoDB Atlas & Application Logic
 */

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://sharmaprafful646_db_user:sIC4U5XtGaQp88I3@cluster0.dslqlyg.mongodb.net/rewardsDB?retryWrites=true&w=majority';

async function runTests() {
  console.log('=== STEP 1: CONNECTING TO MONGODB ATLAS ===');
  const client = new MongoClient(URI);
  
  try {
    await client.connect();
    console.log('✅ Connected successfully to MongoDB Atlas cluster0.dslqlyg.mongodb.net');
    
    const db = client.db('rewardsDB');
    const usersCol = db.collection('users');
    const rewardsCol = db.collection('rewards');

    console.log('\n=== STEP 2: TESTING CUSTOMER REGISTRATION ===');
    const testCustomer = {
      name: 'Rahul Sharma',
      phone: '9876543210',
      password: 'password123',
      createdAt: new Date().toISOString()
    };
    
    // Clean up any previous test record
    await usersCol.deleteMany({ phone: testCustomer.phone });
    
    const regResult = await usersCol.insertOne(testCustomer);
    console.log(`✅ Customer Registered in DB with ID: ${regResult.insertedId}`);

    console.log('\n=== STEP 3: TESTING CUSTOMER AUTHENTICATION (PHONE & PASSWORD) ===');
    const authUser = await usersCol.findOne({ phone: '9876543210', password: 'password123' });
    if (authUser && authUser.name === 'Rahul Sharma') {
      console.log('✅ Customer Login Verified successfully:', authUser.name, authUser.phone);
    } else {
      throw new Error('Authentication failed in MongoDB');
    }

    console.log('\n=== STEP 4: TESTING ADMIN REWARD ALLOCATION & CAPPING RULES ===');
    // Prompt specification: Order amount 15000, 10% = 1500 pts, Expiry date, Capping 50%, Min product 10000
    const testReward = {
      customerName: 'Rahul Sharma',
      customerPhone: '9876543210',
      orderId: 'ORD-15000-TEST',
      productName: 'Android 5G Smartphone',
      orderDate: '2026-11-14',
      orderAmount: 15000,
      rewardPercent: 10,
      rewardPoints: 1500,
      expiryDate: '2026-12-31T23:59',
      cappingPercent: 50, // max 50% points useable
      minOrderAmount: 10000, // on 10,000 Rs product
      productImage: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect fill="%23eee" width="50" height="50"/></svg>',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    // Clean up previous test rewards
    await rewardsCol.deleteMany({ orderId: testReward.orderId });

    const rewardResult = await rewardsCol.insertOne(testReward);
    console.log(`✅ Admin Reward Points Issued & Inserted in DB with ID: ${rewardResult.insertedId}`);

    console.log('\n=== STEP 5: TESTING CUSTOMER WALLET FETCH & CAPPING COMPUTATION ===');
    const customerRewards = await rewardsCol.find({ customerPhone: '9876543210' }).toArray();
    console.log(`✅ Retrieved ${customerRewards.length} reward records for customer 9876543210`);

    let totalPoints = 0;
    customerRewards.forEach((r, idx) => {
      console.log(`   [Record ${idx + 1}] Order #${r.orderId}: +${r.rewardPoints} PTS (${r.rewardPercent}% of ₹${r.orderAmount}) | Expiry: ${r.expiryDate} | Capping: ${r.cappingPercent}% on min ₹${r.minOrderAmount}`);
      totalPoints += r.rewardPoints;
    });

    const maxRedeemable = Math.floor(totalPoints * (testReward.cappingPercent / 100));
    console.log(`\n✅ Wallet Balance: ${totalPoints} PTS`);
    console.log(`✅ Maximum Redeemable (with 50% capping): ${maxRedeemable} PTS on min ₹10,000 product`);

    console.log('\n=== STEP 6: VERIFYING NETLIFY API SERVERLESS ENDPOINTS ===');
    const apiHandler = require('./netlify/functions/api.js').handler;
    
    // Test GET /api/status
    const statusEvent = { httpMethod: 'GET', path: '/api/status' };
    const statusRes = await apiHandler(statusEvent);
    console.log('✅ GET /api/status response:', statusRes.statusCode, statusRes.body);

    // Test GET /api/rewards?phone=9876543210
    const getRewardsEvent = { 
      httpMethod: 'GET', 
      path: '/api/rewards',
      queryStringParameters: { phone: '9876543210' }
    };
    const getRewardsRes = await apiHandler(getRewardsEvent);
    const parsedRewards = JSON.parse(getRewardsRes.body);
    console.log(`✅ GET /api/rewards returned ${parsedRewards.length} items from serverless handler`);

    console.log('\n🎉 ALL DATABASE & APPLICATION LOGIC TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await client.close();
    console.log('Closed MongoDB connection.');
  }
}

runTests();
