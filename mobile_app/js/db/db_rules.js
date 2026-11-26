/**
 * db_rules.js - Business Rules, Rewards, Expiry, Cutoff & Discount Policies
 */
Object.assign(MockAPI.prototype, {
  // Admin Settings: Get & Set Reward Percentage
  async getRewardRate() {
    await this._simulateDelay(40);
    const item = await this._get("settings", "reward_percent");
    return item ? Number(item.value) : 10;
  },

  async setRewardRate(percentage) {
    await this._simulateDelay(80);
    const parsed = Math.max(0, Math.min(100, Number(percentage)));
    await this._put("settings", { key: "reward_percent", value: parsed });
    return parsed;
  },

  // Admin Settings: Cancellation Cutoff Time Window (e.g. 12 Hours before slot)
  async getCancellationCutoffHours() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "cancellation_cutoff_hours");
    return item ? Number(item.value) : 12;
  },

  async setCancellationCutoffHours(hours) {
    await this._simulateDelay(80);
    const parsed = Math.max(1, Math.min(168, Number(hours)));
    await this._put("settings", { key: "cancellation_cutoff_hours", value: parsed });
    return parsed;
  },

  // Admin Settings: Default Cancellation Refund Rate (e.g. 100%, 80%, 50%)
  async getDefaultRefundPercent() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "default_refund_percent");
    return item ? Number(item.value) : 100;
  },

  async setDefaultRefundPercent(pct) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(100, Number(pct)));
    await this._put("settings", { key: "default_refund_percent", value: parsed });
    return parsed;
  },

  // Admin Settings: Get & Set Admin UPI ID (defaults to gyananiharish@ybl)
  async getAdminUPI() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "admin_upi_id");
    return item ? String(item.value).trim() : "gyananiharish@ybl";
  },

  async setAdminUPI(upiId) {
    await this._simulateDelay(80);
    const val = String(upiId || "gyananiharish@ybl").trim();
    await this._put("settings", { key: "admin_upi_id", value: val });
    return val;
  },

  // Check if booking is eligible for cancellation against admin cutoff rule & calculate refund rate
  async checkCancellationEligibility(booking) {
    const cutoff = await this.getCancellationCutoffHours();
    const defaultRefundPct = await this.getDefaultRefundPercent();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (booking.booking_type === "MONTHLY") {
      const mCfg = await this.getMonthlyBookingConfig();
      const totalDays = Number(booking.duration_days || 30);
      const activeDates = this.getMonthlyActiveDates
        ? this.getMonthlyActiveDates(booking)
        : (this._getDateRange ? this._getDateRange(booking.date, totalDays).map(d => ({ date: d, start_time: booking.start_time })) : []);

      let usedDays = 0;
      let remainingDays = 0;
      for (const entry of activeDates) {
        const st = entry.start_time || booking.start_time || "00:00";
        if (entry.date < todayStr || (entry.date === todayStr && st <= currentHourMin)) {
          usedDays++;
        } else {
          remainingDays++;
        }
      }

      const isPast = remainingDays === 0;
      const isMidMonth = usedDays > 0 && remainingDays > 0;
      const isEligible = !isPast && (!isMidMonth || mCfg.allowMidMonthCancel);
      const refundPct = isMidMonth ? Number(mCfg.midMonthRefundPercent ?? 80) : defaultRefundPct;
      const unusedValue = (Number(booking.price) / Math.max(1, totalDays)) * remainingDays;
      const estimatedRefund = Number(((unusedValue * refundPct) / 100).toFixed(2));

      let reason = "";
      if (isPast) {
        reason = "Cannot cancel: All days in this Monthly Pass have already completed.";
      } else if (!isEligible) {
        reason = "Mid-month cancellation is disabled by Admin policy.";
      } else if (isMidMonth) {
        reason = `Mid-Month Cancel: ${remainingDays} of ${totalDays} days unused • ${refundPct}% pro-rata refund (₹${estimatedRefund.toFixed(2)}).`;
      } else {
        reason = `Pass not started yet (${remainingDays}/${totalDays} days unused) • ${refundPct}% refund (₹${estimatedRefund.toFixed(2)}).`;
      }

      return {
        isEligible,
        isPast,
        isMonthly: true,
        isMidMonth,
        totalDays,
        usedDays,
        remainingDays,
        diffHours: Number((remainingDays * 24).toFixed(1)),
        cutoffHours: cutoff,
        defaultRefundPct: refundPct,
        estimatedRefund,
        slotDateTimeStr: `${booking.date} to ${booking.end_date || booking.date}`,
        reason
      };
    }

    const dateStr = booking.date;
    const timeStr = booking.start_time || "00:00";
    const slotDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const diffHours = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isPast = diffHours <= 0;
    const isEligible = !isPast && (diffHours >= cutoff);
    const estimatedRefund = Number(((Number(booking.price) * defaultRefundPct) / 100).toFixed(2));

    let reason = "";
    if (isPast) {
      reason = "Cannot cancel: This slot time has already passed (Game Completed).";
    } else if (isEligible) {
      reason = `Eligible for cancellation (${diffHours.toFixed(1)} hrs left >= ${cutoff} hrs cutoff). Policy refund rate: ${defaultRefundPct}% (₹${estimatedRefund.toFixed(2)}).`;
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
  },

  // Admin Settings: Slot Change / Reschedule Cutoff Time Window (X Hours before slot)
  async getRescheduleCutoffHours() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "reschedule_cutoff_hours");
    return item ? Number(item.value) : 0;
  },

  async setRescheduleCutoffHours(hours) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(168, Number(hours)));
    await this._put("settings", { key: "reschedule_cutoff_hours", value: parsed });
    return parsed;
  },

  // Check if booking is eligible for slot change/reschedule against admin cutoff rule
  async checkRescheduleEligibility(booking) {
    const cutoff = await this.getRescheduleCutoffHours();
    const dateStr = booking.date;
    const endTimeStr = booking.end_time || "23:59";
    const slotEndDateTime = new Date(`${dateStr}T${endTimeStr}:00`);
    const now = new Date();

    // A game/slot is only past if its end time has already elapsed
    const isPast = slotEndDateTime.getTime() <= now.getTime();

    const startTimeStr = booking.start_time || "00:00";
    const slotStartDateTime = new Date(`${dateStr}T${startTimeStr}:00`);
    const diffHours = (slotStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Eligible if not ended AND (cutoff is 0 or sufficient notice before start)
    const isEligible = !isPast && (cutoff === 0 || diffHours >= cutoff);

    let reason = "";
    if (isPast) {
      reason = "Cannot change slot: This game/slot has already ended (Game Completed).";
    } else if (isEligible) {
      reason = cutoff === 0 
        ? "Eligible for slot change."
        : `Eligible for slot change (${diffHours.toFixed(1)} hrs notice).`;
    } else {
      reason = `Requires at least ${cutoff} hours notice before slot.`;
    }

    return {
      isEligible,
      isPast,
      diffHours: Number(diffHours.toFixed(1)),
      cutoffHours: cutoff,
      slotDateTimeStr: `${dateStr} ${startTimeStr}`,
      reason
    };
  },

  // Admin Settings: Max Wallet Deduction Ratio for Slot Upgrades (0% - 100%)
  async getWalletUpgradeRatio() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "wallet_upgrade_ratio");
    return item ? Number(item.value) : 100;
  },

  async setWalletUpgradeRatio(ratio) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(100, Number(ratio)));
    await this._put("settings", { key: "wallet_upgrade_ratio", value: parsed });
    return parsed;
  },

  // Admin Settings: Reward Validity Expiry Period (Days: e.g. 30, 60, 90, 180, 365)
  async getRewardExpiryDays() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "reward_expiry_days");
    return item ? Number(item.value) : 60;
  },

  async setRewardExpiryDays(days) {
    await this._simulateDelay(60);
    const parsed = Math.max(1, Math.min(730, Number(days)));
    await this._put("settings", { key: "reward_expiry_days", value: parsed });
    return parsed;
  },

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
  },

  // Admin Settings: Highest Limit of Discount (e.g. 30% Cap)
  async getMaxDiscountPercent() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "max_discount_percent");
    return item ? Number(item.value) : 30;
  },

  async setMaxDiscountPercent(percent) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(100, Number(percent)));
    await this._put("settings", { key: "max_discount_percent", value: parsed });
    return parsed;
  },

  // Admin Settings: New User Welcome Reward Points / Balance (₹)
  async getWelcomeBonusAmount() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "welcome_bonus_amount");
    return item ? Number(item.value) : 10;
  },

  async setWelcomeBonusAmount(amount) {
    await this._simulateDelay(60);
    const parsed = Math.max(0, Math.min(10000, Number(amount)));
    await this._put("settings", { key: "welcome_bonus_amount", value: parsed });
    return parsed;
  },

  // Admin Settings: Monthly Slot Booking Rule (Enabled, Discount %, Duration Days, Reschedule & Mid-Month Refund)
  async getMonthlyBookingConfig() {
    await this._simulateDelay(20);
    const enabledItem = await this._get("settings", "monthly_booking_enabled");
    const discountItem = await this._get("settings", "monthly_discount_percent");
    const daysItem = await this._get("settings", "monthly_days_count");
    const reschedItem = await this._get("settings", "monthly_allow_reschedule");
    const maxReschedItem = await this._get("settings", "monthly_max_reschedule_days");
    const midCancelItem = await this._get("settings", "monthly_allow_mid_cancel");
    const midRefundItem = await this._get("settings", "monthly_mid_refund_percent");

    const defaultEnabled = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DEFAULTS?.MONTHLY_BOOKING_ENABLED !== undefined)
      ? APP_CONSTANTS.DEFAULTS.MONTHLY_BOOKING_ENABLED
      : true;
    const defaultDiscount = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DEFAULTS?.MONTHLY_DISCOUNT_PERCENT !== undefined)
      ? APP_CONSTANTS.DEFAULTS.MONTHLY_DISCOUNT_PERCENT
      : 15;
    const defaultDays = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.DEFAULTS?.MONTHLY_DAYS_COUNT !== undefined)
      ? APP_CONSTANTS.DEFAULTS.MONTHLY_DAYS_COUNT
      : 30;

    return {
      enabled: enabledItem ? Boolean(enabledItem.value) : defaultEnabled,
      discountPercent: discountItem ? Number(discountItem.value) : defaultDiscount,
      daysCount: daysItem ? Number(daysItem.value) : defaultDays,
      allowSingleDayReschedule: reschedItem !== undefined ? Boolean(reschedItem.value) : true,
      maxRescheduleDays: maxReschedItem !== undefined ? Number(maxReschedItem.value) : 3,
      allowMidMonthCancel: midCancelItem !== undefined ? Boolean(midCancelItem.value) : true,
      midMonthRefundPercent: midRefundItem !== undefined ? Number(midRefundItem.value) : 80
    };
  },

  async setMonthlyBookingConfig({ enabled, discountPercent, daysCount, allowSingleDayReschedule = true, maxRescheduleDays = 3, allowMidMonthCancel = true, midMonthRefundPercent = 80 }) {
    await this._simulateDelay(60);
    const parsedEnabled = Boolean(enabled);
    const parsedDiscount = Math.max(0, Math.min(90, Number(discountPercent)));
    const parsedDays = Math.max(7, Math.min(365, Math.round(Number(daysCount) || 30)));
    const parsedAllowResched = Boolean(allowSingleDayReschedule);
    const parsedMaxResched = Math.max(0, Math.min(31, Math.round(Number(maxRescheduleDays) || 0)));
    const parsedAllowMidCancel = Boolean(allowMidMonthCancel);
    const parsedMidRefund = Math.max(0, Math.min(100, Number(midMonthRefundPercent)));

    await this._put("settings", { key: "monthly_booking_enabled", value: parsedEnabled });
    await this._put("settings", { key: "monthly_discount_percent", value: parsedDiscount });
    await this._put("settings", { key: "monthly_days_count", value: parsedDays });
    await this._put("settings", { key: "monthly_allow_reschedule", value: parsedAllowResched });
    await this._put("settings", { key: "monthly_max_reschedule_days", value: parsedMaxResched });
    await this._put("settings", { key: "monthly_allow_mid_cancel", value: parsedAllowMidCancel });
    await this._put("settings", { key: "monthly_mid_refund_percent", value: parsedMidRefund });

    return {
      enabled: parsedEnabled,
      discountPercent: parsedDiscount,
      daysCount: parsedDays,
      allowSingleDayReschedule: parsedAllowResched,
      maxRescheduleDays: parsedMaxResched,
      allowMidMonthCancel: parsedAllowMidCancel,
      midMonthRefundPercent: parsedMidRefund
    };
  }

});
