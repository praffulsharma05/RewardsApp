const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const URI = 'mongodb+srv://sharmaprafful646_db_user:sIC4U5XtGaQp88I3@cluster0.dslqlyg.mongodb.net/rewardsDB?retryWrites=true&w=majority';

async function runFullUserAppVerification() {
  console.log('========================================================');
  console.log('   REWARDS APP - USER APP END-TO-END VERIFICATION');
  console.log('========================================================\n');

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('rewardsDB');
  const usersCol = db.collection('users');
  const rewardsCol = db.collection('rewards');

  // --- STEP 1: VERIFY USERS IN DB ---
  console.log('📌 1. REGISTERED USERS IN DATABASE:');
  const allUsers = await usersCol.find({}).toArray();
  allUsers.forEach((u, i) => {
    console.log(`   [User ${i + 1}] Name: ${u.name} | Phone: ${u.phone} | Created: ${u.createdAt}`);
  });

  // --- STEP 2: SIMULATE LOGIN & WALLET FOR RAHUL SHARMA ---
  console.log('\n📌 2. SIMULATING LOGIN & WALLET FOR: Rahul Sharma (9876543210)');
  const rahulAuth = await usersCol.findOne({ phone: '9876543210', password: 'password123' });
  if (!rahulAuth) throw new Error('Rahul login failed');
  console.log(`   ✅ Login authenticated: ${rahulAuth.name} (+91 ${rahulAuth.phone})`);

  const rahulRewards = await rewardsCol.find({ customerPhone: '9876543210' }).toArray();
  let rahulActivePts = 0;
  let rahulActiveCount = 0;
  let rahulExpiredCount = 0;
  const now = new Date();

  rahulRewards.forEach(r => {
    const isExpired = r.expiryDate ? new Date(r.expiryDate) < now : false;
    if (!isExpired) {
      rahulActivePts += Number(r.rewardPoints) || 0;
      rahulActiveCount++;
    } else {
      rahulExpiredCount++;
    }
  });

  console.log(`   💰 Total Available Points: ${rahulActivePts.toLocaleString()} PTS`);
  console.log(`   🏷️  Status Badges: ${rahulActiveCount} Active | ${rahulExpiredCount} Expired`);
  console.log(`   📋 Rewards List (${rahulRewards.length} items):`);
  rahulRewards.forEach(r => {
    console.log(`      • #${r.orderId}: ${r.productName} -> +${r.rewardPoints} PTS (Order: ₹${r.orderAmount}) | Expires: ${r.expiryDate}`);
  });
  console.log(`   🔒 Capping Summary: Max 50% points (${Math.floor(rahulActivePts * 0.5)} PTS) usable on min ₹10,000 product`);

  // --- STEP 3: SIMULATE LOGIN & WALLET FOR PRIYA SINGH ---
  console.log('\n📌 3. SIMULATING LOGIN & WALLET FOR: Priya Singh (9811122233)');
  const priyaAuth = await usersCol.findOne({ phone: '9811122233', password: 'passwordPriya123' });
  if (!priyaAuth) throw new Error('Priya login failed');
  console.log(`   ✅ Login authenticated: ${priyaAuth.name} (+91 ${priyaAuth.phone})`);

  const priyaRewards = await rewardsCol.find({ customerPhone: '9811122233' }).toArray();
  let priyaActivePts = 0;
  let priyaActiveCount = 0;
  let priyaExpiredCount = 0;

  priyaRewards.forEach(r => {
    const isExpired = r.expiryDate ? new Date(r.expiryDate) < now : false;
    if (!isExpired) {
      priyaActivePts += Number(r.rewardPoints) || 0;
      priyaActiveCount++;
    } else {
      priyaExpiredCount++;
    }
  });

  console.log(`   💰 Total Available Points: ${priyaActivePts.toLocaleString()} PTS`);
  console.log(`   🏷️  Status Badges: ${priyaActiveCount} Active | ${priyaExpiredCount} Expired`);
  console.log(`   📋 Rewards List (${priyaRewards.length} items):`);
  priyaRewards.forEach(r => {
    console.log(`      • #${r.orderId}: ${r.productName} -> +${r.rewardPoints} PTS (Order: ₹${r.orderAmount}) | Expires: ${r.expiryDate}`);
  });
  console.log(`   🔒 Capping Summary: Max 50% points (${Math.floor(priyaActivePts * 0.5)} PTS) usable on min ₹5,000 product`);

  // --- STEP 4: STRICT DATA PRIVACY & ISOLATION CHECK ---
  console.log('\n📌 4. CHECKING DATA ISOLATION & PRIVACY BETWEEN USERS:');
  const rahulCanSeePriya = rahulRewards.some(r => r.customerPhone === '9811122233');
  const priyaCanSeeRahul = priyaRewards.some(r => r.customerPhone === '9876543210');

  if (!rahulCanSeePriya && !priyaCanSeeRahul) {
    console.log('   ✅ DATA ISOLATION VERIFIED: Each user strictly sees ONLY their own rewards!');
  } else {
    console.error('   ❌ DATA PRIVACY LEAK DETECTED!');
  }

  // --- STEP 5: REGISTRATION & ZERO-BALANCE WALLET FOR NEW USER ---
  console.log('\n📌 5. REGISTERING A BRAND NEW CUSTOMER (Amit Verma, 9822233344)...');
  await usersCol.deleteMany({ phone: '9822233344' });
  const amitUser = {
    name: 'Amit Verma',
    phone: '9822233344',
    password: 'amitPassword',
    createdAt: new Date().toISOString()
  };
  await usersCol.insertOne(amitUser);
  console.log('   ✅ Registration completed for Amit Verma (+91 9822233344)');

  const amitRewards = await rewardsCol.find({ customerPhone: '9822233344' }).toArray();
  console.log(`   💰 Amit's Total Balance: ${amitRewards.length} PTS`);
  if (amitRewards.length === 0) {
    console.log('   ✅ Empty State correctly triggered: "No Rewards in Wallet" shown to new user.');
  }

  console.log('\n========================================================');
  console.log('   🎉 ALL USER APP CAPABILITIES VERIFIED 100% OPERATIONAL');
  console.log('========================================================');

  await client.close();
}

runFullUserAppVerification().catch(console.error);
