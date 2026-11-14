/**
 * db.js - Dual-Layer Database Manager:
 * 1. Cloud Mode: MongoDB Atlas via Netlify Serverless API (/api)
 * 2. Local Fallback: IndexedDB + LocalStorage (offline / local preview)
 */

const DB_NAME = 'RewardsDB';
const DB_VERSION = 2;

class UnifiedDatabaseService {
  constructor() {
    this.db = null;
    this.isCloudAvailable = false;
    this.apiBase = this.detectApiBase();
    this.initPromise = this.init();
  }

  detectApiBase() {
    if (window.location.protocol.startsWith('http')) {
      return '/api';
    }
    return null;
  }

  async init() {
    // 1. Quick probe to check if Cloud API is responding (max 1.5s timeout)
    if (this.apiBase) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${this.apiBase}/status`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'connected') {
            this.isCloudAvailable = true;
            console.log('✅ Connected to MongoDB Atlas Cloud Database:', data.dbName);
          }
        }
      } catch (e) {
        console.warn('MongoDB Atlas API not reachable, falling back to local storage.');
      }
    }

    // 2. Initialize local IndexedDB with safety timeout to prevent tab blocking
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      // 2-second safety timeout so init never hangs
      setTimeout(() => safeResolve(this.db), 2000);

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onblocked = () => {
          console.warn('IndexedDB blocked by another open tab. Using fallback.');
          safeResolve(null);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'phone' });
          } else {
            const userStore = event.target.transaction.objectStore('users');
            if (userStore.indexNames.contains('email')) {
              userStore.deleteIndex('email');
            }
          }

          if (!db.objectStoreNames.contains('rewards')) {
            const rewardStore = db.createObjectStore('rewards', { keyPath: 'id', autoIncrement: true });
            rewardStore.createIndex('customerPhone', 'customerPhone', { unique: false });
            rewardStore.createIndex('orderId', 'orderId', { unique: false });
            rewardStore.createIndex('expiryDate', 'expiryDate', { unique: false });
          }
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          this.db.onversionchange = () => {
            if (this.db) this.db.close();
          };
          await this.seedInitialLocalData();
          safeResolve(this.db);
        };

        request.onerror = (event) => {
          console.error('IndexedDB error:', event.target.error);
          safeResolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB unavailable, using localStorage fallback');
        safeResolve(null);
      }
    });
  }

  async seedInitialLocalData() {
    try {
      const users = await this.getAllUsers();
      if (users.length === 0) {
        const demoUser = {
          name: 'Rahul Sharma',
          phone: '9876543210',
          password: 'password123',
          createdAt: new Date().toISOString()
        };
        await this.registerUser(demoUser);

        const sampleSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ededed"/><text x="50" y="55" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23666" text-anchor="middle">PHONE</text></svg>';

        const initialReward = {
          customerName: 'Rahul Sharma',
          customerPhone: '9876543210',
          orderId: 'ORD-15000-A',
          productName: 'Android Smartphone Pro 5G',
          orderDate: '2026-11-12',
          orderAmount: 15000,
          rewardPercent: 10,
          rewardPoints: 1500,
          expiryDate: '2026-12-31T23:59',
          cappingPercent: 50,
          minOrderAmount: 10000,
          productImage: sampleSvg,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        };
        await this.createReward(initialReward);
      }
    } catch (e) {}
  }

  // 1. Customer Registration
  async registerUser(userData) {
    await this.initPromise;

    // Try Cloud MongoDB Atlas first
    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Registration failed');
        return result;
      } catch (err) {
        if (err.message && err.message.includes('already registered')) {
          throw err;
        }
        console.warn('Cloud register failed, falling back to local DB:', err.message);
      }
    }

    // Local IndexedDB Fallback
    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['users'], 'readwrite');
          const store = tx.objectStore('users');
          const checkReq = store.get(userData.phone);

          checkReq.onsuccess = () => {
            if (checkReq.result) {
              reject(new Error(`Phone number ${userData.phone} is already registered. Please Sign In.`));
              return;
            }
            const cleanUser = {
              name: userData.name,
              phone: userData.phone,
              password: userData.password,
              createdAt: new Date().toISOString()
            };
            const addReq = store.add(cleanUser);
            addReq.onsuccess = () => resolve(cleanUser);
            addReq.onerror = () => reject(addReq.error || new Error('Could not save user'));
          };
          checkReq.onerror = () => reject(checkReq.error);
        } catch (e) {
          reject(e);
        }
      });
    }

    // LocalStorage Fallback (if IndexedDB is blocked)
    const localUsers = JSON.parse(localStorage.getItem('wf_local_users') || '[]');
    if (localUsers.some(u => u.phone === userData.phone)) {
      throw new Error(`Phone number ${userData.phone} is already registered. Please Sign In.`);
    }
    const cleanUser = {
      name: userData.name,
      phone: userData.phone,
      password: userData.password,
      createdAt: new Date().toISOString()
    };
    localUsers.push(cleanUser);
    localStorage.setItem('wf_local_users', JSON.stringify(localUsers));
    return cleanUser;
  }

  // 2. Customer Login
  async loginUser(phone, password) {
    await this.initPromise;

    // Try Cloud MongoDB Atlas
    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });
        const user = await res.json();
        if (!res.ok) throw new Error(user.error || 'Invalid phone number or password');
        this.setCurrentUser(user);
        return user;
      } catch (err) {
        console.warn('Cloud login failed, checking local DB:', err.message);
      }
    }

    // Local IndexedDB Fallback
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['users'], 'readonly');
        const store = tx.objectStore('users');
        const req = store.get(phone);

        req.onsuccess = () => {
          const user = req.result;
          if (user && user.password === password) {
            this.setCurrentUser(user);
            resolve(user);
          } else {
            reject(new Error('Invalid phone number or password.'));
          }
        };
        req.onerror = () => reject(req.error);
      });
    }

    // LocalStorage Fallback
    const localUsers = JSON.parse(localStorage.getItem('wf_local_users') || '[]');
    const found = localUsers.find(u => u.phone === phone && u.password === password);
    if (found) {
      this.setCurrentUser(found);
      return found;
    }
    throw new Error('Invalid phone number or password.');
  }

  // 3. Create Reward Points (Admin)
  async createReward(rewardData) {
    await this.initPromise;

    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/rewards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rewardData)
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.error || 'Failed to issue reward');
        return created;
      } catch (err) {
        console.warn('Cloud create reward failed, saving locally:', err.message);
      }
    }

    // Local IndexedDB Fallback
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['rewards'], 'readwrite');
        const store = tx.objectStore('rewards');
        const payload = {
          ...rewardData,
          orderAmount: Number(rewardData.orderAmount) || 0,
          rewardPoints: Number(rewardData.rewardPoints) || 0,
          rewardPercent: Number(rewardData.rewardPercent) || 0,
          cappingPercent: Number(rewardData.cappingPercent) || 50,
          minOrderAmount: Number(rewardData.minOrderAmount) || 0,
          createdAt: new Date().toISOString()
        };
        const req = store.add(payload);
        req.onsuccess = () => {
          payload.id = req.result;
          resolve(payload);
        };
        req.onerror = () => reject(req.error);
      });
    }

    // LocalStorage Fallback
    const localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    const payload = {
      ...rewardData,
      id: Date.now(),
      orderAmount: Number(rewardData.orderAmount) || 0,
      rewardPoints: Number(rewardData.rewardPoints) || 0,
      rewardPercent: Number(rewardData.rewardPercent) || 0,
      cappingPercent: Number(rewardData.cappingPercent) || 50,
      minOrderAmount: Number(rewardData.minOrderAmount) || 0,
      createdAt: new Date().toISOString()
    };
    localRewards.push(payload);
    localStorage.setItem('wf_local_rewards', JSON.stringify(localRewards));
    return payload;
  }

  // 4. Get Customer Rewards
  async getRewardsByPhone(phone) {
    await this.initPromise;
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/rewards?phone=${encodeURIComponent(cleanPhone)}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Cloud fetch rewards failed, reading local DB:', err.message);
      }
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['rewards'], 'readonly');
        const store = tx.objectStore('rewards');
        const index = store.index('customerPhone');
        const req = index.getAll(cleanPhone);

        req.onsuccess = () => {
          const rewards = req.result || [];
          rewards.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          resolve(rewards);
        };
        req.onerror = () => reject(req.error);
      });
    }

    const localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    return localRewards.filter(r => (String(r.customerPhone || '').replace(/\D/g, '').slice(-10)) === cleanPhone);
  }

  // 5. Get All Rewards (Admin Feed)
  async getAllRewards() {
    await this.initPromise;

    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/rewards`);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Cloud fetch all rewards failed, reading local DB:', err.message);
      }
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['rewards'], 'readonly');
        const store = tx.objectStore('rewards');
        const req = store.getAll();

        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    return JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
  }

  // 6. Delete Reward
  async deleteReward(id) {
    await this.initPromise;

    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/rewards?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Cloud delete failed, deleting locally:', err.message);
      }
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['rewards'], 'readwrite');
        const store = tx.objectStore('rewards');
        const req = store.delete(Number(id) || id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }

    let localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    localRewards = localRewards.filter(r => r.id != id);
    localStorage.setItem('wf_local_rewards', JSON.stringify(localRewards));
    return true;
  }

  // 7. Get All Users
  async getAllUsers() {
    await this.initPromise;

    if (this.isCloudAvailable) {
      try {
        const res = await fetch(`${this.apiBase}/users`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['users'], 'readonly');
        const store = tx.objectStore('users');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    return JSON.parse(localStorage.getItem('wf_local_users') || '[]');
  }

  // Session
  setCurrentUser(user) {
    const safeUser = { name: user.name, phone: user.phone };
    localStorage.setItem('active_customer', JSON.stringify(safeUser));
  }

  getCurrentUser() {
    const stored = localStorage.getItem('active_customer');
    if (!stored) {
      return { name: 'Rahul Sharma', phone: '9876543210' };
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      return { name: 'Rahul Sharma', phone: '9876543210' };
    }
  }

  logoutUser() {
    localStorage.removeItem('active_customer');
  }
}

// Global database instance
window.rewardsDB = new UnifiedDatabaseService();
