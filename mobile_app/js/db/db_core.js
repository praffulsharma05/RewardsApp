/**
 * db.js - IndexedDB Mock API Layer for Mobile Slot Booking Wireframe
 * Mocks asynchronous backend APIs with IndexedDB persistence.
 */

const DB_NAME = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DB?.NAME) || "SportsSlotWireframeDB";
const DB_VERSION = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DB?.VERSION) || 1;

class MockAPI {
  constructor() {
    this.db = null;
  }

  // Initialize IndexedDB and seed initial data if empty
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Settings Store (Admin configurable reward x%)
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        // Users Store
        if (!db.objectStoreNames.contains("users")) {
          const userStore = db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
          userStore.createIndex("email", "email", { unique: true });
        }

        // Sports Store
        if (!db.objectStoreNames.contains("sports")) {
          db.createObjectStore("sports", { keyPath: "id", autoIncrement: true });
        }

        // Courts Store
        if (!db.objectStoreNames.contains("courts")) {
          const courtStore = db.createObjectStore("courts", { keyPath: "id", autoIncrement: true });
          courtStore.createIndex("sport_id", "sport_id", { unique: false });
        }

        // Slots Store
        if (!db.objectStoreNames.contains("slots")) {
          const slotStore = db.createObjectStore("slots", { keyPath: "id", autoIncrement: true });
          slotStore.createIndex("court_id", "court_id", { unique: false });
        }

        // Bookings Store
        if (!db.objectStoreNames.contains("bookings")) {
          const bookingStore = db.createObjectStore("bookings", { keyPath: "id", autoIncrement: true });
          bookingStore.createIndex("user_id", "user_id", { unique: false });
          bookingStore.createIndex("slot_court_date", ["court_id", "date", "slot_id"], { unique: false });
        }

        // Wallet Ledger Store
        if (!db.objectStoreNames.contains("wallet_ledger")) {
          const ledgerStore = db.createObjectStore("wallet_ledger", { keyPath: "id", autoIncrement: true });
          ledgerStore.createIndex("user_id", "user_id", { unique: false });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this._seedInitialData();
        resolve(this);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Core IndexedDB Async Helpers ---
  _tx(storeName, mode = "readonly") {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  async _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, "readonly").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _getAll(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, "readonly").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async _put(storeName, value) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, "readwrite").put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, "readwrite").delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Simulate network latency for mock API calls
  async _simulateDelay(ms = 80) {
    return new Promise(r => setTimeout(r, ms));
  }
}

window.MockAPI = MockAPI;
