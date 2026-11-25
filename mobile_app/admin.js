/**
 * admin.js - Mobile Wireframe Admin Panel Controller
 * Interacts directly with the shared IndexedDB (SportsSlotWireframeDB).
 */

class MobileAdminApp {
  constructor() {
    this.currentScreen = "screen-overview";
    this.pendingDeleteSportId = null;
    this.pendingDeleteUserId = null;
    this.bookingFilter = "all";
    this.activeRefundBooking = null;
  }

  async init() {
    // 1. Initialize IndexedDB (shared with user app)
    await window.api.init();

    // 2. Bind Events
    this.bindEvents();

    // 3. Load Overview and Initial Screen
    await this.refreshOverview();
    await this.renderGamesList();
    await this.populateUnavailabilityCourts();
  }

  showToast(msg) {
    const toast = document.getElementById("admin-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }

  navigateTo(screenId) {
    document.querySelectorAll(".admin-screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add("active");
      this.currentScreen = screenId;
    }

    // Update Bottom Navigation Active States
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.target === screenId);
    });

    const titles = {
      "screen-overview": "Admin Overview",
      "screen-games": "Manage Sports",
      "screen-pricing": "Slot Pricing",
      "screen-users": "Player Registry",
      "screen-rewards": "Rules & Availability",
      "screen-bookings": "All Bookings"
    };

