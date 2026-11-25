/**
 * db_seed.js - Default Seed Data Generator for IndexedDB
 */
Object.assign(MockAPI.prototype, {
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

    // Slot Change / Reschedule Cutoff Hours Setting (Default: 0 Hours for seamless booking & demo)
    const currentRescheduleCutoff = await this._get("settings", "reschedule_cutoff_hours");
    if (!currentRescheduleCutoff || currentRescheduleCutoff.value === 12) {
      await this._put("settings", { key: "reschedule_cutoff_hours", value: 0 });
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

    // Admin Setting: Default Facility Receiving UPI ID (Default: gyananiharish@ybl)
    const currentAdminUPI = await this._get("settings", "admin_upi_id");
    if (!currentAdminUPI || currentAdminUPI.value === "9602565841@ybl") {
      await this._put("settings", { key: "admin_upi_id", value: "gyananiharish@ybl" });
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
           },
          {
            id: 2,
            court_id: 0,
            court_name: "All Academy Grounds",
            start_time: "10:00",
            end_time: "17:00",
            date: "2026-11-15",
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
        { id: 1, name: "Table Tennis", category: "Indoor", courts_count: 4, icon: "TT" },
        { id: 2, name: "Badminton", category: "Indoor", courts_count: 2, icon: "BD" },
        { id: 3, name: "Tennis", category: "Outdoor", courts_count: 2, icon: "TN" },
        { id: 4, name: "Squash", category: "Indoor", courts_count: 2, icon: "SQ" },
        { id: 5, name: "Football", category: "Outdoor", courts_count: 2, icon: "FB" }
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
    for (const sp of checkSports) {
      if (sp.icon && (sp.icon.includes("[") || sp.icon.includes("]"))) {
        sp.icon = sp.icon.replace(/[\[\]]/g, "").trim();
        await this._put("sports", sp);
      }
    }
    const hasFootball = checkSports.some(s => s.name && s.name.toLowerCase().includes("football"));
    if (!hasFootball && checkSports.length > 0) {
      const footballSport = { id: 5, name: "Football", category: "Outdoor", courts_count: 2, icon: "FB" };
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
});
