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
  },

  // Admin Settings: Slot Change / Reschedule Cutoff Time Window (X Hours before slot)
  async getRescheduleCutoffHours() {
    await this._simulateDelay(20);
    const item = await this._get("settings", "reschedule_cutoff_hours");
    return item ? Number(item.value) : 12;
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
  }

});
