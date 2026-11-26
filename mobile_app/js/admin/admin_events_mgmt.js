/**
 * admin_events_mgmt.js - Games CRUD, Slot Pricing, Rules & Refund Modal Events
 */
Object.assign(MobileAdminApp.prototype, {
  bindManagementEvents() {
    // Game & Slot Day-Wise Pricing Form Submit
    document.getElementById("form-peak-pricing")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sportSelect = document.getElementById("pricing-sport-select");
      const sportId = sportSelect ? sportSelect.value : "1";
      const sportName = sportSelect?.options[sportSelect.selectedIndex]?.text || "Selected Game";
      const slotVal = document.getElementById("pricing-slot-select")?.value || "18:00-19:00";
      const dayType = document.getElementById("pricing-day-type")?.value || "ALL";
      const price = Number(document.getElementById("price-rate-value").value);
      const rawMonthly = document.getElementById("price-monthly-rate-value")?.value?.trim();
      const monthlyPrice = rawMonthly ? Number(rawMonthly) : null;

      try {
        const count = await window.api.updateSlotDayWisePrice(sportId, slotVal, dayType, price, monthlyPrice);
        this.showToast(APP_CONSTANTS.MESSAGES.PRICING_UPDATED(sportName, count, price));
        await this.renderPricingSchedule();
      } catch (err) {
        alert(err.message);
      }
    });

    // Sport dropdown change in pricing screen
    document.getElementById("pricing-sport-select")?.addEventListener("change", async (e) => {
      this.selectedPricingSportId = e.target.value;
      await this.renderPricingSchedule();
    });

    // Games: Add Sport Button
    document.getElementById("btn-open-add-game")?.addEventListener("click", () => {
      this.openAddGameModal();
    });

    // Game Modal Close & Submit
    document.getElementById("btn-close-game-modal")?.addEventListener("click", () => this.closeGameModal());
    document.getElementById("form-game-save")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleSaveGame();
    });

    // Delete Game Modal Close & Actions
    document.getElementById("btn-close-delete-modal")?.addEventListener("click", () => this.closeDeleteModal());
    document.getElementById("btn-abort-delete-game")?.addEventListener("click", () => this.closeDeleteModal());
    document.getElementById("btn-confirm-delete-game")?.addEventListener("click", async () => this.handleConfirmDeleteSport());

    // Delete User Modal Close & Actions
    document.getElementById("btn-close-delete-user-modal")?.addEventListener("click", () => this.closeDeleteUserModal());
    document.getElementById("btn-abort-delete-user")?.addEventListener("click", () => this.closeDeleteUserModal());
    document.getElementById("btn-confirm-delete-user")?.addEventListener("click", async () => this.handleConfirmDeleteUser());

    // Rewards Preset Chips
    document.querySelectorAll(".btn-rate-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const rate = btn.dataset.rate;
        const input = document.getElementById("admin-reward-input");
        if (input) input.value = rate;
      });
    });

    // Monthly Discount & Duration Preset Chips
    document.querySelectorAll(".btn-monthly-discount-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const disc = btn.dataset.discount;
        const input = document.getElementById("admin-monthly-discount-input");
        if (input) input.value = disc;
      });
    });
    document.querySelectorAll(".btn-monthly-days-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const days = btn.dataset.days;
        const input = document.getElementById("admin-monthly-days-input");
        if (input) input.value = days;
      });
    });
    document.querySelectorAll(".btn-monthly-max-resched-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById("admin-monthly-max-resched-input");
        if (input) input.value = btn.dataset.days;
      });
    });
    document.querySelectorAll(".btn-monthly-refund-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById("admin-monthly-refund-pct-input");
        if (input) input.value = btn.dataset.pct;
      });
    });

    // Monthly Slot Booking Rule Form Submit
    document.getElementById("form-admin-monthly-rule-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const enabled = Boolean(document.getElementById("admin-monthly-enabled-toggle")?.checked);
      const discountPercent = Number(document.getElementById("admin-monthly-discount-input").value);
      const daysCount = Number(document.getElementById("admin-monthly-days-input").value);
      const allowSingleDayReschedule = Boolean(document.getElementById("admin-monthly-reschedule-toggle")?.checked);
      const maxRescheduleDays = Number(document.getElementById("admin-monthly-max-resched-input")?.value ?? 3);
      const allowMidMonthCancel = Boolean(document.getElementById("admin-monthly-midcancel-toggle")?.checked);
      const midMonthRefundPercent = Number(document.getElementById("admin-monthly-refund-pct-input")?.value ?? 80);
      try {
        const saved = await window.api.setMonthlyBookingConfig({
          enabled,
          discountPercent,
          daysCount,
          allowSingleDayReschedule,
          maxRescheduleDays,
          allowMidMonthCancel,
          midMonthRefundPercent
        });
        const msg = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.MESSAGES.MONTHLY_RULE_SAVED)
          ? APP_CONSTANTS.MESSAGES.MONTHLY_RULE_SAVED(saved.enabled, saved.discountPercent, saved.daysCount)
          : "Monthly rule saved!";
        this.showToast(msg);
      } catch (err) {
        alert(err.message);
      }
    });

    // Rewards Form Submit
    document.getElementById("form-admin-reward-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newRate = Number(document.getElementById("admin-reward-input").value);
      try {
        const saved = await window.api.setRewardRate(newRate);
        this.showToast(APP_CONSTANTS.MESSAGES.REWARD_RATE_SAVED(saved));
        await this.refreshOverview();
      } catch (err) {
        alert(err.message);
      }
    });

    // Reward Expiry Preset Chips
    document.querySelectorAll(".btn-expiry-days-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const days = btn.dataset.days;
        const input = document.getElementById("admin-expiry-days-input");
        if (input) input.value = days;
      });
    });

    // Reward Expiry Form Submit
    document.getElementById("form-admin-expiry-days-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const days = Number(document.getElementById("admin-expiry-days-input").value);
      try {
        const saved = await window.api.setRewardExpiryDays(days);
        this.showToast(APP_CONSTANTS.MESSAGES.REWARD_EXPIRY_SAVED(saved));
      } catch (err) {
        alert(err.message);
      }
    });

    // New User Welcome Bonus Preset Chips
    document.querySelectorAll(".btn-welcome-bonus-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const amt = btn.dataset.amount;
        const input = document.getElementById("admin-welcome-bonus-input");
        if (input) input.value = amt;
      });
    });

    // New User Welcome Bonus Form Submit
    document.getElementById("form-admin-welcome-bonus-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const amt = Number(document.getElementById("admin-welcome-bonus-input").value);
      try {
        const saved = await window.api.setWelcomeBonusAmount(amt);
        this.showToast(APP_CONSTANTS.MESSAGES.WELCOME_BONUS_SAVED(saved));
      } catch (err) {
        alert(err.message);
      }
    });

    // Admin UPI ID Form Submit
    document.getElementById("form-admin-upi-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newUpi = document.getElementById("admin-upi-input")?.value?.trim() || "gyananiharish@ybl";
      try {
        const saved = await window.api.setAdminUPI(newUpi);
        const msg = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.MESSAGES.ADMIN_UPI_SAVED)
          ? APP_CONSTANTS.MESSAGES.ADMIN_UPI_SAVED(saved)
          : "UPI saved!";
        this.showToast(msg);
      } catch (err) {
        alert(err.message);
      }
    });

    // Cancellation Cutoff Preset Chips
    document.querySelectorAll(".btn-cutoff-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const hours = btn.dataset.hours;
        const input = document.getElementById("admin-cutoff-input");
        if (input) input.value = hours;
      });
    });

    // Cancellation Cutoff Form Submit
    document.getElementById("form-admin-cutoff-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const hours = Number(document.getElementById("admin-cutoff-input").value);
      try {
        const saved = await window.api.setCancellationCutoffHours(hours);
        this.showToast(APP_CONSTANTS.MESSAGES.CUTOFF_SAVED(saved));
      } catch (err) {
        alert(err.message);
      }
    });

    // Slot Change / Reschedule Cutoff Preset Chips
    document.querySelectorAll(".btn-reschedule-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const hours = btn.dataset.hours;
        const input = document.getElementById("admin-reschedule-cutoff-input");
        if (input) input.value = hours;
      });
    });

    // Slot Change Cutoff Form Submit
    document.getElementById("form-admin-reschedule-cutoff-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const hours = Number(document.getElementById("admin-reschedule-cutoff-input").value);
      try {
        const saved = await window.api.setRescheduleCutoffHours(hours);
        this.showToast(APP_CONSTANTS.MESSAGES.RESCHEDULE_CUTOFF_SAVED(saved));
      } catch (err) {
        alert(err.message);
      }
    });

    // Upgrade Ratio Preset Chips
    document.querySelectorAll(".btn-upgrade-ratio-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const ratio = btn.dataset.ratio;
        const input = document.getElementById("admin-upgrade-ratio-input");
        if (input) input.value = ratio;
      });
    });

    // Upgrade Ratio Form Submit
    document.getElementById("form-admin-upgrade-ratio-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ratio = Number(document.getElementById("admin-upgrade-ratio-input").value);
      try {
        const saved = await window.api.setWalletUpgradeRatio(ratio);
        this.showToast(APP_CONSTANTS.MESSAGES.UPGRADE_RATIO_SAVED(saved));
      } catch (err) {
        alert(err.message);
      }
    });

    // Policy Refund Presets
    document.querySelectorAll(".btn-policy-refund-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const pct = btn.dataset.pct;
        const input = document.getElementById("admin-refund-pct-input");
        if (input) input.value = pct;
      });
    });

    // Default Policy Refund % Form Submit
    document.getElementById("form-admin-refund-pct-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pct = Number(document.getElementById("admin-refund-pct-input").value);
      try {
        const saved = await window.api.setDefaultRefundPercent(pct);
        this.showToast(APP_CONSTANTS.MESSAGES.REFUND_RATE_SAVED(saved));
      } catch (err) {
        alert(err.message);
      }
    });

    // Booking Filter Tabs
    document.querySelectorAll(".btn-booking-filter").forEach(btn => {
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".btn-booking-filter").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.bookingFilter = btn.dataset.filter;
        await this.renderAllBookings();
      });
    });

    // Refund Modal Close & Abort
    document.getElementById("btn-close-refund-modal")?.addEventListener("click", () => this.closeRefundModal());
    document.getElementById("btn-abort-refund")?.addEventListener("click", () => this.closeRefundModal());

    // Refund Preset Buttons
    document.querySelectorAll(".btn-refund-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!this.activeRefundBooking) return;
        const pct = Number(btn.dataset.pct);
        const amount = Number(((this.activeRefundBooking.price * pct) / 100).toFixed(2));
        const input = document.getElementById("refund-input-amount");
        if (input) input.value = amount;
      });
    });

    // Refund Form Submit (Manual Refund Disbursement)
    document.getElementById("form-admin-disburse-refund")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bookingId = Number(document.getElementById("refund-booking-id").value);
      const amount = Number(document.getElementById("refund-input-amount").value);
      const note = document.getElementById("refund-input-note").value;
      try {
        const res = await window.api.processManualRefund(bookingId, amount, note);
        this.closeRefundModal();
        const userName = res.user?.name || `User #${res.booking.user_id}`;
        this.showToast(APP_CONSTANTS.MESSAGES.REFUND_SENT(amount, userName));
        await this.renderAllBookings();
        await this.refreshOverview();
      } catch (err) {
        alert(err.message);
      }
    });
  }

});
