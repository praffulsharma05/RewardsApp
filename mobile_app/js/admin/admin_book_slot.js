/**
 * admin_book_slot.js - Admin Slot Booking on Behalf of Users
 */
Object.assign(MobileAdminApp.prototype, {
  bindBookSlotEvents() {
    document.getElementById("btn-open-admin-book-slot")?.addEventListener("click", () => {
      this.openBookSlotModal();
    });

    document.getElementById("btn-quick-book-slot")?.addEventListener("click", async () => {
      await this.switchToScreen("screen-bookings");
      this.openBookSlotModal();
    });

    document.getElementById("btn-close-book-slot-modal")?.addEventListener("click", () => {
      this.closeBookSlotModal();
    });

    document.getElementById("btn-abort-book-slot")?.addEventListener("click", () => {
      this.closeBookSlotModal();
    });

    document.querySelectorAll(".btn-admin-book-date-chip").forEach(btn => {
      btn.addEventListener("click", async () => {
        const offset = Number(btn.dataset.offset || 0);
        const dateInput = document.getElementById("admin-book-date");
        if (dateInput) {
          dateInput.value = this.getDateString(offset);
          await this.renderBookSlotGrid();
        }
      });
    });

    document.getElementById("admin-book-user-select")?.addEventListener("change", async () => {
      await this.updateBookSlotSummary();
    });

    document.getElementById("btn-book-mode-existing")?.addEventListener("click", async () => {
      await this.setBookUserMode("existing");
    });

    document.getElementById("btn-book-mode-new")?.addEventListener("click", async () => {
      await this.setBookUserMode("new");
    });

    document.getElementById("btn-admin-book-daily")?.addEventListener("click", async () => {
      await this.setAdminBookMode("DAILY");
    });

    document.getElementById("btn-admin-book-monthly")?.addEventListener("click", async () => {
      await this.setAdminBookMode("MONTHLY");
    });

    document.getElementById("admin-book-date")?.addEventListener("change", async () => {
      await this.renderBookSlotGrid();
    });

    document.getElementById("admin-book-sport-select")?.addEventListener("change", async (e) => {
      await this.populateBookSlotCourts(e.target.value);
      await this.renderBookSlotGrid();
    });

    document.getElementById("admin-book-court-select")?.addEventListener("change", async () => {
      await this.renderBookSlotGrid();
    });

    document.getElementById("admin-book-payment-method")?.addEventListener("change", async () => {
      await this.updateBookSlotUpiVisibility();
    });

    document.getElementById("btn-admin-book-copy-upi")?.addEventListener("click", () => {
      const upi = document.getElementById("admin-book-upi-id")?.textContent?.trim() || "gyananiharish@ybl";
      try { navigator.clipboard?.writeText(upi); } catch (_) {}
      this.showToast("UPI ID copied!");
    });

    document.getElementById("form-admin-book-slot")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleAdminBookSlotSubmit();
    });
  },

  async openBookSlotModal(preselectedUserId = null) {
    this.bookSlotUsers = [];
    this.bookSlotList = [];
    this.selectedBookSlots = [];
    this.bookUserMode = "existing";
    this.adminBookMode = "DAILY";

    const monthlyCfg = (window.api && window.api.getMonthlyBookingConfig)
      ? await window.api.getMonthlyBookingConfig()
      : { enabled: true, discountPercent: 15, daysCount: 30 };
    this.adminBookMonthlyCfg = monthlyCfg;
    const typeWrap = document.getElementById("admin-book-type-wrap");
    const pctSpan = document.getElementById("badge-admin-book-monthly-pct");
    if (typeWrap) typeWrap.classList.toggle("d-none", !monthlyCfg.enabled);
    if (pctSpan) pctSpan.textContent = `(${monthlyCfg.discountPercent}% Off)`;
    document.getElementById("btn-admin-book-daily")?.classList.add("active");
    document.getElementById("btn-admin-book-monthly")?.classList.remove("active");
    document.getElementById("admin-book-monthly-banner")?.classList.add("d-none");

    const dateInput = document.getElementById("admin-book-date");
    const today = this.getDateString(0);
    if (dateInput) {
      dateInput.min = today;
      dateInput.value = today;
    }

    const paySelect = document.getElementById("admin-book-payment-method");
    if (paySelect) paySelect.value = "COD";

    const newName = document.getElementById("admin-book-new-name");
    const newEmail = document.getElementById("admin-book-new-email");
    const newPhone = document.getElementById("admin-book-new-phone");
    const newPass = document.getElementById("admin-book-new-password");
    if (newName) newName.value = "";
    if (newEmail) newEmail.value = "";
    if (newPhone) newPhone.value = "";
    if (newPass) newPass.value = "";

    await this.populateBookSlotUsers(preselectedUserId);
    if (this.bookSlotUsers.length === 0) {
      await this.setBookUserMode("new");
    } else {
      await this.setBookUserMode("existing");
    }
    await this.populateBookSlotSports();
    await this.renderBookSlotGrid();

    document.getElementById("modal-admin-book-slot")?.classList.add("active");
  },

  async setBookUserMode(mode) {
    this.bookUserMode = mode === "new" ? "new" : "existing";
    const isNew = this.bookUserMode === "new";

    document.getElementById("btn-book-mode-existing")?.classList.toggle("active", !isNew);
    document.getElementById("btn-book-mode-new")?.classList.toggle("active", isNew);
    document.getElementById("admin-book-existing-user-wrap")?.classList.toggle("d-none", isNew);
    document.getElementById("admin-book-new-user-wrap")?.classList.toggle("d-none", !isNew);

    await this.updateBookSlotSummary();
  },

  async setAdminBookMode(mode) {
    const cfg = this.adminBookMonthlyCfg || { enabled: true, discountPercent: 15, daysCount: 30 };
    this.adminBookMode = (mode === "MONTHLY" && cfg.enabled) ? "MONTHLY" : "DAILY";
    const isMonthly = this.adminBookMode === "MONTHLY";

    document.getElementById("btn-admin-book-daily")?.classList.toggle("active", !isMonthly);
    document.getElementById("btn-admin-book-monthly")?.classList.toggle("active", isMonthly);
    await this.renderBookSlotGrid();
  },

  closeBookSlotModal() {
    document.getElementById("modal-admin-book-slot")?.classList.remove("active");
    this.selectedBookSlots = [];
  },

  async populateBookSlotUsers(preselectedUserId = null) {
    const select = document.getElementById("admin-book-user-select");
    if (!select) return;

    const users = await window.api.getAllUsers();
    this.bookSlotUsers = users;

    if (users.length === 0) {
      select.innerHTML = `<option value="">No registered users available</option>`;
      return;
    }

    select.innerHTML = users.map(u => {
      const bal = Number(u.wallet_balance || 0).toFixed(2);
      return `<option value="${u.id}">${u.name} (#${u.id}) - ₹${bal}</option>`;
    }).join("");

    if (preselectedUserId && users.some(u => u.id === Number(preselectedUserId))) {
      select.value = String(preselectedUserId);
    }
  },

  async populateBookSlotSports() {
    const select = document.getElementById("admin-book-sport-select");
    if (!select) return;

    const sports = await window.api.getSports();
    if (sports.length === 0) {
      select.innerHTML = `<option value="">No sports available</option>`;
      await this.populateBookSlotCourts(null);
      return;
    }

    select.innerHTML = sports.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    await this.populateBookSlotCourts(sports[0].id);
  },

  async populateBookSlotCourts(sportId) {
    const select = document.getElementById("admin-book-court-select");
    if (!select) return;

    if (!sportId) {
      select.innerHTML = `<option value="">No courts available</option>`;
      return;
    }

    const courts = await window.api.getCourts(sportId);
    if (courts.length === 0) {
      select.innerHTML = `<option value="">No courts for this sport</option>`;
      return;
    }

    select.innerHTML = courts.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  },

  async renderBookSlotGrid() {
    const container = document.getElementById("admin-book-slots-grid");
    const hiddenInput = document.getElementById("admin-book-slot-id");
    const courtId = document.getElementById("admin-book-court-select")?.value;
    const dateStr = document.getElementById("admin-book-date")?.value || this.getDateString(0);

    this.selectedBookSlots = [];
    if (hiddenInput) hiddenInput.value = "";
    const countBadge = document.getElementById("admin-book-slots-count");
    if (countBadge) countBadge.textContent = "0 Selected";

    if (!container) return;
    if (!courtId) {
      container.innerHTML = `<p class="wf-meta">Select a sport and court to view available slots.</p>`;
      await this.updateBookSlotSummary();
      return;
    }

    const isMonthly = this.adminBookMode === "MONTHLY";
    const monthlyCfg = this.adminBookMonthlyCfg || { enabled: true, discountPercent: 15, daysCount: 30 };
    const monthlyBanner = document.getElementById("admin-book-monthly-banner");
    if (monthlyBanner) {
      if (isMonthly && window.api._getDateRange) {
        const range = window.api._getDateRange(dateStr, monthlyCfg.daysCount);
        const fmt = (iso) => {
          const [, m, d] = iso.split("-").map(Number);
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          return `${d} ${months[m - 1] || ""}`;
        };
        monthlyBanner.classList.remove("d-none");
        monthlyBanner.textContent = `Monthly Pass (${monthlyCfg.daysCount}d): ${fmt(dateStr)} – ${fmt(range[range.length - 1])} • ${monthlyCfg.discountPercent}% Off`;
      } else {
        monthlyBanner.classList.add("d-none");
      }
    }

    const slots = isMonthly
      ? await window.api.getMonthlySlots(courtId, dateStr)
      : await window.api.getSlots(courtId, dateStr);
    this.bookSlotList = slots;

    if (slots.length === 0) {
      container.innerHTML = `<p class="wf-meta">No slots configured for this court.</p>`;
      await this.updateBookSlotSummary();
      return;
    }

    container.innerHTML = slots.map(s => {
      const isDisabled = s.is_booked || s.is_unavailable;
      let statusText = `₹${s.price}`;
      if (s.is_booked) {
        statusText = (isMonthly && s.conflict_days) ? `Conflict (${s.conflict_days}d)` : "Booked";
      } else if (s.is_unavailable) {
        statusText = s.is_past ? "Passed" : "Closed";
      } else if (isMonthly) {
        statusText = `₹${Number(s.price).toFixed(0)}/mo (${s.discount_percent}% off)`;
      }
      const titleAttr = s.is_booked
        ? "Already booked"
        : (s.unavailability_reason || `${s.start_time} - ${s.end_time}`);

      return `
        <button
          type="button"
          class="admin-slot-chip ${isDisabled ? "disabled" : ""}"
          data-slot-id="${s.id}"
          title="${titleAttr}"
          ${isDisabled ? "disabled" : ""}
        >
          <span class="admin-slot-time">${s.start_time} - ${s.end_time}</span>
          <span class="admin-slot-meta">${statusText}</span>
        </button>
      `;
    }).join("");

    container.querySelectorAll(".admin-slot-chip:not(.disabled)").forEach(btn => {
      btn.addEventListener("click", async () => {
        const slotId = Number(btn.dataset.slotId);
        const existingIdx = this.selectedBookSlots.findIndex(s => Number(s.id) === slotId);
        if (existingIdx >= 0) {
          this.selectedBookSlots.splice(existingIdx, 1);
          btn.classList.remove("selected");
        } else {
          const slotObj = this.bookSlotList.find(s => s.id === slotId);
          if (slotObj) this.selectedBookSlots.push(slotObj);
          btn.classList.add("selected");
        }
        if (hiddenInput) hiddenInput.value = this.selectedBookSlots.map(s => s.id).join(",");
        const countBadge = document.getElementById("admin-book-slots-count");
        if (countBadge) countBadge.textContent = `${this.selectedBookSlots.length} Selected`;
        await this.updateBookSlotSummary();
      });
    });

    await this.updateBookSlotSummary();
  },

  async setAdminBookMode(mode) {
    const cfg = this.adminBookMonthlyCfg || { enabled: true, discountPercent: 15, daysCount: 30 };
    this.adminBookMode = (mode === "MONTHLY" && cfg.enabled) ? "MONTHLY" : "DAILY";
    const isMonthly = this.adminBookMode === "MONTHLY";

    document.getElementById("btn-admin-book-daily")?.classList.toggle("active", !isMonthly);
    document.getElementById("btn-admin-book-monthly")?.classList.toggle("active", isMonthly);
    await this.renderBookSlotGrid();
  },

  async updateBookSlotSummary() {
    const slotPrice = (this.selectedBookSlots || []).reduce((sum, s) => sum + Number(s.price || 0), 0);
    const rewardRate = await window.api.getRewardRate();
    const netPayable = Number(slotPrice.toFixed(2));
    const rewardEarned = Number(((slotPrice * rewardRate) / 100).toFixed(2));

    const feeEl = document.getElementById("admin-book-summary-fee");
    const netEl = document.getElementById("admin-book-summary-net");
    const rewardEl = document.getElementById("admin-book-summary-reward");

    if (feeEl) feeEl.textContent = `₹${slotPrice.toFixed(2)}`;
    if (netEl) netEl.textContent = `₹${netPayable.toFixed(2)}`;
    if (rewardEl) rewardEl.textContent = `+₹${rewardEarned.toFixed(2)}`;

    this.lastBookNetPayable = netPayable;
    await this.updateBookSlotUpiVisibility();
  },

  async updateBookSlotUpiVisibility() {
    const upiBox = document.getElementById("admin-book-upi-box");
    const payMethod = document.getElementById("admin-book-payment-method")?.value || "COD";
    if (!upiBox) return;

    const showUpi = payMethod === "UPI";
    upiBox.classList.toggle("d-none", !showUpi);

    if (showUpi) {
      const adminUpi = (window.api && window.api.getAdminUPI) ? await window.api.getAdminUPI() : "gyananiharish@ybl";
      const upiIdEl = document.getElementById("admin-book-upi-id");
      const upiAmtEl = document.getElementById("admin-book-upi-amount");
      if (upiIdEl) upiIdEl.textContent = adminUpi || "gyananiharish@ybl";
      if (upiAmtEl) upiAmtEl.textContent = `₹${Number(this.lastBookNetPayable || 0).toFixed(2)}`;
    }
  },

  async handleAdminBookSlotSubmit() {
    const isNew = this.bookUserMode === "new";
    let userId = Number(document.getElementById("admin-book-user-select")?.value || 0);
    let userName = "";

    const sportId = Number(document.getElementById("admin-book-sport-select")?.value || 0);
    const courtId = Number(document.getElementById("admin-book-court-select")?.value || 0);
    const selectedSlots = this.selectedBookSlots || [];
    const date = document.getElementById("admin-book-date")?.value;
    const useWallet = false;
    const paymentMethod = document.getElementById("admin-book-payment-method")?.value || "COD";

    if (isNew) {
      const name = document.getElementById("admin-book-new-name")?.value.trim() || "";
      const email = document.getElementById("admin-book-new-email")?.value.trim() || "";
      const phone = document.getElementById("admin-book-new-phone")?.value.trim() || "";
      const password = document.getElementById("admin-book-new-password")?.value || "";
      if (!name || !email) {
        this.showToast("Enter user's name and email!");
        return;
      }
      if (!password || password.length < 4) {
        this.showToast("Set password (min 4 chars)!");
        return;
      }
      if (!sportId || !courtId) {
        this.showToast("Select a sport and court!");
        return;
      }
      if (selectedSlots.length === 0) {
        this.showToast("Select at least one time slot!");
        return;
      }

      try {
        const createdUser = await window.api.register(name, email, password, phone);
        userId = createdUser.id;
        userName = createdUser.name;
      } catch (err) {
        this.showToast(err.message || "Failed to register user!");
        return;
      }
    } else {
      if (!userId) {
        this.showToast("Select a user or + New User!");
        return;
      }
      if (!sportId || !courtId) {
        this.showToast("Select a sport and court!");
        return;
      }
      if (selectedSlots.length === 0) {
        this.showToast("Select at least one time slot!");
        return;
      }
      const user = (this.bookSlotUsers || []).find(u => u.id === userId);
      userName = user ? user.name : `User #${userId}`;
    }

    let bookedCount = 0;
    const isMonthly = this.adminBookMode === "MONTHLY";
    try {
      for (const s of selectedSlots) {
        if (isMonthly) {
          await window.api.createMonthlyBooking({
            userId,
            sportId,
            courtId,
            slotId: s.id,
            startDate: date,
            useWallet,
            paymentMethod
          });
        } else {
          await window.api.createBooking({
            userId,
            sportId,
            courtId,
            slotId: s.id,
            date,
            useWallet,
            paymentMethod
          });
        }
        bookedCount++;
      }

      const msg = isMonthly
        ? `Monthly pass (${bookedCount} slot${bookedCount > 1 ? "s" : ""}) booked for ${userName}!`
        : (bookedCount > 1
          ? `${bookedCount} slots booked for ${userName}!`
          : ((typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.MESSAGES.ADMIN_BOOKING_CREATED)
            ? APP_CONSTANTS.MESSAGES.ADMIN_BOOKING_CREATED(userName)
            : `Slot booked for ${userName}!`));

      this.closeBookSlotModal();
      this.showToast(msg);
      await this.renderAllBookings();
      await this.refreshOverview();
      if (this.currentScreen === "screen-users") {
        await this.renderUsersList();
      }
    } catch (err) {
      if (bookedCount > 0) {
        await this.renderAllBookings();
        await this.refreshOverview();
      }
      this.showToast(err.message || "Booking failed!");
    }
  }
});
