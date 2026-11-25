/**
 * db.js - IndexedDB Mock API Layer for Mobile Slot Booking Wireframe
 * Mocks asynchronous backend APIs with IndexedDB persistence.
 */

const DB_NAME = "SportsSlotWireframeDB";
const DB_VERSION = 1;

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

  // Seed default dataset if database is newly created
  async _seedInitialData() {
    // 1. Admin Setting: Default 10% Reward
    const currentRate = await this._get("settings", "reward_percent");
    if (!currentRate) {
      await this._put("settings", { key: "reward_percent", value: 10 });
    }

    // Cancellation Cutoff Hours Setting (Default: 12 Hours)
    const currentCutoff = await this._get("settings", "cancellation_cutoff_hours");
    if (!currentCutoff) {
      await this._put("settings", { key: "cancellation_cutoff_hours", value: 12 });
    }

    // Slot Change / Reschedule Cutoff Hours Setting (Default: 12 Hours)
    const currentRescheduleCutoff = await this._get("settings", "reschedule_cutoff_hours");
    if (!currentRescheduleCutoff) {
      await this._put("settings", { key: "reschedule_cutoff_hours", value: 12 });
    }

    // Default Cancellation Refund Percentage Setting (Default: 100%)
    const currentRefundPct = await this._get("settings", "default_refund_percent");
    if (!currentRefundPct) {
      await this._put("settings", { key: "default_refund_percent", value: 100 });
    }

    // Admin Setting: Max Wallet Deduction Ratio for Slot Upgrades (Default: 100%)
    const currentUpgradeRatio = await this._get("settings", "wallet_upgrade_ratio");
    if (!currentUpgradeRatio) {
      await this._put("settings", { key: "wallet_upgrade_ratio", value: 100 });
    }

    // Admin Setting: Reward Expiry Validity Days (Default: 60 Days)
    const currentRewardExpiry = await this._get("settings", "reward_expiry_days");
    if (!currentRewardExpiry) {
      await this._put("settings", { key: "reward_expiry_days", value: 60 });
    }

    // Admin Setting: Highest Limit of Discount (Default: 30% Cap)
    const currentMaxDiscount = await this._get("settings", "max_discount_percent");
    if (!currentMaxDiscount) {
      await this._put("settings", { key: "max_discount_percent", value: 30 });
    }

    // Admin Setting: Playground & Academy Time-Window Unavailability (e.g. 10 AM to 5 PM)
    const currentUnavail = await this._get("settings", "playground_unavailabilities");
    if (!currentUnavail) {
      await this._put("settings", {
        key: "playground_unavailabilities",
        list: [
          {
            id: 1,
            court_id: 1,
            court_name: "Table 1 (Pro Stiga Arena)",
            start_time: "10:00",
            end_time: "17:00",
            date: "ALL_DAYS",
            reason: "Academy Coaching Session (10 AM - 5 PM)"
          },
          {
            id: 2,
            court_id: 0,
            court_name: "All Academy Grounds",
            start_time: "10:00",
            end_time: "17:00",
            date: "2026-11-15",
            reason: "Junior Academy Tournament (10 AM - 5 PM)"
          }
        ]
      });
    }

    // 2. Default User
    const existingUsers = await this._getAll("users");
    if (existingUsers.length === 0) {
      await this._put("users", {
        id: 1,
        name: "Alex Morgan",
        email: "alex.morgan@sportsmail.com",
        phone: "+1-555-0199",
        password: "password123",
        wallet_balance: 15.00
      });
      // Initial wallet history
      await this._put("wallet_ledger", {
        id: 1,
        user_id: 1,
        booking_id: null,
        type: "WELCOME_BONUS",
        description: "Welcome sign up sports credits",
        amount: 15.00,
        expires_at: new Date(Date.now() + 58 * 86400000).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
      });
    }

    // 3. Sports (Table Tennis prominently featured)
    const existingSports = await this._getAll("sports");
    if (existingSports.length === 0) {
      const sports = [
        { id: 1, name: "Table Tennis", category: "Indoor", courts_count: 4, icon: "[TT]" },
        { id: 2, name: "Badminton", category: "Indoor", courts_count: 2, icon: "[BD]" },
        { id: 3, name: "Tennis", category: "Outdoor", courts_count: 2, icon: "[TN]" },
        { id: 4, name: "Squash", category: "Indoor", courts_count: 2, icon: "[SQ]" },
        { id: 5, name: "Football", category: "Outdoor", courts_count: 2, icon: "[FB]" }
      ];
      for (const s of sports) await this._put("sports", s);

      // 4. Courts for Table Tennis, Football, and other sports
      const courts = [
        { id: 1, sport_id: 1, name: "Table 1 (Pro Stiga Arena)", surface: "Olympic Hardwood", status: "Active" },
        { id: 2, sport_id: 1, name: "Table 2 (Donic Match Table)", surface: "Tournament Synthetic", status: "Active" },
        { id: 3, sport_id: 1, name: "Table 3 (Joola Club Table)", surface: "Club Rubber", status: "Active" },
        { id: 4, sport_id: 1, name: "Table 4 (ButterFly Training)", surface: "Standard Wood", status: "Active" },
        { id: 5, sport_id: 2, name: "Badminton Court A", surface: "Wooden Parquet", status: "Active" },
        { id: 6, sport_id: 2, name: "Badminton Court B", surface: "Synthetic Mat", status: "Active" },
        { id: 7, sport_id: 3, name: "Tennis Court 1", surface: "Clay Court", status: "Active" },
        { id: 8, sport_id: 4, name: "Squash Glass Court", surface: "Glass Back Wood", status: "Active" },
        { id: 9, sport_id: 5, name: "Football Turf Ground A (FIFA Pro)", surface: "Artificial Turf", status: "Active" },
        { id: 10, sport_id: 5, name: "Football Ground B (7-a-side Arena)", surface: "Natural Grass", status: "Active" }
      ];
      for (const c of courts) await this._put("courts", c);

      // 5. Daily Slots Template per Court
      let slotIdCounter = 1;
      const times = [
        { start: "08:00", end: "09:00", price: 20 },
        { start: "09:00", end: "10:00", price: 20 },
        { start: "10:00", end: "11:00", price: 25 },
        { start: "11:00", end: "12:00", price: 25 },
        { start: "14:00", end: "15:00", price: 25 },
        { start: "16:00", end: "17:00", price: 30 },
        { start: "17:00", end: "18:00", price: 35 },
        { start: "18:00", end: "19:00", price: 35 },
        { start: "19:00", end: "20:00", price: 40 },
        { start: "20:00", end: "21:00", price: 40 },
        { start: "21:00", end: "22:00", price: 45 },
        { start: "22:00", end: "23:00", price: 45 }
      ];
      for (const c of courts) {
        for (const t of times) {
          await this._put("slots", {
            id: slotIdCounter++,
            court_id: c.id,
            start_time: t.start,
            end_time: t.end,
            price: t.price
          });
        }
      }
    }



    // Ensure Football & its grounds are present even if previous DB version was already seeded
    const checkSports = await this._getAll("sports");
    const hasFootball = checkSports.some(s => s.name && s.name.toLowerCase().includes("football"));
    if (!hasFootball && checkSports.length > 0) {
      const footballSport = { id: 5, name: "Football", category: "Outdoor", courts_count: 2, icon: "[FB]" };
      await this._put("sports", footballSport);
      const footballCourts = [
        { id: 9, sport_id: 5, name: "Football Turf Ground A (FIFA Pro)", surface: "Artificial Turf", status: "Active" },
        { id: 10, sport_id: 5, name: "Football Ground B (7-a-side Arena)", surface: "Natural Grass", status: "Active" }
      ];
      for (const fc of footballCourts) {
        await this._put("courts", fc);
        const fbTimes = [
          { start: "08:00", end: "09:00", price: 40 },
          { start: "09:00", end: "10:00", price: 40 },
          { start: "10:00", end: "11:00", price: 50 },
          { start: "11:00", end: "12:00", price: 50 },
          { start: "14:00", end: "15:00", price: 50 },
          { start: "16:00", end: "17:00", price: 60 },
          { start: "17:00", end: "18:00", price: 70 },
          { start: "18:00", end: "19:00", price: 75 },
          { start: "19:00", end: "20:00", price: 80 },
          { start: "20:00", end: "21:00", price: 80 },
          { start: "21:00", end: "22:00", price: 85 },
          { start: "22:00", end: "23:00", price: 85 }
        ];
        let fbSlotCounter = 1000 + fc.id * 50;
        for (const t of fbTimes) {
          await this._put("slots", {
            id: fbSlotCounter++,
            court_id: fc.id,
            start_time: t.start,
            end_time: t.end,
            price: t.price
          });
        }
      }
    }

    // Facility Open/Closed Status Setting
    const currentFacilityStatus = await this._get("settings", "facility_status");
    if (!currentFacilityStatus) {
      await this._put("settings", { key: "facility_status", isOpen: true, reason: "Normal Operations" });
    }

    // Seed Sample Bookings if empty (Demonstrates 12h cutoff rule & manual admin refund flow)
    const existingBookings = await this._getAll("bookings");
    if (existingBookings.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      // 1. Confirmed booking tomorrow (Eligible for cancellation > 12h)
      await this._put("bookings", {
        id: 101,
        user_id: 1,
        sport_id: 1,
        sport_name: "Table Tennis",
        court_id: 1,
        court_name: "Table 1 (Pro Stiga Arena)",
        slot_id: 9,
        start_time: "19:00",
        end_time: "20:00",
        date: tomorrowStr,
        price: 40.00,
        wallet_applied: 0,
        net_paid: 40.00,
        reward_percent: 10,
        reward_amount: 4.00,
        status: "CONFIRMED",
        created_at: new Date().toISOString()
      });

      // 2. Sample Cancelled booking awaiting Admin Refund
      await this._put("bookings", {
        id: 102,
        user_id: 1,
        sport_id: 2,
        sport_name: "Badminton",
        court_id: 5,
        court_name: "Badminton Court A",
        slot_id: 56,
        start_time: "18:00",
        end_time: "19:00",
        date: tomorrowStr,
        price: 35.00,
        wallet_applied: 0,
        net_paid: 35.00,
        reward_percent: 10,
        reward_amount: 3.50,
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
        hours_before_slot: 24.0,
        refund_status: "PENDING",
        refund_amount: 0,
        admin_refund_note: "",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
      });
    }

    // Auto-remove target user if present in local IndexedDB: Divya (#4 / ShubraSingh8369@gmail.com)
    const allExistingUsers = await this._getAll("users");
    const targetUser = allExistingUsers.find(u => 
      u.id === 4 || 
      (u.email && u.email.toLowerCase() === "shubrasingh8369@gmail.com") ||
      (u.name && u.name.toLowerCase() === "divya")
    );
    if (targetUser) {
      await this.deleteUser(targetUser.id);
    }
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

  // --- Simulated API Endpoints (with async latency) ---

  // Admin Settings: Get & Set Reward Percentage
  async getRewardRate() {
    await this._simulateDelay(40);
    const item = await this._get("settings", "reward_percent");
    return item ? Number(item.value) : 10;
  }

  async setRewardRate(percentage) {
    await this._simulateDelay(80);
    const parsed = Math.max(0, Math.min(100, Number(percentage)));
    await this._put("settings", { key: "reward_percent", value: parsed });
    return parsed;
  }

  // Admin Settings: Cancellation Cutoff Time Window (e.g. 12 Hours before slot)
  async getCancellationCutoffHours() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "cancellation_cutoff_hours");
    return item ? Number(item.value) : 12;
  }

  async setCancellationCutoffHours(hours) {
    await this._simulateDelay(80);
    const parsed = Math.max(1, Math.min(168, Number(hours)));
    await this._put("settings", { key: "cancellation_cutoff_hours", value: parsed });
    return parsed;
  }

  // Admin Settings: Default Cancellation Refund Rate (e.g. 100%, 80%, 50%)
  async getDefaultRefundPercent() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "default_refund_percent");
    return item ? Number(item.value) : 100;
  }

  async setDefaultRefundPercent(pct) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(100, Number(pct)));
    await this._put("settings", { key: "default_refund_percent", value: parsed });
    return parsed;
  }

  // Check if booking is eligible for cancellation against admin cutoff rule & calculate refund rate
  async checkCancellationEligibility(booking) {
    const cutoff = await this.getCancellationCutoffHours();
    const defaultRefundPct = await this.getDefaultRefundPercent();
    const dateStr = booking.date;
    const timeStr = booking.start_time || "00:00";
    const slotDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const now = new Date();
    const diffHours = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isPast = diffHours <= 0;
    const isEligible = !isPast && (diffHours >= cutoff);
    const estimatedRefund = Number(((Number(booking.price) * defaultRefundPct) / 100).toFixed(2));

    let reason = "";
    if (isPast) {
      reason = "Cannot cancel: This slot time has already passed (Game Completed).";
    } else if (isEligible) {
      reason = `Eligible for cancellation (${diffHours.toFixed(1)} hrs left >= ${cutoff} hrs cutoff). Policy refund rate: ${defaultRefundPct}% ($${estimatedRefund.toFixed(2)}).`;
    } else {
      reason = `Cannot cancel: Only ${diffHours > 0 ? diffHours.toFixed(1) + ' hrs' : '0 hrs (past)'} remaining before slot start. Facility rule requires at least ${cutoff} hours notice.`;
    }

    return {
      isEligible,
      isPast,
      diffHours: Number(diffHours.toFixed(1)),
      cutoffHours: cutoff,
      defaultRefundPct: defaultRefundPct,
      estimatedRefund: estimatedRefund,
      slotDateTimeStr: `${dateStr} ${timeStr}`,
      reason
    };
  }

  // Admin Settings: Slot Change / Reschedule Cutoff Time Window (X Hours before slot)
  async getRescheduleCutoffHours() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "reschedule_cutoff_hours");
    return item ? Number(item.value) : 12;
  }

  async setRescheduleCutoffHours(hours) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(168, Number(hours)));
    await this._put("settings", { key: "reschedule_cutoff_hours", value: parsed });
    return parsed;
  }

  // Check if booking is eligible for slot change/reschedule against admin cutoff rule
  async checkRescheduleEligibility(booking) {
    const cutoff = await this.getRescheduleCutoffHours();
    const dateStr = booking.date;
    const timeStr = booking.start_time || "00:00";
    const slotDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const now = new Date();
    const diffHours = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isPast = diffHours <= 0;
    const isEligible = !isPast && (diffHours >= cutoff);

    let reason = "";
    if (isPast) {
      reason = "Cannot change slot: This game/slot has already passed (Game Completed).";
    } else if (isEligible) {
      reason = `Eligible for slot change (${diffHours.toFixed(1)} hrs left >= ${cutoff} hrs cutoff).`;
    } else {
      reason = `Cannot change slot: Only ${diffHours > 0 ? diffHours.toFixed(1) + ' hrs' : '0 hrs (past)'} remaining before slot start. Facility rule requires at least ${cutoff} hours notice to reschedule.`;
    }

    return {
      isEligible,
      isPast,
      diffHours: Number(diffHours.toFixed(1)),
      cutoffHours: cutoff,
      slotDateTimeStr: `${dateStr} ${timeStr}`,
      reason
    };
  }

  // Admin Settings: Max Wallet Deduction Ratio for Slot Upgrades (0% - 100%)
  async getWalletUpgradeRatio() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "wallet_upgrade_ratio");
    return item ? Number(item.value) : 100;
  }

  async setWalletUpgradeRatio(ratio) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(100, Number(ratio)));
    await this._put("settings", { key: "wallet_upgrade_ratio", value: parsed });
    return parsed;
  }

  // Admin Settings: Reward Validity Expiry Period (Days: e.g. 30, 60, 90, 180, 365)
  async getRewardExpiryDays() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "reward_expiry_days");
    return item ? Number(item.value) : 60;
  }

  async setRewardExpiryDays(days) {
    await this._simulateDelay(60);
    const parsed = Math.max(1, Math.min(730, Number(days)));
    await this._put("settings", { key: "reward_expiry_days", value: parsed });
    return parsed;
  }

  // User Wallet Summary: Balance, Expiry Policy, and Earliest Expiring Credits
  async getUserWalletSummary(userId) {
    await this._simulateDelay(40);
    const user = await this._get("users", Number(userId));
    if (!user) return null;

    const expiryDays = await this.getRewardExpiryDays();
    const allLedger = await this._getAll("wallet_ledger");
    const userLedger = allLedger
      .filter(l => l.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const now = Date.now();
    let earliestExpiry = null;
    let earliestExpiringAmount = 0;

    for (const item of userLedger) {
      if (item.amount > 0 && item.expires_at) {
        const expTime = new Date(item.expires_at).getTime();
        if (expTime > now) {
          if (!earliestExpiry || expTime < new Date(earliestExpiry).getTime()) {
            earliestExpiry = item.expires_at;
            earliestExpiringAmount = item.amount;
          }
        }
      }
    }



    let daysLeft = null;
    if (earliestExpiry) {
      daysLeft = Math.max(0, Math.ceil((new Date(earliestExpiry).getTime() - now) / 86400000));
    }

    return {
      balance: user.wallet_balance || 0,
      expiryDays,
      earliestExpiry,
      earliestExpiringAmount,
      daysLeft
    };
  }

  // Admin Settings: Highest Limit of Discount (e.g. 30% Cap)
  async getMaxDiscountPercent() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "max_discount_percent");
    return item ? Number(item.value) : 30;
  }

  async setMaxDiscountPercent(percent) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(100, Number(percent)));
    await this._put("settings", { key: "max_discount_percent", value: parsed });
    return parsed;
  }

  // Admin Settings: Playground & Academy Time-Window Unavailability (e.g. 10:00 to 17:00)
  async getPlaygroundUnavailabilities() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "playground_unavailabilities");
    return (item && Array.isArray(item.list)) ? item.list : [];
  }

  async addPlaygroundUnavailability({ court_id, courtId, sport_id, sportId, court_name, courtName, start_time, startTime, end_time, endTime, date, reason }) {
    await this._simulateDelay(60);
    const item = await this._get("settings", "playground_unavailabilities") || { key: "playground_unavailabilities", list: [] };
    const list = Array.isArray(item.list) ? item.list : [];
    const nextId = list.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;

    const resolvedCourtId = Number(courtId != null ? courtId : (court_id != null ? court_id : 0));
    const resolvedSportId = Number(sportId != null ? sportId : (sport_id != null ? sport_id : 0));
    const resolvedStartTime = startTime || start_time || "10:00";
    const resolvedEndTime = endTime || end_time || "17:00";
    let resolvedCourtName = courtName || court_name;
    if (!resolvedCourtName) {
      if (resolvedCourtId === 0 && resolvedSportId > 0) resolvedCourtName = `All Sport #${resolvedSportId} Grounds`;
      else if (resolvedCourtId === 0) resolvedCourtName = "All Academy Grounds (Entire Facility)";
      else resolvedCourtName = `Court #${resolvedCourtId}`;
    }

    const newRecord = {
      id: nextId,
      court_id: resolvedCourtId,
      sport_id: resolvedSportId,
      court_name: resolvedCourtName,
      start_time: resolvedStartTime,
      end_time: resolvedEndTime,
      date: date || "ALL_DAYS",
      reason: (reason || "Academy Training (10 AM - 5 PM)").trim(),
      created_at: new Date().toISOString()
    };

    list.push(newRecord);
    await this._put("settings", { key: "playground_unavailabilities", list });
    return newRecord;
  }

  async deletePlaygroundUnavailability(id) {
    await this._simulateDelay(50);
    const item = await this._get("settings", "playground_unavailabilities") || { key: "playground_unavailabilities", list: [] };
    const list = Array.isArray(item.list) ? item.list.filter(u => u.id !== Number(id)) : [];
    await this._put("settings", { key: "playground_unavailabilities", list });
    return list;
  }

  // Check if slot falls in a blocked playground or academy unavailability window (e.g. 10:00 - 17:00)
  async checkSlotUnavailability(courtId, dateStr, startTime, endTime) {
    const list = await this.getPlaygroundUnavailabilities();
    if (list.length === 0) return { isUnavailable: false, reason: "" };

    const court = await this._get("courts", Number(courtId));
    const courtSportId = court ? court.sport_id : null;

    for (const u of list) {
      // 1. Check court match:
      let matchesCourt = false;
      const targetCourtId = Number(u.court_id || 0);
      const targetSportId = Number(u.sport_id || 0);

      if (targetCourtId !== 0) {
        // Particular playground / specific court block: MUST match exact courtId
        matchesCourt = (targetCourtId === Number(courtId));
      } else if (targetSportId !== 0) {
        // Sport-wide block: matches all grounds in this sport
        matchesCourt = (courtSportId != null && courtSportId === targetSportId);
      } else {
        // Entire facility block (All Academy Grounds)
        matchesCourt = true;
      }

      if (!matchesCourt) continue;

      // 2. Check date match (ALL_DAYS or specific date)
      const dateMatches = (u.date === "ALL_DAYS" || u.date === dateStr);
      if (!dateMatches) continue;

      // 3. Check time window overlap (e.g. 10:00 to 17:00)
      if (startTime >= u.start_time && startTime < u.end_time) {
        return {
          isUnavailable: true,
          reason: u.reason || `Academy / Ground Blocked (${u.start_time} - ${u.end_time})`
        };
      }
    }
    return { isUnavailable: false, reason: "" };
  }

  // Admin Settings: Facility Operating Status (OPEN / CLOSED)
  async getFacilityStatus() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "facility_status");
    if (!item) return { isOpen: true, reason: "Normal Operations" };
    return { isOpen: item.isOpen !== false, reason: item.reason || "Shop is closed today" };
  }

  async setFacilityStatus(isOpen, reason = "Shop is closed today") {
    await this._simulateDelay(60);
    const data = { key: "facility_status", isOpen: Boolean(isOpen), reason: reason.trim() };
    await this._put("settings", data);
    return data;
  }

  // Admin Settings: Date-Specific Blackouts (Full-day or Time-window based e.g. 14/11/2026 from 10:00 to 14:00)
  async getClosedDates() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "closed_dates");
    return (item && Array.isArray(item.dates)) ? item.dates : [];
  }

  async addClosedDate(dateStr, reason = "Facility Closed", startTime = "00:00", endTime = "24:00", isFullDay = true) {
    await this._simulateDelay(50);
    const item = await this._get("settings", "closed_dates") || { key: "closed_dates", dates: [] };
    const dates = Array.isArray(item.dates) ? [...item.dates] : [];
    const entryId = Date.now() + Math.floor(Math.random() * 1000);
    dates.push({
      id: entryId,
      date: dateStr,
      reason: (reason || "Facility Closed").trim(),
      is_full_day: Boolean(isFullDay),
      start_time: isFullDay ? "00:00" : (startTime || "10:00"),
      end_time: isFullDay ? "24:00" : (endTime || "14:00")
    });
    dates.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    await this._put("settings", { key: "closed_dates", dates });
    return dates;
  }

  async removeClosedDate(idOrDate) {
    await this._simulateDelay(50);
    const item = await this._get("settings", "closed_dates") || { key: "closed_dates", dates: [] };
    const dates = Array.isArray(item.dates) 
      ? item.dates.filter(d => d.id !== Number(idOrDate) && String(d.id) !== String(idOrDate) && d.date !== idOrDate)
      : [];
    await this._put("settings", { key: "closed_dates", dates });
    return dates;
  }

  async isDateClosed(dateStr, slotStartTime = null, slotEndTime = null) {
    const closedList = await this.getClosedDates();
    const dateEntries = closedList.filter(d => d.date === dateStr);
    if (dateEntries.length === 0) {
      return { isClosed: false, isFullDay: false, reason: "" };
    }

    // 1. If slot start time is supplied, check whether this specific slot overlaps with any closure
    if (slotStartTime != null) {
      for (const d of dateEntries) {
        if (d.is_full_day !== false) {
          return { isClosed: true, isFullDay: true, start_time: "00:00", end_time: "24:00", reason: d.reason };
        }
        const sStart = d.start_time || "00:00";
        const sEnd = d.end_time || "24:00";
        // Check overlap
        if (slotStartTime >= sStart && slotStartTime < sEnd) {
          return {
            isClosed: true,
            isFullDay: false,
            start_time: sStart,
            end_time: sEnd,
            reason: d.reason || `Facility Closed (${sStart} - ${sEnd})`
          };
        }
      }
      return { isClosed: false, isFullDay: false, reason: "" };
    }

    // 2. If slot start time is NOT supplied (general date check):
    const fullMatch = dateEntries.find(d => d.is_full_day !== false);
    if (fullMatch) {
      return { isClosed: true, isFullDay: true, reason: fullMatch.reason };
    }

    // Only partial-day time closures exist on this date
    return {
      isClosed: false,
      isFullDay: false,
      hasPartialClosure: true,
      partials: dateEntries,
      reason: dateEntries.map(d => `${d.start_time || '10:00'} - ${d.end_time || '14:00'} (${d.reason})`).join(", ")
    };
  }

  // Admin Pricing: Get Unique Slot Time Tiers with Current Prices (Filtered by Sport if specified)
  async getSlotPricingOverview(sportId = null) {
    await this._simulateDelay(40);
    const allCourts = await this._getAll("courts");
    let targetCourtIds = null;
    if (sportId && sportId !== "all") {
      const courts = allCourts.filter(c => c.sport_id === Number(sportId));
      targetCourtIds = new Set(courts.map(c => c.id));
    }

    const allSlots = await this._getAll("slots");
    const map = new Map();
    for (const s of allSlots) {
      if (!targetCourtIds || targetCourtIds.has(s.court_id)) {
        const key = `${s.start_time} - ${s.end_time}`;
        const weekday = s.weekday_price != null ? Number(s.weekday_price) : Number(s.price);
        const weekend = s.weekend_price != null ? Number(s.weekend_price) : Math.round(Number(s.price) * 1.3);

        if (!map.has(key)) {
          map.set(key, { 
            start: s.start_time, 
            end: s.end_time, 
            price: s.price, 
            weekday_price: weekday, 
            weekend_price: weekend, 
            count: 1 
          });
        } else {
          map.get(key).count++;
          map.get(key).price = s.price;
          map.get(key).weekday_price = weekday;
          map.get(key).weekend_price = weekend;
        }
      }
    }


    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
  }

  // Admin Pricing: Update Day-Wise Slot Price (ALL, WEEKDAY, WEEKEND)
  async updateSlotDayWisePrice(sportId, slotVal, dayType = "ALL", newPrice) {
    await this._simulateDelay(60);
    const price = Number(newPrice);
    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;

    for (const s of allSlots) {
      if (!targetCourtIds.has(s.court_id)) continue;

      let match = false;
      if (slotVal === "all-slots") {
        match = true;
      } else {
        const [st, et] = slotVal.split("-");
        match = et ? (s.start_time === st && s.end_time === et) : (s.start_time === st);
      }

      if (match) {
        if (dayType === "WEEKDAY") {
          s.weekday_price = price;
          s.price = price;
        } else if (dayType === "WEEKEND") {
          s.weekend_price = price;
        } else {
          // ALL DAYS
          s.price = price;
          s.weekday_price = price;
          s.weekend_price = price;
        }
        await this._put("slots", s);
        count++;
      }
    }


    return count;
  }

  // Admin Pricing: Update Exact Slot Price for a Specific Game / Sport
  async updateSlotPriceForSport(sportId, startTime, endTime, newPrice) {
    await this._simulateDelay(60);
    const price = Number(newPrice);
    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;
    for (const s of allSlots) {
      if (targetCourtIds.has(s.court_id)) {
        const match = endTime 
          ? (s.start_time === startTime && s.end_time === endTime)
          : (s.start_time === startTime);
        if (match) {
          s.price = price;
          await this._put("slots", s);
          count++;
        }
      }
    }


    return count;
  }

  // Admin Pricing: Bulk Update Prices in Time Window (e.g. 18:00 to 23:00 peak hours)
  async updateSlotPriceByTimeRange(startTime, endTime, newPrice, sportId = null) {
    await this._simulateDelay(80);
    const price = Number(newPrice);
    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;
    for (const s of allSlots) {
      if (targetCourtIds.has(s.court_id) && s.start_time >= startTime && s.start_time < endTime) {
        s.price = price;
        await this._put("slots", s);
        count++;
      }
    }


    return count;
  }

  // Admin Pricing: Update Exact Slot Time Price (e.g. 18:00 - 19:00)
  async updateSpecificSlotTimePrice(startTime, endTime, newPrice, sportId = null) {
    return this.updateSlotPriceForSport(sportId, startTime, endTime, newPrice);
  }

  // User Auth APIs (Supports email, phone, and localStorage token)
  async login(identifier, password) {
    await this._simulateDelay(80);
    const users = await this._getAll("users");
    const idClean = (identifier || "").trim().toLowerCase();
    const user = users.find(u => 
      u.email.toLowerCase() === idClean || 
      (u.phone && u.phone.trim().toLowerCase() === idClean) ||
      (idClean === "alex.morgan@sportsmail.com" && u.email.toLowerCase() === "alex@sport.com") ||
      (idClean === "alex@sport.com" && u.email.toLowerCase() === "alex.morgan@sportsmail.com")
    );
    if (!user) throw new Error("Account with this email or phone does not exist.");
    if (user.password !== password) throw new Error("Invalid password credentials.");
    return { id: user.id, name: user.name, email: user.email, phone: user.phone || "+1-555-0199", wallet_balance: user.wallet_balance };
  }

  async register(name, email, password, phone = "") {
    await this._simulateDelay(100);
    const users = await this._getAll("users");
    if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const newUser = {
      name: name.trim(),
      email: email.trim(),
      phone: (phone || "").trim(),
      password,
      wallet_balance: 10.00 // 10 sign up bonus
    };
    const id = await this._put("users", newUser);
    newUser.id = id;

    // Log welcome reward with expiry
    const welcomeExpiryDays = await this.getRewardExpiryDays();
    await this._put("wallet_ledger", {
      user_id: id,
      booking_id: null,
      type: "WELCOME_BONUS",
      description: "Welcome sports signup reward",
      amount: 10.00,
      expires_at: new Date(Date.now() + welcomeExpiryDays * 86400000).toISOString(),
      created_at: new Date().toISOString()
    });

    return { id: newUser.id, name: newUser.name, email: newUser.email, wallet_balance: newUser.wallet_balance };
  }

  async getUser(userId) {
    await this._simulateDelay(30);
    return await this._get("users", Number(userId));
  }

  // Sports & Facilities APIs
  async getSports() {
    await this._simulateDelay(50);
    return await this._getAll("sports");
  }

  async getCourts(sportId = null) {
    await this._simulateDelay(50);
    const courts = await this._getAll("courts");
    if (sportId != null && sportId !== "all" && sportId !== "") {
      return courts.filter(c => c.sport_id === Number(sportId));
    }
    return courts;
  }

  async getCourtById(courtId) {
    return await this._get("courts", Number(courtId));
  }

  async getSportById(sportId) {
    return await this._get("sports", Number(sportId));
  }

  // Slots & Availability API (Resolves Day-Wise Pricing, blocks Past Slots, and checks Playground & Academy Unavailability)
  async getSlots(courtId, dateStr) {
    await this._simulateDelay(60);
    const allSlots = await this._getAll("slots");
    const courtSlots = allSlots.filter(s => s.court_id === Number(courtId));

    const allBookings = await this._getAll("bookings");
    const activeBookings = allBookings.filter(b => 
      b.court_id === Number(courtId) && 
      b.date === dateStr && 
      b.status === "CONFIRMED"
    );

    const bookedSlotIds = new Set(activeBookings.map(b => b.slot_id));

    // Current Date and Time in local timezone for past slot checks
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Day-Wise Pricing (Weekday vs Weekend)
    const dayOfWeek = new Date(dateStr).getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const results = [];
    for (const s of courtSlots) {
      const resolvedPrice = isWeekend 
        ? (s.weekend_price != null ? Number(s.weekend_price) : Math.round(Number(s.price) * 1.3))
        : (s.weekday_price != null ? Number(s.weekday_price) : Number(s.price));

      // Check if slot has already passed
      const isPast = (dateStr < todayStr) || (dateStr === todayStr && s.start_time <= currentHourMin);

      const unavail = await this.checkSlotUnavailability(courtId, dateStr, s.start_time, s.end_time);
      const closedCheck = await this.isDateClosed(dateStr, s.start_time, s.end_time);

      const isUnavailable = isPast || unavail.isUnavailable || closedCheck.isClosed;
      let unavailReason = "";
      if (isPast) {
        unavailReason = "Time slot has already passed";
      } else if (unavail.isUnavailable) {
        unavailReason = unavail.reason;
      } else if (closedCheck.isClosed) {
        unavailReason = `Facility Closed (${closedCheck.reason})`;
      }

      results.push({
        ...s,
        price: resolvedPrice,
        day_type: isWeekend ? "WEEKEND" : "WEEKDAY",
        is_past: isPast,
        is_booked: bookedSlotIds.has(s.id),
        is_unavailable: isUnavailable,
        unavailability_reason: unavailReason
      });
    }

    return results;
  }

  // Book a Slot API with Dynamic Reward Calculation, Max Discount Cap, and optional Wallet Payment
  async createBooking({ userId, sportId, courtId, slotId, date, useWallet = false, discountPercent = 0, promoCode = "" }) {
    await this._simulateDelay(120);

    // 0. Check Facility Operating Status & Date Blackout
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const facilityStatus = await this.getFacilityStatus();
    // Closure for today only restricts bookings for today, not future dates!
    if (!facilityStatus.isOpen && date === todayStr) {
      throw new Error(`Facility is closed today (${facilityStatus.reason}). You can select future dates to book.`);
    }

    const slot = await this._get("slots", Number(slotId));
    if (!slot) throw new Error("Selected slot was not found.");

    // Check if slot has already passed (Cannot book past time slots)
    if (date < todayStr || (date === todayStr && slot.start_time <= currentHourMin)) {
      throw new Error(`Cannot book slot: The selected time slot (${slot.start_time} - ${slot.end_time}) on ${date} has already passed.`);
    }

    // Check Date & Time Closure (e.g. Full day or 14/11/2026 from 10:00 to 14:00)
    const dateClosedCheck = await this.isDateClosed(date, slot.start_time, slot.end_time);
    if (dateClosedCheck.isClosed) {
      throw new Error(`Facility is closed on ${date} ${dateClosedCheck.isFullDay ? '' : `during ${dateClosedCheck.start_time} - ${dateClosedCheck.end_time} `}(${dateClosedCheck.reason}). Please select another slot or date.`);
    }

    // Check Playground & Academy Time-Window Unavailability (e.g. 10:00 - 17:00)
    const unavail = await this.checkSlotUnavailability(courtId, date, slot.start_time, slot.end_time);
    if (unavail.isUnavailable) {
      throw new Error(`Cannot book slot: ${unavail.reason}`);
    }

    const court = await this._get("courts", Number(courtId));
    const sport = await this._get("sports", Number(sportId));
    const user = await this._get("users", Number(userId));
    if (!user) throw new Error("User session expired. Please sign in.");

    // Conflict Check: Double-booking prevention
    const allBookings = await this._getAll("bookings");
    const conflict = allBookings.find(b => 
      b.court_id === Number(courtId) && 
      b.slot_id === Number(slotId) && 
      b.date === date && 
      b.status === "CONFIRMED"
    );
    if (conflict) {
      throw new Error("This slot was just booked by another player! Please pick another slot.");
    }

    // Day-Wise Pricing (Weekday vs Weekend)
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const slotBasePrice = isWeekend 
      ? (slot.weekend_price != null ? Number(slot.weekend_price) : Math.round(Number(slot.price) * 1.3))
      : (slot.weekday_price != null ? Number(slot.weekday_price) : Number(slot.price));

    // Highest Limit of Discount / Reward Points Redemption (e.g. 30% Cap set by Admin)
    const maxDiscountCap = await this.getMaxDiscountPercent();
    const maxPointsAllowable = Number(((slotBasePrice * maxDiscountCap) / 100).toFixed(2));

    // 1. Calculate Wallet / Reward Points Payment applied via checkbox
    const currentWallet = Number(user.wallet_balance || 0);
    let walletApplied = 0;
    if (useWallet && currentWallet > 0) {
      walletApplied = Math.min(currentWallet, maxPointsAllowable, slotBasePrice);
    }
    walletApplied = Number(walletApplied.toFixed(2));
    const netPaid = Number((slotBasePrice - walletApplied).toFixed(2));

    // 2. Fetch current dynamic reward percentage from DB admin settings
    const rewardPercent = await this.getRewardRate();
    const rewardAmount = Number(((slotBasePrice * rewardPercent) / 100).toFixed(2));

    // 3. Insert booking record
    const newBooking = {
      user_id: user.id,
      sport_id: Number(sportId),
      sport_name: sport ? sport.name : "Sport",
      court_id: Number(courtId),
      court_name: court ? court.name : "Court",
      slot_id: Number(slotId),
      start_time: slot.start_time,
      end_time: slot.end_time,
      date: date,
      day_type: isWeekend ? "WEEKEND" : "WEEKDAY",
      base_price: slotBasePrice,
      price: slotBasePrice,
      wallet_applied: walletApplied,
      net_paid: netPaid,
      reward_percent: rewardPercent,
      reward_amount: rewardAmount,
      status: "CONFIRMED",
      created_at: new Date().toISOString()
    };

    const bookingId = await this._put("bookings", newBooking);
    newBooking.id = bookingId;

    // 4. Update user wallet balance (Deduct payment, add cashback reward)
    let newBalance = currentWallet;
    if (walletApplied > 0) {
      newBalance = Number((newBalance - walletApplied).toFixed(2));
      // Log wallet payment deduction in ledger
      await this._put("wallet_ledger", {
        user_id: user.id,
        booking_id: bookingId,
        type: "WALLET_PAYMENT",
        description: `Wallet reward balance used for Booking #${bookingId}`,
        amount: -walletApplied,
        created_at: new Date().toISOString()
      });
    }

    newBalance = Number((newBalance + rewardAmount).toFixed(2));
    user.wallet_balance = newBalance;
    await this._put("users", user);

    // 5. Log reward entry in ledger with expiration date
    const rewardExpiryDays = await this.getRewardExpiryDays();
    const expiresAt = new Date(Date.now() + rewardExpiryDays * 86400000).toISOString();

    await this._put("wallet_ledger", {
      user_id: user.id,
      booking_id: bookingId,
      type: "REWARD_EARNED",
      description: `${rewardPercent}% cashback reward for Booking #${bookingId} (${sport?.name || 'Sport'})`,
      amount: rewardAmount,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    });

    return { booking: newBooking, updatedWallet: user.wallet_balance };
  }

  // Get User Bookings API
  async getUserBookings(userId) {
    await this._simulateDelay(70);
    const bookings = await this._getAll("bookings");
    return bookings
      .filter(b => b.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getBookingById(bookingId) {
    return await this._get("bookings", Number(bookingId));
  }

  // Edit / Reschedule Booking API
  async updateBooking(bookingId, newDate, newSlotId) {
    await this._simulateDelay(120);
    const booking = await this._get("bookings", Number(bookingId));
    if (!booking) throw new Error("Booking record not found.");
    if (booking.status !== "CONFIRMED") throw new Error("Only confirmed active bookings can be rescheduled.");

    // Enforce Admin Slot Change Cutoff Rule (X hours before slot)
    const eligibility = await this.checkRescheduleEligibility(booking);
    if (!eligibility.isEligible) {
      throw new Error(eligibility.reason);
    }

    const newSlot = await this._get("slots", Number(newSlotId));
    if (!newSlot) throw new Error("Selected replacement slot not found.");

    // Check if new target slot is in the past
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (newDate < todayStr || (newDate === todayStr && newSlot.start_time <= currentHourMin)) {
      throw new Error(`Cannot reschedule: Target slot on ${newDate} (${newSlot.start_time} - ${newSlot.end_time}) has already passed.`);
    }

    // Check facility closed dates & time blackouts for new target slot
    const dateClosedCheck = await this.isDateClosed(newDate, newSlot.start_time, newSlot.end_time);
    if (dateClosedCheck.isClosed) {
      throw new Error(`Cannot reschedule: Facility is closed on ${newDate} (${dateClosedCheck.reason}).`);
    }

    // Check Playground & Academy Time-Window Unavailability for new slot
    const unavail = await this.checkSlotUnavailability(booking.court_id, newDate, newSlot.start_time, newSlot.end_time);
    if (unavail.isUnavailable) {
      throw new Error(`Cannot reschedule: ${unavail.reason}`);
    }

    // Conflict Check
    const allBookings = await this._getAll("bookings");
    const conflict = allBookings.find(b => 
      b.id !== Number(bookingId) &&
      b.court_id === booking.court_id && 
      b.slot_id === Number(newSlotId) && 
      b.date === newDate && 
      b.status === "CONFIRMED"
    );
    if (conflict) {
      throw new Error("The target slot for this date is already booked. Please choose another.");
    }

    const oldPrice = Number(booking.price);
    const oldReward = Number(booking.reward_amount || 0);

    // Current DB admin reward rate & wallet upgrade ratio
    const rewardPercent = await this.getRewardRate();
    const walletUpgradeRatio = await this.getWalletUpgradeRatio();
    const newPrice = Number(newSlot.price);
    const newReward = Number(((newPrice * rewardPercent) / 100).toFixed(2));
    const priceDelta = Number((newPrice - oldPrice).toFixed(2));

    const user = await this._get("users", booking.user_id);
    if (!user) throw new Error("User record not found.");

    let walletCut = 0;
    let netPayable = 0;

    // Price Increased (e.g. from $20 to $35 => priceDelta = +$15)
    if (priceDelta > 0) {
      // Allowable wallet deduction based on admin ratio (e.g. 100%, 50%, etc.)
      const maxAllowableFromWallet = Number(((priceDelta * walletUpgradeRatio) / 100).toFixed(2));
      const currentWallet = Number(user.wallet_balance || 0);

      // Cut down from wallet if user has funds
      walletCut = Math.min(currentWallet, maxAllowableFromWallet);
      netPayable = Number((priceDelta - walletCut).toFixed(2));

      // Deduct from wallet
      if (walletCut > 0) {
        user.wallet_balance = Number((user.wallet_balance - walletCut).toFixed(2));
        await this._put("wallet_ledger", {
          user_id: user.id,
          booking_id: booking.id,
          type: "WALLET_UPGRADE_PAYMENT",
          description: `Wallet cut for slot reschedule price upgrade (+${priceDelta.toFixed(2)}) based on ${walletUpgradeRatio}% admin ratio (Booking #${booking.id})`,
          amount: -walletCut,
          created_at: new Date().toISOString()
        });
      }

      booking.wallet_applied = Number(((booking.wallet_applied || 0) + walletCut).toFixed(2));
      booking.net_paid = Number(((booking.net_paid || oldPrice) + netPayable).toFixed(2));
    } else if (priceDelta < 0) {
      // Cheaper slot chosen (e.g. $35 down to $20 => priceDelta = -$15)
      const refundAmount = Math.abs(priceDelta);
      user.wallet_balance = Number((user.wallet_balance + refundAmount).toFixed(2));
      await this._put("wallet_ledger", {
        user_id: user.id,
        booking_id: booking.id,
        type: "WALLET_DOWNGRADE_REFUND",
        description: `Wallet refund for cheaper slot reschedule difference (-${refundAmount.toFixed(2)}) on Booking #${booking.id}`,
        amount: refundAmount,
        created_at: new Date().toISOString()
      });

      booking.wallet_applied = Math.max(0, Number(((booking.wallet_applied || 0) - refundAmount).toFixed(2)));
    }

    // Adjust reward cashback difference (new reward - old reward)
    const rewardDelta = Number((newReward - oldReward).toFixed(2));
    if (rewardDelta !== 0) {
      user.wallet_balance = Number((user.wallet_balance + rewardDelta).toFixed(2));
      const reschedExpiryDays = await this.getRewardExpiryDays();
      await this._put("wallet_ledger", {
        user_id: user.id,
        booking_id: booking.id,
        type: rewardDelta > 0 ? "REWARD_ADJUST_ADD" : "REWARD_ADJUST_DEDUCT",
        description: `Booking #${booking.id} rescheduled reward adjustment (${rewardPercent}%)`,
        amount: rewardDelta,
        expires_at: rewardDelta > 0 ? new Date(Date.now() + reschedExpiryDays * 86400000).toISOString() : null,
        created_at: new Date().toISOString()
      });
    }

    await this._put("users", user);

    // Update booking object
    booking.date = newDate;
    booking.slot_id = Number(newSlotId);
    booking.start_time = newSlot.start_time;
    booking.end_time = newSlot.end_time;
    booking.price = newPrice;
    booking.reward_percent = rewardPercent;
    booking.reward_amount = newReward;
    booking.updated_at = new Date().toISOString();

    await this._put("bookings", booking);

    return { 
      booking, 
      updatedWallet: user.wallet_balance, 
      priceDelta, 
      walletCut, 
      netPayable, 
      rewardDelta 
    };
  }

  // Cancel Booking API (Enforces admin cutoff window, reverses reward, marks refund PENDING for manual admin action)
  async cancelBooking(bookingId) {
    await this._simulateDelay(100);
    const booking = await this._get("bookings", Number(bookingId));
    if (!booking) throw new Error("Booking not found.");
    if (booking.status === "CANCELLED") throw new Error("This booking is already cancelled.");

    // Enforce Admin Cutoff Rule (e.g. 12 hours)
    const eligibility = await this.checkCancellationEligibility(booking);
    if (!eligibility.isEligible) {
      throw new Error(eligibility.reason);
    }

    // 1. Reverse previously credited cashback reward
    const user = await this._get("users", booking.user_id);
    if (user) {
      let balance = Number(user.wallet_balance || 0);
      const rewardReversal = Number(booking.reward_amount || 0);
      if (rewardReversal > 0) {
        balance = Number(Math.max(0, balance - rewardReversal).toFixed(2));
        await this._put("wallet_ledger", {
          user_id: user.id,
          booking_id: booking.id,
          type: "REWARD_REVERSED",
          description: `Reversal of ${booking.reward_percent}% reward due to cancellation of Booking #${booking.id}`,
          amount: -rewardReversal,
          created_at: new Date().toISOString()
        });
      }
      user.wallet_balance = balance;
      await this._put("users", user);
    }

    // 2. Mark booking as CANCELLED with PENDING manual admin refund
    booking.status = "CANCELLED";
    booking.cancelled_at = new Date().toISOString();
    booking.hours_before_slot = eligibility.diffHours;
    booking.refund_status = "PENDING"; // Admin will review and disburse refund manually
    booking.refund_percent = eligibility.defaultRefundPct;
    booking.estimated_refund = eligibility.estimatedRefund;
    booking.refund_amount = eligibility.estimatedRefund; // Pre-calculated per admin default refund policy
    booking.admin_refund_note = "";
    await this._put("bookings", booking);

    return { booking, updatedWallet: user?.wallet_balance };
  }

  // Admin Manual Refund API: Admin sets how much refund to disburse back to user wallet
  async processManualRefund(bookingId, refundAmount, note = "") {
    await this._simulateDelay(100);
    const booking = await this._get("bookings", Number(bookingId));
    if (!booking) throw new Error("Booking not found.");
    if (booking.status !== "CANCELLED") throw new Error("Only cancelled bookings can be refunded.");

    const maxAllowed = Number(booking.price);
    const amount = Math.max(0, Math.min(maxAllowed, Number(refundAmount)));

    booking.refund_status = "REFUNDED";
    booking.refund_amount = amount;
    booking.admin_refund_note = (note || "").trim();
    booking.refunded_at = new Date().toISOString();
    await this._put("bookings", booking);

    // Credit amount back to player wallet
    const user = await this._get("users", booking.user_id);
    if (user && amount > 0) {
      user.wallet_balance = Number(((user.wallet_balance || 0) + amount).toFixed(2));
      await this._put("users", user);

      // Record transaction in wallet ledger
      const refundExpiryDays = await this.getRewardExpiryDays();
      await this._put("wallet_ledger", {
        user_id: user.id,
        booking_id: booking.id,
        type: "ADMIN_MANUAL_REFUND",
        description: `Admin Refund for Booking #${booking.id} (${booking.sport_name})${note ? ` - ${note}` : ''}`,
        amount: amount,
        expires_at: new Date(Date.now() + refundExpiryDays * 86400000).toISOString(),
        created_at: new Date().toISOString()
      });
    }

    return { booking, updatedWallet: user?.wallet_balance };
  }

  // Wallet History Ledger API
  async getWalletLedger(userId) {
    await this._simulateDelay(50);
    const all = await this._getAll("wallet_ledger");
    return all
      .filter(l => l.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Admin: Get All Registered Users
  async getAllUsers() {
    await this._simulateDelay(40);
    return await this._getAll("users");
  }

  // Admin: Delete User and associated bookings/wallet ledger records
  async deleteUser(userId) {
    await this._simulateDelay(50);
    const id = Number(userId);
    await this._delete("users", id);

    // Clean up bookings for this user
    const allBookings = await this._getAll("bookings");
    const userBookings = allBookings.filter(b => b.user_id === id);
    for (const b of userBookings) {
      await this._delete("bookings", b.id);
    }

    // Clean up wallet ledger entries for this user
    const allLedger = await this._getAll("wallet_ledger");
    const userLedger = allLedger.filter(l => l.user_id === id);
    for (const l of userLedger) {
      await this._delete("wallet_ledger", l.id);
    }

    // Clear active session if logged in as this user
    if (typeof localStorage !== "undefined") {
      const activeUser = localStorage.getItem("sports_active_user_id");
      if (activeUser && Number(activeUser) === id) {
        localStorage.removeItem("sports_active_user_id");
      }
    }

    return true;
  }

  // Admin: Add Game / Sport (with default courts & slots)
  async addSport({ name, category, courts_count, icon }) {
    await this._simulateDelay(80);
    const newSport = {
      name: name.trim(),
      category: category ? category.trim() : "Indoor",
      courts_count: Number(courts_count) || 2,
      icon: icon && icon.trim() ? icon.trim() : "[SP]"
    };
    const sportId = await this._put("sports", newSport);
    newSport.id = sportId;

    // Auto-create courts & slots for this new sport
    const courtsCount = newSport.courts_count;
    for (let c = 1; c <= courtsCount; c++) {
      const court = {
        sport_id: sportId,
        name: `${newSport.name} Court ${c}`,
        surface: "Standard Court",
        status: "Active"
      };
      const courtId = await this._put("courts", court);

      // Hourly slots 08:00 - 21:00
      const times = [
        { start: "08:00", end: "09:00", price: 20 },
        { start: "09:00", end: "10:00", price: 20 },
        { start: "10:00", end: "11:00", price: 25 },
        { start: "14:00", end: "15:00", price: 25 },
        { start: "17:00", end: "18:00", price: 30 },
        { start: "18:00", end: "19:00", price: 35 },
        { start: "19:00", end: "20:00", price: 40 }
      ];
      for (const t of times) {
        await this._put("slots", {
          court_id: courtId,
          start_time: t.start,
          end_time: t.end,
          price: t.price
        });
      }
    }


    return newSport;
  }

  // Admin: Update Sport
  async updateSport(sportId, { name, category, courts_count, icon }) {
    await this._simulateDelay(80);
    const sport = await this._get("sports", Number(sportId));
    if (!sport) throw new Error("Sport not found");

    sport.name = name.trim();
    if (category) sport.category = category.trim();
    if (courts_count) sport.courts_count = Number(courts_count);
    if (icon) sport.icon = icon.trim();

    await this._put("sports", sport);
    return sport;
  }

  // Admin: Delete Sport and associated courts & slots
  async deleteSport(sportId) {
    await this._simulateDelay(80);
    const id = Number(sportId);
    await this._delete("sports", id);

    // Clean up courts and their slots
    const allCourts = await this._getAll("courts");
    const courtsToDelete = allCourts.filter(c => c.sport_id === id);
    const courtIds = courtsToDelete.map(c => c.id);

    for (const c of courtsToDelete) {
      await this._delete("courts", c.id);
    }

    const allSlots = await this._getAll("slots");
    const slotsToDelete = allSlots.filter(s => courtIds.includes(s.court_id));
    for (const s of slotsToDelete) {
      await this._delete("slots", s.id);
    }

    return true;
  }

  // Admin: Get All Bookings
  async getAllBookings() {
    await this._simulateDelay(40);
    return await this._getAll("bookings");
  }

  // Simulate network latency for mock API calls
  async _simulateDelay(ms = 80) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// Global API singleton
window.api = new MockAPI();
