/**
 * admin_events_facility.js - Navigation Tabs, Facility Closed & Unavailability Events
 */
Object.assign(MobileAdminApp.prototype, {
  bindNavigationAndFacilityEvents() {
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
  }
});
