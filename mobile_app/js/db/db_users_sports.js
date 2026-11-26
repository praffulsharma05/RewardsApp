/**
 * db_users_sports.js - User Authentication, Profiles, and Sports/Courts Management
 */
Object.assign(MockAPI.prototype, {
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
  },

  async resetPassword(identifier, newPassword) {
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
    if (!newPassword || newPassword.length < 4) {
      throw new Error("New password must be at least 4 characters.");
    }
    user.password = newPassword;
    await this._put("users", user);
    return { id: user.id, name: user.name, email: user.email };
  },

  async register(name, email, password, phone = "") {
    await this._simulateDelay(100);
    const users = await this._getAll("users");
    if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const welcomeBonus = await this.getWelcomeBonusAmount();
    const newUser = {
      name: name.trim(),
      email: email.trim(),
      phone: (phone || "").trim(),
      password,
      wallet_balance: welcomeBonus
    };
    const id = await this._put("users", newUser);
    newUser.id = id;

    // Log welcome reward with expiry if bonus > 0
    if (welcomeBonus > 0) {
      const welcomeExpiryDays = await this.getRewardExpiryDays();
      await this._put("wallet_ledger", {
        user_id: id,
        booking_id: null,
        type: "WELCOME_BONUS",
        description: "Welcome sports signup reward",
        amount: welcomeBonus,
        expires_at: new Date(Date.now() + welcomeExpiryDays * 86400000).toISOString(),
        created_at: new Date().toISOString()
      });
    }

    return { id: newUser.id, name: newUser.name, email: newUser.email, wallet_balance: newUser.wallet_balance };
  },

  async getUser(userId) {
    await this._simulateDelay(30);
    return await this._get("users", Number(userId));
  },

  // Sports & Facilities APIs
  async getSports() {
    await this._simulateDelay(50);
    return await this._getAll("sports");
  },

  async getCourts(sportId = null) {
    await this._simulateDelay(50);
    const courts = await this._getAll("courts");
    if (sportId != null && sportId !== "all" && sportId !== "") {
      return courts.filter(c => c.sport_id === Number(sportId));
    }
    return courts;
  },

  async getCourtById(courtId) {
    return await this._get("courts", Number(courtId));
  },

  async getSportById(sportId) {
    return await this._get("sports", Number(sportId));
  },

  // Admin: Get All Registered Users
  async getAllUsers() {
    await this._simulateDelay(40);
    return await this._getAll("users");
  },

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
  },

  // Admin: Add Game / Sport (with default courts & slots)
  async addSport({ name, category, courts_count, icon }) {
    await this._simulateDelay(80);
    const cleanIcon = icon && icon.trim() ? icon.trim().replace(/[\[\]]/g, "") : "SP";
    const newSport = {
      name: name.trim(),
      category: category ? category.trim() : "Indoor",
      courts_count: Number(courts_count) || 2,
      icon: cleanIcon || "SP"
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

      // Hourly slots 08:00 - 23:00 (8 AM to 11 PM)
      const times = [
        { start: "08:00", end: "09:00", price: 20 },
        { start: "09:00", end: "10:00", price: 20 },
        { start: "10:00", end: "11:00", price: 25 },
        { start: "11:00", end: "12:00", price: 25 },
        { start: "12:00", end: "13:00", price: 25 },
        { start: "13:00", end: "14:00", price: 25 },
        { start: "14:00", end: "15:00", price: 25 },
        { start: "15:00", end: "16:00", price: 25 },
        { start: "16:00", end: "17:00", price: 30 },
        { start: "17:00", end: "18:00", price: 35 },
        { start: "18:00", end: "19:00", price: 35 },
        { start: "19:00", end: "20:00", price: 40 },
        { start: "20:00", end: "21:00", price: 40 },
        { start: "21:00", end: "22:00", price: 45 },
        { start: "22:00", end: "23:00", price: 45 }
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
  },

  // Admin: Update Sport
  async updateSport(sportId, { name, category, courts_count, icon }) {
    await this._simulateDelay(80);
    const sport = await this._get("sports", Number(sportId));
    if (!sport) throw new Error("Sport not found");

    sport.name = name.trim();
    if (category) sport.category = category.trim();
    if (courts_count) sport.courts_count = Number(courts_count);
    if (icon) sport.icon = icon.trim().replace(/[\[\]]/g, "") || "SP";

    await this._put("sports", sport);
    return sport;
  },

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

});
