/**
 * db_bookings.js - Booking Creation, Checkout Calculation, and Audit Retrieval
 */
Object.assign(MockAPI.prototype, {
  // Book a Slot API with Dynamic Reward Calculation, Max Discount Cap, and optional Wallet Payment
  async createBooking({ userId, sportId, courtId, slotId, date, useWallet = false, discountPercent = 0, promoCode = "", paymentMethod = "UPI" }) {
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
      throw new Error("This slot was just booked by other player!");
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
      payment_method: netPaid === 0 ? "WALLET" : (paymentMethod || "UPI"),
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
  },

  // Get User Bookings API
  async getUserBookings(userId) {
    await this._simulateDelay(70);
    const bookings = await this._getAll("bookings");
    return bookings
      .filter(b => b.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getBookingById(bookingId) {
    return await this._get("bookings", Number(bookingId));
  },

  // Admin: Get All Bookings
  async getAllBookings() {
    await this._simulateDelay(40);
    return await this._getAll("bookings");
  }
});
