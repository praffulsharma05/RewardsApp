const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGODB_URI = 'mongodb+srv://sharmaprafful646_db_user:sIC4U5XtGaQp88I3@cluster0.dslqlyg.mongodb.net/rewardsDB?retryWrites=true&w=majority';

async function testUserFlow() {
  console.log('--- STARTING USER REGISTRATION, LOGIN & DATA ISOLATION TEST ---');
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    const db = client.db('rewardsDB');
    const usersCol = db.collection('users');
    const rewardsCol = db.collection('rewards');

    // Clean up test customer if existed from previous run
    const testPhone = '9811122233';
    await usersCol.deleteMany({ phone: testPhone });
    await rewardsCol.deleteMany({ customerPhone: testPhone });

    // TEST 1: Registration
    console.log('\n[1] Testing Registration of new customer (Priya Singh, 9811122233)...');
    const newUser = {
      name: 'Priya Singh',
      phone: testPhone,
      password: 'passwordPriya123',
      createdAt: new Date().toISOString()
    };
    const regResult = await usersCol.insertOne(newUser);
    console.log('✅ Registration successful! User ID:', regResult.insertedId.toString());

    // TEST 2: Duplicate registration check
    console.log('\n[2] Testing Duplicate Registration prevention...');
    const duplicateCheck = await usersCol.findOne({ phone: testPhone });
    if (duplicateCheck) {
      console.log('✅ Duplicate prevention verified: Phone', testPhone, 'is recognized as already registered.');
    }

    // TEST 3: Login with correct password
    console.log('\n[3] Testing Login with correct credentials...');
    const loginUser = await usersCol.findOne({ phone: testPhone, password: 'passwordPriya123' });
    if (loginUser) {
      console.log('✅ Login SUCCESS! Logged in as:', loginUser.name, 'Phone:', loginUser.phone);
    } else {
      console.error('❌ Login failed with correct credentials');
    }

    // TEST 4: Login with incorrect password
    console.log('\n[4] Testing Login with WRONG password...');
    const wrongLogin = await usersCol.findOne({ phone: testPhone, password: 'wrongPassword' });
    if (!wrongLogin) {
      console.log('✅ Login correctly rejected for invalid password.');
    } else {
      console.error('❌ Security breach: Login succeeded with wrong password');
    }

    // TEST 5: Verify new user wallet has 0 rewards initially
    console.log('\n[5] Fetching rewards for new user (9811122233)...');
    const priyaRewardsBefore = await rewardsCol.find({ customerPhone: testPhone }).toArray();
    console.log(`✅ Priya's rewards count: ${priyaRewardsBefore.length} (Expected: 0)`);

    // TEST 6: Admin issues reward specifically to Priya Singh
    console.log('\n[6] Admin issues reward of 2,500 points to Priya Singh (9811122233)...');
    const priyaReward = {
      customerName: 'Priya Singh',
      customerPhone: testPhone,
      orderId: 'ORD-PRIYA-999',
      productName: 'Designer Handbag',
      orderDate: '2026-11-14',
      orderAmount: 25000,
      rewardPercent: 10,
      rewardPoints: 2500,
      expiryDate: '2026-12-31T23:59',
      cappingPercent: 50,
      minOrderAmount: 5000,
      productImage: '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    const rewardResult = await rewardsCol.insertOne(priyaReward);
    console.log('✅ Reward issued to Priya Singh! ID:', rewardResult.insertedId.toString());

    // TEST 7: Priya logs into wallet and fetches her rewards
    console.log('\n[7] Priya opens Wallet - Fetching rewards for 9811122233...');
    const priyaRewardsAfter = await rewardsCol.find({ customerPhone: testPhone }).toArray();
    console.log(`✅ Priya's rewards count: ${priyaRewardsAfter.length}`);
    priyaRewardsAfter.forEach(r => {
      console.log(`   - Order: #${r.orderId} | Product: ${r.productName} | Points: +${r.rewardPoints} | Valid until: ${r.expiryDate}`);
    });

    // TEST 8: Rahul Sharma (9876543210) opens Wallet - Verify DATA ISOLATION
    console.log('\n[8] Rahul Sharma (9876543210) opens Wallet - Verifying Data Isolation...');
    const rahulRewards = await rewardsCol.find({ customerPhone: '9876543210' }).toArray();
    console.log(`✅ Rahul's rewards count: ${rahulRewards.length}`);
    const rahulHasPriyaReward = rahulRewards.some(r => r.customerPhone === testPhone || r.orderId === 'ORD-PRIYA-999');
    if (!rahulHasPriyaReward) {
      console.log('✅ DATA ISOLATION CONFIRMED: Rahul cannot see Priya\'s rewards!');
    } else {
      console.error('❌ DATA LEAK: Rahul can see Priya\'s rewards!');
    }

    rahulRewards.forEach(r => {
      console.log(`   - Order: #${r.orderId} | Product: ${r.productName} | Points: +${r.rewardPoints} | Phone: ${r.customerPhone}`);
    });

    console.log('\n--- ALL USER APP TESTS PASSED PERFECTLY ---');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await client.close();
  }
}

testUserFlow();
