/**
 * admin_events_facility.js - Navigation Tabs, Facility Closed & Unavailability Events
 */
Object.assign(MobileAdminApp.prototype, {
  bindNavigationAndFacilityEvents() {
    // Bottom Navigation
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.addEventListener("click", async () => {
        const target = tab.dataset.target;
        await this.switchToScreen(target);
      });
    });

    // Hash change event (supports browser back/forward buttons)
    window.addEventListener("hashchange", async () => {
      const raw = window.location.hash.replace("#", "");
      const valid = [
        "screen-overview", "screen-games", "screen-pricing",
        "screen-users", "screen-rewards", "screen-bookings"
      ];
      const target = valid.includes(raw) ? raw : (valid.includes("screen-" + raw) ? "screen-" + raw : null);
      if (target && target !== this.currentScreen) {
        await this.switchToScreen(target);
      }
    });

    // Refresh Header Button
    document.getElementById("btn-admin-refresh")?.addEventListener("click", async () => {
      await this.refreshOverview();
      if (this.currentScreen === "screen-games") await this.renderGamesList();
      if (this.currentScreen === "screen-pricing") await this.renderPricingSchedule();
      if (this.currentScreen === "screen-users") await this.renderUsersList();
      if (this.currentScreen === "screen-rewards") await this.loadRewardSettings();
      if (this.currentScreen === "screen-bookings") await this.renderAllBookings();
      this.showToast(APP_CONSTANTS.MESSAGES.REFRESHED);
    });

    // Quick Action Buttons on Overview
    document.getElementById("btn-quick-add-game")?.addEventListener("click", async () => {
      await this.switchToScreen("screen-games");
      this.openAddGameModal();
    });

    document.getElementById("btn-quick-pricing")?.addEventListener("click", async () => {
      await this.switchToScreen("screen-pricing");
    });

    document.getElementById("btn-quick-config-rewards")?.addEventListener("click", async () => {
      await this.switchToScreen("screen-rewards");
    });

    document.getElementById("btn-goto-rules")?.addEventListener("click", async () => {
      await this.switchToScreen("screen-rewards");
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
        rowCloseTimes.classList.toggle("d-none", chkFullDay.checked);
        if (lblHint) lblHint.textContent = chkFullDay.checked ? " " : " ";
      });
    }

    document.querySelectorAll(".btn-quick-close-time-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        if (chkFullDay) chkFullDay.checked = false;
        if (rowCloseTimes) rowCloseTimes.classList.remove("d-none");
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
        this.showToast(APP_CONSTANTS.MESSAGES.CLOSED_DATE_MARKED(date, timeLabel, reason));
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
      const rawVal = document.getElementById("unavail-court-select")?.value || "court:0:All Grounds";
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
        this.showToast(APP_CONSTANTS.MESSAGES.GROUND_BLOCKED(targetName, startTime, endTime));
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
      if (row) row.classList.toggle("d-none", e.target.value !== "SPECIFIC");
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

    // Expandable & Collapsible Admin Rule Sections & Cards
    this.bindRuleAccordionEvents();
  },

  bindRuleAccordionEvents() {
    // 1. Section Header Accordion (Only one section open at a time; others auto-close)
    document.querySelectorAll(".rules-section-header").forEach(hdr => {
      hdr.addEventListener("click", () => {
        const section = hdr.closest(".rules-section-accordion");
        if (!section) return;
        const isCurrentlyExpanded = section.classList.contains("expanded");

        // Auto-close all other sections
        document.querySelectorAll(".rules-section-accordion").forEach(s => {
          s.classList.remove("expanded");
        });

        // Toggle: open if previously closed
        if (!isCurrentlyExpanded) {
          section.classList.add("expanded");
        }
      });
    });

    // 2. Card Header Accordion (Only one card open in parent container; others auto-close)
    document.querySelectorAll(".card-collapse-header").forEach(hdr => {
      hdr.addEventListener("click", () => {
        const card = hdr.closest(".card-accordion");
        if (!card) return;
        const isCurrentlyExpanded = card.classList.contains("expanded");
        const parent = card.parentElement;

        // Auto-close other card accordions in the same container
        if (parent) {
          parent.querySelectorAll(".card-accordion").forEach(c => {
            if (c !== card) c.classList.remove("expanded");
          });
        }

        // Toggle: open if previously closed, close if open
        card.classList.toggle("expanded", !isCurrentlyExpanded);
      });
    });
  }
});
