/**
 * db_booking_mgmt.js - Rescheduling, Cancellations, Refunds, and Wallet Ledger
 */
Object.assign(MockAPI.prototype, {
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
  },

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
  },

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
  },

  // Wallet History Ledger API
  async getWalletLedger(userId) {
    await this._simulateDelay(50);
    const all = await this._getAll("wallet_ledger");
    return all
      .filter(l => l.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

});