    const titleElem = document.getElementById("header-admin-title");
    if (titleElem) titleElem.textContent = titles[screenId] || "Admin Panel";
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  bindEvents() {
    // Bottom Navigation
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.addEventListener("click", async () => {
        const target = tab.dataset.target;
        this.navigateTo(target);

        if (target === "screen-overview") await this.refreshOverview();
        if (target === "screen-games") await this.renderGamesList();
        if (target === "screen-pricing") await this.renderPricingSchedule();
        if (target === "screen-users") await this.renderUsersList();
        if (target === "screen-rewards") await this.loadRewardSettings();
        if (target === "screen-bookings") await this.renderAllBookings();
      });
    });

    // Refresh Header Button
    document.getElementById("btn-admin-refresh")?.addEventListener("click", async () => {
      await this.refreshOverview();
      if (this.currentScreen === "screen-games") await this.renderGamesList();
      if (this.currentScreen === "screen-pricing") await this.renderPricingSchedule();
      if (this.currentScreen === "screen-users") await this.renderUsersList();
      if (this.currentScreen === "screen-rewards") await this.loadRewardSettings();
      if (this.currentScreen === "screen-bookings") await this.renderAllBookings();
      this.showToast("Admin data synced from IndexedDB");
    });

    // Quick Action Buttons on Overview
    document.getElementById("btn-quick-add-game")?.addEventListener("click", () => {
      this.navigateTo("screen-games");
      this.openAddGameModal();
    });

    document.getElementById("btn-quick-pricing")?.addEventListener("click", async () => {
      this.navigateTo("screen-pricing");
      await this.renderPricingSchedule();
    });

    document.getElementById("btn-quick-config-rewards")?.addEventListener("click", () => {
      this.navigateTo("screen-rewards");
      this.loadRewardSettings();
    });

    document.getElementById("btn-goto-rules")?.addEventListener("click", async () => {
      this.navigateTo("screen-rewards");
      await this.loadRewardSettings();
    });

    // Facility Closed Dates Form (Full Day or Time Window)
    const inputCloseDate = document.getElementById("input-close-date");
    if (inputCloseDate) {
      inputCloseDate.value = this.getDateString(0);
      inputCloseDate.min = this.getDateString(0);
    }

    const chkFullDay = document.getElementById("chk-close-full-day");
    const rowCloseTimes = document.getElementById("row-close-times");
    const lblHint = document.getElementById("lbl-close-window-hint");
    if (chkFullDay && rowCloseTimes) {
      chkFullDay.addEventListener("change", () => {
        rowCloseTimes.style.display = chkFullDay.checked ? "none" : "flex";
        if (lblHint) lblHint.textContent = chkFullDay.checked ? "All day" : "Specific hours";
      });
    }

    document.querySelectorAll(".btn-quick-close-time-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        if (chkFullDay) chkFullDay.checked = false;
        if (rowCloseTimes) rowCloseTimes.style.display = "flex";
        if (lblHint) lblHint.textContent = "10 AM - 2 PM";
        const startTime = document.getElementById("input-close-start-time");
        const endTime = document.getElementById("input-close-end-time");
        if (startTime) startTime.value = btn.dataset.start || "10:00";
        if (endTime) endTime.value = btn.dataset.end || "14:00";
      });
    });

    document.getElementById("form-add-closed-date")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = document.getElementById("input-close-date").value;
      const reason = document.getElementById("input-close-reason").value.trim() || "Facility Maintenance";
      const isFullDay = document.getElementById("chk-close-full-day") ? document.getElementById("chk-close-full-day").checked : true;
      const startTime = isFullDay ? "00:00" : (document.getElementById("input-close-start-time")?.value || "10:00");
      const endTime = isFullDay ? "24:00" : (document.getElementById("input-close-end-time")?.value || "14:00");

      try {
        await window.api.addClosedDate(date, reason, startTime, endTime, isFullDay);
        const timeLabel = isFullDay ? "Full Day" : `${startTime} - ${endTime}`;
        this.showToast(`Marked ${date} [${timeLabel}] as CLOSED (${reason})!`);
        await this.renderClosedDatesList();
        await this.renderOverviewRulesSummary();
      } catch (err) {
        alert(err.message);
      }
    });

    // Quick Close Chips (Today / Tomorrow)
    document.querySelectorAll(".btn-quick-close-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const offset = Number(btn.dataset.offset || 0);
        const input = document.getElementById("input-close-date");
        if (input) input.value = this.getDateString(offset);
      });
    });

    // Ground & Academy Unavailability Form Submit (10 AM - 5 PM)
    document.getElementById("form-add-unavailability")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rawVal = document.getElementById("unavail-court-select")?.value || "court:0:All Academy Grounds";
      const parts = rawVal.split(":");
      const type = parts[0]; // "court" or "sport"
      const targetId = Number(parts[1] || 0);
      const targetName = parts.slice(2).join(":") || "Facility Ground";

      const courtId = type === "court" ? targetId : 0;
      const sportId = type === "sport" ? targetId : 0;

      const startTime = document.getElementById("unavail-start-time")?.value || "10:00";
      const endTime = document.getElementById("unavail-end-time")?.value || "17:00";
      const reason = document.getElementById("unavail-reason")?.value.trim() || "Academy Coaching (10 AM - 5 PM)";
      const dateType = document.getElementById("unavail-date-type")?.value || "ALL_DAYS";

      let resolvedDate = "ALL_DAYS";
      if (dateType === "TODAY") resolvedDate = this.getDateString(0);
      else if (dateType === "TOMORROW") resolvedDate = this.getDateString(1);
      else if (dateType === "SPECIFIC") {
        resolvedDate = document.getElementById("unavail-specific-date")?.value || this.getDateString(0);
      }

      try {
        await window.api.addPlaygroundUnavailability({
          courtId,
          sportId,
          courtName: targetName,
          startTime,
          endTime,
          reason,
          date: resolvedDate
        });
        this.showToast(`Blocked ${targetName} [${startTime} - ${endTime}]!`);
        await this.renderUnavailabilityList();
        await this.renderOverviewRulesSummary();
      } catch (err) {
        alert(err.message);
      }
    });

    // Toggle specific date input for unavailability
    document.getElementById("unavail-date-type")?.addEventListener("change", (e) => {
      const row = document.getElementById("row-unavail-specific-date");
      const input = document.getElementById("unavail-specific-date");
      if (row) row.style.display = (e.target.value === "SPECIFIC") ? "block" : "none";
      if (input && e.target.value === "SPECIFIC" && !input.value) {
        input.value = this.getDateString(0);
      }
    });

    // Unavailability Preset Chips
    document.querySelectorAll(".btn-unavail-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        const reason = btn.dataset.reason;
        const inputStart = document.getElementById("unavail-start-time");
        const inputEnd = document.getElementById("unavail-end-time");
        const inputReason = document.getElementById("unavail-reason");
        if (inputStart) inputStart.value = start;
        if (inputEnd) inputEnd.value = end;
        if (inputReason) inputReason.value = reason;
      });
    });

    // Game & Slot Day-Wise Pricing Form Submit
    document.getElementById("form-peak-pricing")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sportSelect = document.getElementById("pricing-sport-select");
      const sportId = sportSelect ? sportSelect.value : "1";
      const sportName = sportSelect?.options[sportSelect.selectedIndex]?.text || "Selected Game";
      const slotVal = document.getElementById("pricing-slot-select")?.value || "18:00-19:00";
      const dayType = document.getElementById("pricing-day-type")?.value || "ALL";
      const price = Number(document.getElementById("price-rate-value").value);

      try {
        let count = 0;
        if (slotVal === "peak" || slotVal === "day" || slotVal === "all-slots") {
          let start = "00:00", end = "24:00";
          if (slotVal === "peak") { start = "18:00"; end = "23:00"; }
          else if (slotVal === "day") { start = "08:00"; end = "18:00"; }
          count = await window.api.updateSlotDayWisePrice(sportId, slotVal, dayType, price);
          this.showToast(`Updated ${slotVal} slots for ${sportName} (${dayType}) to $${price}! (${count} slots)`);
        } else {
          count = await window.api.updateSlotDayWisePrice(sportId, slotVal, dayType, price);
          this.showToast(`Updated ${sportName} [${slotVal}] (${dayType}) to $${price}! (${count} slots)`);
        }
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

    // Rewards Form Submit
    document.getElementById("form-admin-reward-config")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newRate = Number(document.getElementById("admin-reward-input").value);
      try {
        const saved = await window.api.setRewardRate(newRate);
        this.showToast(`IndexedDB Updated: Reward rate set to ${saved}%!`);
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
        this.showToast(`IndexedDB Updated: Reward validity period set to ${saved} Days!`);
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
        this.showToast(`IndexedDB Updated: Cancellation cutoff set to ${saved} Hours!`);
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
        this.showToast(`IndexedDB Updated: Slot change cutoff set to ${saved} Hours!`);
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
        this.showToast(`IndexedDB Updated: Slot upgrade wallet ratio set to ${saved}%!`);
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
        this.showToast(`IndexedDB Updated: Default refund rate set to ${saved}%!`);
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
        this.showToast(`IndexedDB Refund Sent: $${amount.toFixed(2)} to User #${res.booking.user_id}!`);
        await this.renderAllBookings();
        await this.refreshOverview();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  getDateString(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // ==========================================
  // SCREEN 1: OVERVIEW & STATS
  // ==========================================
  async refreshOverview() {
    const sports = await window.api.getSports();
    const courts = await window.api.getCourts();
    const users = await window.api.getAllUsers();
    const bookings = await window.api.getAllBookings();
    const rate = await window.api.getRewardRate();

    const statSports = document.getElementById("stat-sports-count");
    const statCourts = document.getElementById("stat-courts-count");
    const statRate = document.getElementById("stat-reward-rate");
    const statBookings = document.getElementById("stat-bookings-count");

    if (statSports) statSports.textContent = sports.length;
    if (statCourts) statCourts.textContent = courts.length;
    if (statRate) statRate.textContent = `${rate}%`;
    if (statBookings) statBookings.textContent = bookings.length;

    await this.renderOverviewRulesSummary();
  }

  async renderOverviewRulesSummary() {
    const closedDates = await window.api.getClosedDates();
    const facilityStatus = await window.api.getFacilityStatus();
    const unavailList = await window.api.getPlaygroundUnavailabilities();
    const cancelCutoff = await window.api.getCancellationCutoffHours();
    const reschedCutoff = await window.api.getRescheduleCutoffHours();
    const maxDiscount = await window.api.getMaxDiscountPercent();

    const elemClosed = document.getElementById("overview-closed-count");
    if (elemClosed) {
      const count = closedDates.length + (!facilityStatus.isOpen ? 1 : 0);
      const timedCount = closedDates.filter(d => d.is_full_day === false).length;
      elemClosed.textContent = `${count} active (${timedCount} timed)`;
    }

    const elemUnavail = document.getElementById("overview-unavail-count");
    if (elemUnavail) {
      elemUnavail.textContent = `${unavailList.length} block${unavailList.length === 1 ? '' : 's'} active`;
    }

    const elemCutoff = document.getElementById("overview-cutoff-text");
    if (elemCutoff) {
      elemCutoff.textContent = `Cancel: ${cancelCutoff}h | Reschedule: ${reschedCutoff}h`;
    }

    const elemCap = document.getElementById("overview-discount-cap");
    if (elemCap) {
      elemCap.textContent = `${maxDiscount}% Maximum Cap`;
    }
  }

  async renderClosedDatesList() {
    const container = document.getElementById("admin-closed-dates-list");
    const badge = document.getElementById("badge-closed-count");
    if (!container) return;

    const closedDates = await window.api.getClosedDates();
    const facilityStatus = await window.api.getFacilityStatus();

    let globalClosedCard = "";
    if (!facilityStatus.isOpen) {
      globalClosedCard = `
        <div class="wf-card highlight" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; margin-bottom:6px; border:1.5px dashed #000;">
          <div>
            <strong style="font-size:0.82rem;">[CLOSED TODAY] Active Status</strong>
            <small class="wf-meta" style="display:block;">${facilityStatus.reason}</small>
          </div>
          <button type="button" class="header-btn" id="btn-reopen-global" style="font-size:0.7rem;">Re-Open Today</button>
        </div>
      `;
    }

    const totalClosed = closedDates.length + (!facilityStatus.isOpen ? 1 : 0);
    if (badge) badge.textContent = `${totalClosed} Closed`;

    if (closedDates.length === 0 && facilityStatus.isOpen) {
      container.innerHTML = `<p class="wf-meta" style="padding:4px 0;">No blackout dates set. Facility is open for all upcoming days.</p>`;
      return;
    }

    container.innerHTML = globalClosedCard + closedDates.map(d => {
      const isFullDay = (d.is_full_day !== false);
      const timeStr = isFullDay ? "Full Day (24 hrs)" : `${d.start_time || '10:00'} - ${d.end_time || '14:00'}`;
      const entryKey = d.id || d.date;

      return `
        <div class="wf-card highlight" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; margin-bottom:6px;">
          <div>
            <div style="display:flex; gap:6px; align-items:center;">
              <strong style="font-size:0.85rem;">[${isFullDay ? 'CLOSED DATE' : 'TIMED BLACKOUT'}] ${d.date}</strong>
              <span class="header-pill" style="font-size:0.65rem;">${timeStr}</span>
            </div>
            <small class="wf-meta" style="display:block; margin-top:2px;">Reason: ${d.reason}</small>
          </div>
          <button type="button" class="header-btn btn-reopen-date" data-id="${entryKey}" style="font-size:0.7rem; color:#000;">Re-Open</button>
        </div>
      `;
    }).join("");

    document.getElementById("btn-reopen-global")?.addEventListener("click", async () => {
      await window.api.setFacilityStatus(true, "Normal Operations");
      this.showToast("Facility re-opened today!");
      await this.renderClosedDatesList();
      await this.renderOverviewRulesSummary();
    });

    container.querySelectorAll(".btn-reopen-date").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await window.api.removeClosedDate(id);
        this.showToast(`Blackout re-opened for bookings!`);
        await this.renderClosedDatesList();
        await this.renderOverviewRulesSummary();
      });
    });
  }

  async populateUnavailabilityCourts() {
    const select = document.getElementById("unavail-court-select");
    if (!select) return;

    const sports = await window.api.getSports();
    const courts = await window.api.getCourts();

    let html = `<option value="court:0:All Academy Grounds (Entire Facility)">All Academy Grounds (Entire Facility)</option>`;

    for (const sport of sports) {
      const sportCourts = courts.filter(c => c.sport_id === sport.id);
      const icon = sport.icon || "[SP]";
      html += `<optgroup label="${icon} ${sport.name} (${sportCourts.length} Ground${sportCourts.length === 1 ? '' : 's'})">`;
      html += `<option value="sport:${sport.id}:All ${sport.name} Grounds">All ${sport.name} Grounds (Entire Sport)</option>`;
      for (const c of sportCourts) {
        html += `<option value="court:${c.id}:${c.name}">${c.name} (${c.surface || 'Standard'})</option>`;
      }
      html += `</optgroup>`;
    }

    select.innerHTML = html;
  }

  async renderUnavailabilityList() {
    const container = document.getElementById("admin-unavailability-list");
    const badge = document.getElementById("badge-unavail-count");
    if (!container) return;

    const list = await window.api.getPlaygroundUnavailabilities();
    const courts = await window.api.getCourts();
    const courtMap = new Map(courts.map(c => [c.id, c.name]));

    if (badge) badge.textContent = `${list.length} Block${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      container.innerHTML = `<p class="wf-meta" style="padding:4px 0;">No playground or academy hours blocked. Grounds are available as per schedule.</p>`;
      return;
    }

    container.innerHTML = list.map(u => {
      let targetName = u.court_name;
      if (!targetName) {
        if (u.court_id === 0 && (!u.sport_id || u.sport_id === 0)) targetName = "All Academy Grounds (Entire Facility)";
        else if (u.sport_id && u.court_id === 0) targetName = `All Sport #${u.sport_id} Grounds`;
        else targetName = courtMap.get(u.court_id) || `Court #${u.court_id}`;
      }
      const dateLabel = (u.date === "ALL_DAYS") ? "Daily" : u.date;

      return `
        <div class="wf-card highlight" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; margin-bottom:6px;">
          <div>
            <div style="display:flex; gap:6px; align-items:center;">
              <strong style="font-size:0.83rem;">${targetName}</strong>
              <span class="header-pill" style="font-size:0.65rem;">${u.start_time} - ${u.end_time}</span>
              <span class="wf-meta" style="font-size:0.7rem;">(${dateLabel})</span>
            </div>
            <small class="wf-meta" style="display:block; margin-top:2px;">Reason: ${u.reason || 'Academy Coaching'}</small>
          </div>
          <button type="button" class="header-btn btn-delete-unavail" data-id="${u.id}" style="font-size:0.7rem; color:#c00;">Unblock</button>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".btn-delete-unavail").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        await window.api.deletePlaygroundUnavailability(id);
        this.showToast("Unblocked court/academy time window!");
        await this.renderUnavailabilityList();
        await this.renderOverviewRulesSummary();
      });
    });
  }

  // ==========================================
  // SCREEN 2: GAMES (ADD, UPDATE, DELETE)
  // ==========================================
  async renderGamesList() {
    const container = document.getElementById("admin-games-list-container");
    if (!container) return;

    const sports = await window.api.getSports();

    if (sports.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No sports in database. Click '+ Add Sport' above.</p></div>`;
      return;
    }

    container.innerHTML = sports.map(s => `
      <div class="game-admin-card" data-sport-id="${s.id}">
        <div class="game-admin-card-header">
          <div style="display:flex; align-items:center; gap: 8px;">
            <span class="game-icon-tag">${s.icon || '[SP]'}</span>
            <div>
              <strong style="font-size:0.9rem;">${s.name}</strong>
              <small class="wf-meta" style="display:block;">${s.category} &bull; ${s.courts_count} Courts</small>
            </div>
          </div>
          <span class="wf-meta" style="font-family:var(--font-mono); font-size:0.75rem;">ID: #${s.id}</span>
        </div>

        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="wf-btn wf-btn-secondary wf-btn-sm btn-edit-sport" data-id="${s.id}" style="flex:1;">
            Edit Sport
          </button>
          <button class="wf-btn wf-btn-danger wf-btn-sm btn-delete-sport" data-id="${s.id}" style="flex:1;">
            Delete Sport
          </button>
        </div>
      </div>
    `).join("");

    // Bind Edit and Delete Buttons
    container.querySelectorAll(".btn-edit-sport").forEach(btn => {
      btn.addEventListener("click", () => this.openEditGameModal(Number(btn.dataset.id)));
    });

    container.querySelectorAll(".btn-delete-sport").forEach(btn => {
      btn.addEventListener("click", () => this.openDeleteGameModal(Number(btn.dataset.id)));
    });
  }

  // Open Modal to Add Game
  openAddGameModal() {
    document.getElementById("modal-game-form-title").textContent = "Add New Game / Sport";
    document.getElementById("game-edit-id").value = "";
    document.getElementById("game-input-name").value = "";
    document.getElementById("game-input-category").value = "Indoor";
    document.getElementById("game-input-courts").value = 2;
    document.getElementById("game-input-icon").value = "[SP]";
    document.getElementById("btn-save-game-submit").textContent = "Create Sport in Database";
    document.getElementById("modal-game-form")?.classList.add("active");
  }

  // Open Modal to Edit Game
  async openEditGameModal(sportId) {
    const sport = await window.api.getSportById(sportId);
    if (!sport) return;

    document.getElementById("modal-game-form-title").textContent = `Edit Sport #${sport.id}`;
    document.getElementById("game-edit-id").value = sport.id;
    document.getElementById("game-input-name").value = sport.name;
    document.getElementById("game-input-category").value = sport.category || "Indoor";
    document.getElementById("game-input-courts").value = sport.courts_count || 2;
    document.getElementById("game-input-icon").value = sport.icon || "[SP]";
    document.getElementById("btn-save-game-submit").textContent = "Save Changes";
    document.getElementById("modal-game-form")?.classList.add("active");
  }

  closeGameModal() {
    document.getElementById("modal-game-form")?.classList.remove("active");
  }

  // Save Game (Add or Update)
  async handleSaveGame() {
    const editId = document.getElementById("game-edit-id").value;
    const name = document.getElementById("game-input-name").value.trim();
    const category = document.getElementById("game-input-category").value;
    const courts_count = Number(document.getElementById("game-input-courts").value);
    const icon = document.getElementById("game-input-icon").value.trim() || "[SP]";

    if (!name) {
      alert("Please provide a sport name.");
      return;
    }

    try {
      if (editId) {
        // Update existing game
        await window.api.updateSport(editId, { name, category, courts_count, icon });
        this.showToast(`Sport #${editId} (${name}) updated!`);
      } else {
        // Add new game
        const created = await window.api.addSport({ name, category, courts_count, icon });
        this.showToast(`New Sport #${created.id} (${name}) added to database!`);
      }

      this.closeGameModal();
      await this.renderGamesList();
      await this.populateUnavailabilityCourts();
      await this.refreshOverview();
    } catch (err) {
      alert(err.message);
    }
  }

  // Open Delete Confirmation Modal
  async openDeleteGameModal(sportId) {
    this.pendingDeleteSportId = sportId;
    const sport = await window.api.getSportById(sportId);
    if (!sport) return;

    document.getElementById("delete-game-name").textContent = `${sport.name} (ID #${sport.id})`;
    document.getElementById("modal-delete-game")?.classList.add("active");
  }

  closeDeleteModal() {
    document.getElementById("modal-delete-game")?.classList.remove("active");
    this.pendingDeleteSportId = null;
  }

  // Confirm Delete Game
  async handleConfirmDeleteSport() {
    if (!this.pendingDeleteSportId) return;

    try {
      await window.api.deleteSport(this.pendingDeleteSportId);
      this.showToast(`Sport #${this.pendingDeleteSportId} and associated courts deleted.`);
      this.closeDeleteModal();
      await this.renderGamesList();
      await this.populateUnavailabilityCourts();
      await this.refreshOverview();
    } catch (err) {
      alert(err.message);
    }
  }

  // ==========================================
  // SCREEN: TIME-TIERED SLOT PRICING (GAME & SLOT SELECTOR)
  // ==========================================
  async renderPricingSchedule() {
    const container = document.getElementById("pricing-tiers-container");
    const sportSelect = document.getElementById("pricing-sport-select");
    const slotSelect = document.getElementById("pricing-slot-select");
    const badgeSportLabel = document.getElementById("badge-pricing-sport-label");
    if (!container) return;

    // 1. Load all games/sports
    const sports = await window.api.getSports();
    if (!this.selectedPricingSportId) {
      this.selectedPricingSportId = sports.length > 0 ? String(sports[0].id) : "1";
    }

    if (sportSelect && sports.length > 0) {
      sportSelect.innerHTML = sports.map(s => `
        <option value="${s.id}" ${String(s.id) === String(this.selectedPricingSportId) ? "selected" : ""}>${s.name} (${s.courts_count} Courts)</option>
      `).join("") + `<option value="all" ${this.selectedPricingSportId === "all" ? "selected" : ""}>-- All Games / Sports --</option>`;
    }

    const curSport = sports.find(s => String(s.id) === String(this.selectedPricingSportId));
    const sportTitle = this.selectedPricingSportId === "all" ? "All Games" : (curSport ? curSport.name : "Game");
    if (badgeSportLabel) badgeSportLabel.textContent = sportTitle;

    // 2. Fetch slot pricing for selected sport
    const tiers = await window.api.getSlotPricingOverview(this.selectedPricingSportId);
    if (tiers.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No slots configured for ${sportTitle}.</p></div>`;
      return;
    }

    // 3. Populate slot selector dropdown
    if (slotSelect) {
      const prevVal = slotSelect.value;
      slotSelect.innerHTML = `
        <optgroup label="Single Slot Times">
          ${tiers.map(t => `<option value="${t.start}-${t.end}">${t.start} - ${t.end} (Current: $${t.price})</option>`).join("")}
        </optgroup>
        <optgroup label="Bulk Window Presets">
          <option value="peak">Peak Evening (18:00 - 23:00)</option>
          <option value="day">Daytime Hours (08:00 - 18:00)</option>
          <option value="all-slots">All Slots (Full Day)</option>
        </optgroup>
      `;
      if (prevVal) slotSelect.value = prevVal;
    }

    // 4. Render slot schedule list
    container.innerHTML = tiers.map(t => {
      const isPeak = t.start >= "18:00" && t.start < "23:00";
      return `
        <div class="wf-card ${isPeak ? "highlight" : ""}" style="padding: 8px 10px; margin-bottom: 6px;">
          <div class="wf-card-header">
            <div>
              <strong style="font-size:0.86rem;">${t.start} - ${t.end}</strong>
              <small class="wf-meta" style="display:block;">${sportTitle} &bull; ${isPeak ? "Peak Slot" : "Standard Slot"}</small>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="user-balance-pill" style="font-size:0.82rem;">$${Number(t.price).toFixed(2)}</span>
              <button type="button" class="header-btn btn-edit-single-tier" data-start="${t.start}" data-end="${t.end}" data-price="${t.price}" style="font-size:0.68rem;">Edit</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".btn-edit-single-tier").forEach(btn => {
      btn.addEventListener("click", async () => {
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        const currentPrice = btn.dataset.price;
        const input = prompt(`Set new price ($) for [${sportTitle}] at slot ${start} - ${end}:`, currentPrice);
        if (input !== null && !isNaN(Number(input)) && Number(input) > 0) {
          const newPrice = Number(input);
          await window.api.updateSlotPriceForSport(this.selectedPricingSportId, start, end, newPrice);
          this.showToast(`Updated ${sportTitle} [${start} - ${end}] to $${newPrice.toFixed(2)}!`);
          await this.renderPricingSchedule();
        }
      });
    });
  }

  // ==========================================
  // SCREEN 3: REGISTERED USERS LIST
  // ==========================================
  async renderUsersList() {
    const container = document.getElementById("admin-users-list-container");
    const badge = document.getElementById("badge-users-total");
    if (!container) return;

    const users = await window.api.getAllUsers();
    if (badge) badge.textContent = `${users.length} Player${users.length === 1 ? '' : 's'}`;

    if (users.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No registered users yet.</p></div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="user-row-card" id="user-row-${u.id}">
        <div class="user-row-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="font-size:0.88rem;">${u.name}</strong>
            <small class="wf-meta" style="display:block;">${u.email} &bull; User ID: #${u.id}</small>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="user-balance-pill" title="Current Reward Balance">
              $${(u.wallet_balance || 0).toFixed(2)}
            </span>
            <button type="button" class="wf-btn wf-btn-danger wf-btn-sm btn-delete-user" data-id="${u.id}" data-name="${u.name}" data-email="${u.email}" style="padding:4px 8px; font-size:0.75rem;">
              Remove
            </button>
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-delete-user").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const name = btn.getAttribute("data-name") || "Player";
        const email = btn.getAttribute("data-email") || "";
        this.openDeleteUserModal(id, name, email);
      });
    });
  }

  // Open User Delete Modal
  openDeleteUserModal(userId, userName, userEmail) {
    this.pendingDeleteUserId = userId;
    const nameElem = document.getElementById("delete-user-name");
    const emailElem = document.getElementById("delete-user-email");
    if (nameElem) nameElem.textContent = `${userName} (#${userId})`;
    if (emailElem) emailElem.textContent = userEmail;
    document.getElementById("modal-delete-user")?.classList.add("active");
  }

  // Close User Delete Modal
  closeDeleteUserModal() {
    document.getElementById("modal-delete-user")?.classList.remove("active");
    this.pendingDeleteUserId = null;
  }

  // Confirm Delete User
  async handleConfirmDeleteUser() {
    if (!this.pendingDeleteUserId) return;
    const id = this.pendingDeleteUserId;

    try {
      await window.api.deleteUser(id);
      this.showToast(`User #${id} removed successfully.`);
      this.closeDeleteUserModal();
      await this.renderUsersList();
      await this.refreshOverview();
    } catch (err) {
      alert(err.message);
    }
  }

  // ==========================================
  // SCREEN 4: REWARDS & CANCELLATION RULES CONFIG
  // ==========================================
  async loadRewardSettings() {
    const rate = await window.api.getRewardRate();
    const input = document.getElementById("admin-reward-input");
    if (input) input.value = rate;

    const cutoff = await window.api.getCancellationCutoffHours();
    const cutoffInput = document.getElementById("admin-cutoff-input");
    if (cutoffInput) cutoffInput.value = cutoff;

    const refundPct = await window.api.getDefaultRefundPercent();
    const refundPctInput = document.getElementById("admin-refund-pct-input");
    if (refundPctInput) refundPctInput.value = refundPct;

    const reschedCutoff = await window.api.getRescheduleCutoffHours();
    const reschedCutoffInput = document.getElementById("admin-reschedule-cutoff-input");
    if (reschedCutoffInput) reschedCutoffInput.value = reschedCutoff;

    const upgradeRatio = await window.api.getWalletUpgradeRatio();
    const upgradeRatioInput = document.getElementById("admin-upgrade-ratio-input");
    if (upgradeRatioInput) upgradeRatioInput.value = upgradeRatio;

    const expiryDays = await window.api.getRewardExpiryDays();
    const expiryDaysInput = document.getElementById("admin-expiry-days-input");
    if (expiryDaysInput) expiryDaysInput.value = expiryDays;

    const maxDiscount = await window.api.getMaxDiscountPercent();
    const maxDiscountInput = document.getElementById("admin-max-discount-input");
    if (maxDiscountInput) maxDiscountInput.value = maxDiscount;

    // Render Availability & Blackout rules in Rules screen
    await this.renderClosedDatesList();
    await this.populateUnavailabilityCourts();
    await this.renderUnavailabilityList();
    await this.renderOverviewRulesSummary();
  }

  // ==========================================
  // SCREEN 5: ALL BOOKINGS AUDIT & MANUAL REFUNDS
  // ==========================================
  async openRefundModal(bookingId) {
    const booking = await window.api.getBookingById(bookingId);
    if (!booking) return;
    this.activeRefundBooking = booking;

    document.getElementById("refund-booking-id").value = booking.id;
    document.getElementById("refund-modal-booking-meta").innerHTML = 
      `<strong>Booking #${booking.id} (${booking.sport_name} &bull; ${booking.court_name})</strong><br>User ID #${booking.user_id} &bull; Date: ${booking.date} (${booking.start_time} - ${booking.end_time})`;
    document.getElementById("refund-modal-price").textContent = `$${booking.price.toFixed(2)}`;
    document.getElementById("refund-modal-cancel-timing").textContent = 
      `Cancellation: ${booking.cancelled_at ? new Date(booking.cancelled_at).toLocaleString() : 'Recently'} (${booking.hours_before_slot != null ? booking.hours_before_slot + 'h before slot' : 'Advance'})`;

    const inputAmount = document.getElementById("refund-input-amount");
    inputAmount.value = booking.refund_amount > 0 ? booking.refund_amount : booking.price;
    inputAmount.max = booking.price;

    const inputNote = document.getElementById("refund-input-note");
    inputNote.value = booking.admin_refund_note || "Full refund per 12h policy";

    document.getElementById("modal-admin-refund")?.classList.add("active");
  }

  closeRefundModal() {
    document.getElementById("modal-admin-refund")?.classList.remove("active");
    this.activeRefundBooking = null;
  }

  async renderAllBookings() {
    const container = document.getElementById("admin-bookings-list-container");
    if (!container) return;

    let bookings = await window.api.getAllBookings();

    if (this.bookingFilter && this.bookingFilter !== "all") {
      bookings = bookings.filter(b => b.status === this.bookingFilter);
    }

    if (bookings.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No reservations match filter "${this.bookingFilter}".</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      const isConfirmed = b.status === "CONFIRMED";
      const isRefunded = b.refund_status === "REFUNDED";
      const isRefundPending = b.status === "CANCELLED" && b.refund_status === "PENDING";

      return `
        <div class="wf-card ${isConfirmed ? "" : "highlight"}" style="${isRefundPending ? 'border: 2px dashed #000;' : ''}">
          <div class="wf-card-header">
            <div>
              <strong style="font-size:0.88rem;">Booking #${b.id} &bull; ${b.sport_name}</strong>
              <small class="wf-meta" style="display:block;">User ID #${b.user_id} &bull; ${b.date}</small>
            </div>
            <div style="display:flex; gap:4px; align-items:center;">
              <span class="header-pill" style="font-size:0.68rem; background:${isConfirmed ? '#000' : '#666'};">
                ${b.status}
              </span>
              ${b.status === "CANCELLED" ? `
                <span class="header-pill" style="font-size:0.68rem; background:${isRefunded ? '#000' : '#c00'};">
                  ${isRefunded ? `REFUNDED $${Number(b.refund_amount || 0).toFixed(2)}` : 'AWAITING REFUND'}
                </span>
              ` : ''}
            </div>
          </div>
          <div style="font-size:0.78rem; line-height:1.5;">
            <div>Facility: <strong>${b.court_name}</strong> (${b.start_time} - ${b.end_time})</div>
            <div>Slot Fee: <strong>$${b.price.toFixed(2)}</strong> | Net Paid: <strong>$${(b.net_paid || b.price).toFixed(2)}</strong></div>
            
            ${b.status === "CANCELLED" ? `
              <div style="margin-top:6px; padding:6px; background:#fff; border:1px solid var(--bw-border); border-radius:4px;">
                <div><strong>Cancellation Timing:</strong> ${b.hours_before_slot != null ? `${b.hours_before_slot} hrs before slot (Policy compliant)` : 'Registered cancellation'}</div>
                <div style="margin-top:2px;"><strong>Refund State:</strong> ${isRefunded ? `<span style="color:green; font-weight:700;">Sent $${Number(b.refund_amount).toFixed(2)} to Player Wallet</span> (${b.admin_refund_note || 'Approved'})` : '<span style="color:#c00; font-weight:700;">Pending manual admin refund review</span>'}</div>
                <button type="button" class="wf-btn wf-btn-sm btn-open-refund-modal" data-id="${b.id}" style="margin-top:6px; width:100%; font-size:0.75rem; background:#000; color:#fff;">
                  ${isRefunded ? 'Edit / Adjust Refund' : 'Set & Send Refund to User'}
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    // Bind refund action buttons
    container.querySelectorAll(".btn-open-refund-modal").forEach(btn => {
      btn.addEventListener("click", () => this.openRefundModal(Number(btn.dataset.id)));
    });
  }
}

// Bootstrap Admin Application
window.addEventListener("DOMContentLoaded", () => {
  window.adminApp = new MobileAdminApp();
  window.adminApp.init();
});
