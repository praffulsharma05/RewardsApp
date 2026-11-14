/**
 * Netlify Serverless Function: api.js
 * Connects directly to MongoDB Atlas cluster
 */

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const { MongoClient, ObjectId } = require('mongodb');

// Direct MongoDB Atlas URI (No .env file dependency)
const MONGODB_URI = 'mongodb+srv://sharmaprafful646_db_user:sIC4U5XtGaQp88I3@cluster0.dslqlyg.mongodb.net/rewardsDB?retryWrites=true&w=majority';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is empty');
  }
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('rewardsDB');
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const rewardsCollection = db.collection('rewards');

    const path = event.path.replace(/\/?\.netlify\/functions\/api\/?/, '').replace(/^\/?api\/?/, '').replace(/^\/+/, '');
    const segments = path.split('/').filter(Boolean);
    const resource = segments[0] || '';
    const method = event.httpMethod;

    if (resource === 'status' || resource === '') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'connected', database: 'MongoDB Atlas', dbName: 'rewardsDB' })
      };
    }

    if (resource === 'register' && method === 'POST') {
      const data = JSON.parse(event.body || '{}');
      if (!data.name || !data.phone || !data.password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name, phone and password required' }) };
      }
      const existing = await usersCollection.findOne({ phone: data.phone });
      if (existing) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'This phone number is already registered.' }) };
      }
      const newUser = {
        name: data.name,
        phone: data.phone,
        password: data.password,
        createdAt: new Date().toISOString()
      };
      await usersCollection.insertOne(newUser);
      return { statusCode: 201, headers, body: JSON.stringify(newUser) };
    }

    if (resource === 'login' && method === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const user = await usersCollection.findOne({ phone: data.phone, password: data.password });
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid phone number or password.' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ name: user.name, phone: user.phone }) };
    }

    if (resource === 'rewards') {
      if (method === 'GET') {
        const phone = event.queryStringParameters && event.queryStringParameters.phone;
        const query = phone ? { customerPhone: phone } : {};
        const list = await rewardsCollection.find(query).sort({ createdAt: -1 }).toArray();
        const formatted = list.map(item => ({
          ...item,
          id: item._id.toString()
        }));
        return { statusCode: 200, headers, body: JSON.stringify(formatted) };
      }

      if (method === 'POST') {
        const data = JSON.parse(event.body || '{}');
        const rewardDoc = {
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          orderId: data.orderId,
          productName: data.productName,
          orderDate: data.orderDate,
          orderAmount: Number(data.orderAmount) || 0,
          rewardPercent: Number(data.rewardPercent) || 0,
          rewardPoints: Number(data.rewardPoints) || 0,
          expiryDate: data.expiryDate,
          cappingPercent: Number(data.cappingPercent) || 50,
          minOrderAmount: Number(data.minOrderAmount) || 0,
          productImage: data.productImage || '',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        };
        const result = await rewardsCollection.insertOne(rewardDoc);
        rewardDoc.id = result.insertedId.toString();
        return { statusCode: 201, headers, body: JSON.stringify(rewardDoc) };
      }

      if (method === 'DELETE') {
        const id = event.queryStringParameters && event.queryStringParameters.id;
        if (!id) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Reward ID is required' }) };
        }
        await rewardsCollection.deleteOne({ _id: new ObjectId(id) });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (resource === 'users' && method === 'GET') {
      const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
      return { statusCode: 200, headers, body: JSON.stringify(users) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint not found' }) };
  } catch (err) {
    console.error('API Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
