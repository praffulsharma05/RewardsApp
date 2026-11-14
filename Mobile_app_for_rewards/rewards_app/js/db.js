/**
 * db.js - Client-Side Database Manager using Browser IndexedDB
 * Primary Store: IndexedDB (RewardsDB v2)
 * Fallback: LocalStorage (if IndexedDB is restricted or in private browsing)
 */

const DB_NAME = 'RewardsDB';
const DB_VERSION = 2;

class UnifiedDatabaseService {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      // 1.5-second safety timeout so init never hangs under tab lock
      setTimeout(() => safeResolve(this.db), 1500);

      try {
        if (!window.indexedDB) {
          console.warn('IndexedDB not supported in this browser. Using LocalStorage fallback.');
          safeResolve(null);
          return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onblocked = () => {
          console.warn('IndexedDB blocked by another open tab. Proceeding with fallback.');
          safeResolve(null);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Users Store (keyed by phone number)
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'phone' });
          } else {
            const userStore = event.target.transaction.objectStore('users');
            if (userStore.indexNames.contains('email')) {
              userStore.deleteIndex('email');
            }
          }

          // Rewards Store (auto-incrementing ID)
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
          console.log('✅ IndexedDB Initialized Successfully (RewardsDB v2)');
          await this.seedInitialData();
          safeResolve(this.db);
        };

        request.onerror = (event) => {
          console.error('IndexedDB open error:', event.target.error);
          safeResolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization failed. Using LocalStorage fallback.', err);
        safeResolve(null);
      }
    });
  }

  // Pre-seed demo customer & reward if database is empty
  async seedInitialData() {
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
    } catch (e) {
      console.warn('Could not seed initial data:', e);
    }
  }

  // 1. Customer Registration (IndexedDB)
  async registerUser(userData) {
    await this.initPromise;
    const cleanPhone = String(userData.phone || '').replace(/\D/g, '').slice(-10);

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['users'], 'readwrite');
          const store = tx.objectStore('users');
          const checkReq = store.get(cleanPhone);

          checkReq.onsuccess = () => {
            if (checkReq.result) {
              reject(new Error(`Phone number ${cleanPhone} is already registered. Please Sign In.`));
              return;
            }
            const cleanUser = {
              name: userData.name,
              phone: cleanPhone,
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

    // LocalStorage Fallback
    const localUsers = JSON.parse(localStorage.getItem('wf_local_users') || '[]');
    if (localUsers.some(u => u.phone === cleanPhone)) {
      throw new Error(`Phone number ${cleanPhone} is already registered. Please Sign In.`);
    }
    const cleanUser = {
      name: userData.name,
      phone: cleanPhone,
      password: userData.password,
      createdAt: new Date().toISOString()
    };
    localUsers.push(cleanUser);
    localStorage.setItem('wf_local_users', JSON.stringify(localUsers));
    return cleanUser;
  }

  // 2. Customer Login (IndexedDB)
  async loginUser(phone, password) {
    await this.initPromise;
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['users'], 'readonly');
          const store = tx.objectStore('users');
          const req = store.get(cleanPhone);

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
        } catch (e) {
          reject(e);
        }
      });
    }

    // LocalStorage Fallback
    const localUsers = JSON.parse(localStorage.getItem('wf_local_users') || '[]');
    const found = localUsers.find(u => u.phone === cleanPhone && u.password === password);
    if (found) {
      this.setCurrentUser(found);
      return found;
    }
    throw new Error('Invalid phone number or password.');
  }

  // 3. Create Reward Points (Admin -> IndexedDB)
  async createReward(rewardData) {
    await this.initPromise;
    const cleanPhone = String(rewardData.customerPhone || '').replace(/\D/g, '').slice(-10);

    const payload = {
      ...rewardData,
      customerPhone: cleanPhone,
      orderAmount: Number(rewardData.orderAmount) || 0,
      rewardPoints: Number(rewardData.rewardPoints) || 0,
      rewardPercent: Number(rewardData.rewardPercent) || 0,
      cappingPercent: Number(rewardData.cappingPercent) || 50,
      minOrderAmount: Number(rewardData.minOrderAmount) || 0,
      productImage: rewardData.productImage || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['rewards'], 'readwrite');
          const store = tx.objectStore('rewards');
          const req = store.add(payload);

          req.onsuccess = () => {
            payload.id = req.result;
            resolve(payload);
          };
          req.onerror = () => reject(req.error || new Error('Could not save reward'));
        } catch (e) {
          reject(e);
        }
      });
    }

    // LocalStorage Fallback
    const localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    payload.id = Date.now();
    localRewards.push(payload);
    localStorage.setItem('wf_local_rewards', JSON.stringify(localRewards));
    return payload;
  }

  // 4. Get Customer Rewards by Phone (Customer Wallet -> IndexedDB)
  async getRewardsByPhone(phone) {
    await this.initPromise;
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
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
        } catch (e) {
          reject(e);
        }
      });
    }

    // LocalStorage Fallback
    const localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    return localRewards
      .filter(r => (String(r.customerPhone || '').replace(/\D/g, '').slice(-10)) === cleanPhone)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  // 5. Get All Rewards (Admin Feed -> IndexedDB)
  async getAllRewards() {
    await this.initPromise;

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['rewards'], 'readonly');
          const store = tx.objectStore('rewards');
          const req = store.getAll();

          req.onsuccess = () => {
            const list = req.result || [];
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            resolve(list);
          };
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      });
    }

    // LocalStorage Fallback
    const localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    return localRewards.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  // 6. Delete Reward (Admin -> IndexedDB)
  async deleteReward(id) {
    await this.initPromise;

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['rewards'], 'readwrite');
          const store = tx.objectStore('rewards');
          const req = store.delete(Number(id) || id);

          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      });
    }

    // LocalStorage Fallback
    let localRewards = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    localRewards = localRewards.filter(r => r.id != id);
    localStorage.setItem('wf_local_rewards', JSON.stringify(localRewards));
    return true;
  }

  // 7. Get All Users (Admin User Count -> IndexedDB)
  async getAllUsers() {
    await this.initPromise;

    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['users'], 'readonly');
          const store = tx.objectStore('users');
          const req = store.getAll();

          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      });
    }

    return JSON.parse(localStorage.getItem('wf_local_users') || '[]');
  }

  // Session Management (Active Customer)
  setCurrentUser(user) {
    const cleanPhone = String(user.phone || '').replace(/\D/g, '').slice(-10);
    const safeUser = { name: user.name, phone: cleanPhone };
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

// Global database instance available to all screens
window.rewardsDB = new UnifiedDatabaseService();
