/**
 * admin_overview.js - Dashboard Stats, Rules Summary, Closed Dates & Blockouts
 */
Object.assign(MobileAdminApp.prototype, {
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
  },

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
  },

  async renderClosedDatesList() {
    const container = document.getElementById("admin-closed-dates-list");
    const badge = document.getElementById("badge-closed-count");
    if (!container) return;

    const closedDates = await window.api.getClosedDates();
    const facilityStatus = await window.api.getFacilityStatus();

    let globalClosedCard = "";
    if (!facilityStatus.isOpen) {
      globalClosedCard = `
        <div class="wf-card highlight facility-rule-item global-closed">
          <div class="facility-rule-info">
            <strong class="facility-rule-title text-rose-accent">CLOSED TODAY &bull; Active Status</strong>
          </div>
          <button type="button" class="header-btn btn-reopen-rule" id="btn-reopen-global">Re-Open Today</button>
        </div>
      `;
    }

    const totalClosed = closedDates.length + (!facilityStatus.isOpen ? 1 : 0);
    if (badge) badge.textContent = `${totalClosed} Closed`;

    if (closedDates.length === 0 && facilityStatus.isOpen) {
      container.innerHTML = `<p class="wf-meta" style="padding:4px 0;"> </p>`;
      return;
    }

    container.innerHTML = globalClosedCard + closedDates.map(d => {
      const isFullDay = (d.is_full_day !== false);
      const timeStr = isFullDay ? "Full Day (24 hrs)" : `${d.start_time || '10:00'} - ${d.end_time || '14:00'}`;
      const entryKey = d.id || d.date;

      return `
        <div class="wf-card highlight facility-rule-item">
          <div class="facility-rule-info">
            <strong class="facility-rule-title">${isFullDay ? 'CLOSED DATE' : 'TIMED BLACKOUT'}: ${d.date}</strong>
            <div class="facility-rule-badges">
              <span class="header-pill pill-sm">${timeStr}</span>
            </div>
          </div>
          <button type="button" class="header-btn btn-reopen-rule btn-reopen-date" data-id="${entryKey}">Re-Open</button>
        </div>
      `;
    }).join("");

    document.getElementById("btn-reopen-global")?.addEventListener("click", async () => {
      await window.api.setFacilityStatus(true, "Normal Operations");
      this.showToast(APP_CONSTANTS.MESSAGES.FACILITY_REOPENED_TODAY);
      await this.renderClosedDatesList();
      await this.renderOverviewRulesSummary();
    });

    container.querySelectorAll(".btn-reopen-date").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await window.api.removeClosedDate(id);
        this.showToast(APP_CONSTANTS.MESSAGES.BLACKOUT_REOPENED);
        await this.renderClosedDatesList();
        await this.renderOverviewRulesSummary();
      });
    });
  },

  async populateUnavailabilityCourts() {
    const select = document.getElementById("unavail-court-select");
    if (!select) return;

    const sports = await window.api.getSports();
    const courts = await window.api.getCourts();

    let html = `<option value="court:0:All Grounds">All Grounds</option>`;

    for (const sport of sports) {
      const sportCourts = courts.filter(c => c.sport_id === sport.id);
      if (sportCourts.length === 0) continue;
      html += `<optgroup label="${sport.name}">`;
      for (const c of sportCourts) {
        const cleanName = (c.name || "Ground").replace(/\s*\([^)]*\)/g, "").trim();
        html += `<option value="court:${c.id}:${cleanName}">${cleanName}</option>`;
      }
      html += `</optgroup>`;
    }

    select.innerHTML = html;
  },

  async renderUnavailabilityList() {
    const container = document.getElementById("admin-unavailability-list");
    const badge = document.getElementById("badge-unavail-count");
    if (!container) return;

    const list = await window.api.getPlaygroundUnavailabilities();
    const courts = await window.api.getCourts();
    const courtMap = new Map(courts.map(c => [c.id, c.name]));

    if (badge) badge.textContent = `${list.length} Block${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      container.innerHTML = `<p class="wf-meta" style="padding:4px 0;">Grounds are available as per schedule.</p>`;
      return;
    }

    container.innerHTML = list.map(u => {
      let targetName = u.court_name;
      if (!targetName) {
        if (u.court_id === 0 && (!u.sport_id || u.sport_id === 0)) targetName = "All Grounds";
        else if (u.sport_id && u.court_id === 0) targetName = `All Sport #${u.sport_id} Grounds`;
        else targetName = courtMap.get(u.court_id) || `Court #${u.court_id}`;
      }
      targetName = targetName.replace(/\s*\([^)]*\)/g, "").trim();
      const dateLabel = (u.date === "ALL_DAYS") ? "Daily" : u.date;

      return `
        <div class="wf-card highlight facility-rule-item">
          <div class="facility-rule-info">
            <strong class="facility-rule-title">${targetName}</strong>
            <div class="facility-rule-badges">
              <span class="header-pill pill-sm">${u.start_time} - ${u.end_time}</span>
              <span class="facility-date-badge">${dateLabel}</span>
            </div>
          </div>
          <button type="button" class="header-btn btn-unblock-rule btn-delete-unavail" data-id="${u.id}">Unblock</button>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".btn-delete-unavail").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        await window.api.deletePlaygroundUnavailability(id);
        this.showToast(APP_CONSTANTS.MESSAGES.UNBLOCKED_COURT);
        await this.renderUnavailabilityList();
        await this.renderOverviewRulesSummary();
      });
    });
  }

});
