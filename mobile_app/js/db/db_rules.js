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
  }

});
