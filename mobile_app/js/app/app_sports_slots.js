/**
 * app_sports_slots.js - Sports Selection, Court Listing, and Slot Grid Renderers
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // SCREEN 2: SPORTS
  // ==========================================
  async renderSports() {
    const container = document.getElementById("sports-grid-container");
    if (!container) return;

    const sports = await window.api.getSports();
    container.innerHTML = sports.map(s => `
      <div class="sport-card ${s.id === this.draft.sportId ? "selected" : ""}" data-sport-id="${s.id}">
        <div class="sport-icon-box">${(s.icon || "").replace(/[\[\]]/g, "")}</div>
        <strong style="display:block; font-size:0.85rem;">${s.name}</strong>
        <span class="wf-meta">${s.courts_count} Courts Available</span>
      </div>
    `).join("");

    container.querySelectorAll(".sport-card").forEach(card => {
      card.addEventListener("click", async () => {
        const sportId = Number(card.dataset.sportId);
        const sport = sports.find(s => s.id === sportId);
        this.draft.sportId = sportId;
        this.draft.sportName = sport ? sport.name : "Sport";
        this.navigateTo("screen-courts");
        await this.renderCourts(sportId);
      });
    });
  },

  // ==========================================
  // SCREEN 3: COURTS / TABLES
  // ==========================================
  async renderCourts(sportId) {
    const container = document.getElementById("courts-list-container");
    const sportTitle = document.getElementById("court-sport-name");
    if (sportTitle) sportTitle.textContent = this.draft.sportName;

    const courts = await window.api.getCourts(sportId);
    const unavails = await window.api.getPlaygroundUnavailabilities();

    container.innerHTML = courts.map(c => {
      // Check if this particular court or its sport has unavailabilities for the selected date
      const activeUnavails = unavails.filter(u => {
        const targetCourtId = Number(u.court_id || 0);
        const targetSportId = Number(u.sport_id || 0);
        let matchesCourt = false;
        if (targetCourtId !== 0) {
          matchesCourt = (targetCourtId === Number(c.id));
        } else if (targetSportId !== 0) {
          matchesCourt = (Number(c.sport_id) === targetSportId);
        } else {
          matchesCourt = true;
        }
        const matchesDate = (u.date === "ALL_DAYS" || u.date === this.draft.date);
        return matchesCourt && matchesDate;
      });

      let unavailBadge = "";
      if (activeUnavails.length > 0) {
        const timeBlocks = activeUnavails.map(u => `${u.start_time} - ${u.end_time}`).join(", ");
        unavailBadge = `<div style="font-size:0.7rem; color:#dc2626; font-weight:700; margin-top:2px;">&#9888; Blocked: ${timeBlocks} (${activeUnavails[0].reason})</div>`;
      }

      return `
        <div class="court-item" data-court-id="${c.id}">
          <div>
            <strong style="font-size:0.88rem; display:block;">${c.name}</strong>
            <span class="wf-meta">Surface: ${c.surface} &bull; ${c.status}</span>
            ${unavailBadge}
          </div>
          <span class="header-btn" style="pointer-events:none;">Pick &rarr;</span>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".court-item").forEach(item => {
      item.addEventListener("click", async () => {
        const courtId = Number(item.dataset.courtId);
        const court = courts.find(c => c.id === courtId);
        this.draft.courtId = courtId;
        this.draft.courtName = court ? court.name : "Court";
        this.navigateTo("screen-slots");
        await this.renderSlots(courtId, this.draft.date);
      });
    });
  },

  // ==========================================
  // SCREEN 4: SLOTS
  // ==========================================
  async renderSlots(courtId, dateStr) {
    const container = document.getElementById("slots-grid-container");
    const courtTitle = document.getElementById("slot-screen-court-title");
    const datePill = document.getElementById("slot-screen-date-pill");

    if (courtTitle) courtTitle.textContent = `${this.draft.sportName} - ${this.draft.courtName}`;
    if (datePill) datePill.textContent = dateStr;

    // Date Navigation on Screen 4
    const slotDateInput = document.getElementById("input-slot-screen-date");
    if (slotDateInput) {
      slotDateInput.value = dateStr;
      slotDateInput.min = this.getTodayDateString();
      slotDateInput.onchange = async (e) => {
        this.draft.date = e.target.value;
        const mainDate = document.getElementById("input-booking-date");
        if (mainDate) mainDate.value = this.draft.date;
        await this.renderSlots(courtId, this.draft.date);
      };
    }

    const prevDayBtn = document.getElementById("btn-slot-prev-day");
    if (prevDayBtn) {
      prevDayBtn.onclick = async () => {
        const parts = this.draft.date.split("-").map(Number);
        const curr = new Date(parts[0], parts[1] - 1, parts[2]);
        curr.setDate(curr.getDate() - 1);
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        const prevStr = `${y}-${m}-${d}`;
        if (prevStr >= this.getTodayDateString()) {
          this.draft.date = prevStr;
          const mainDate = document.getElementById("input-booking-date");
          if (mainDate) mainDate.value = this.draft.date;
          await this.renderSlots(courtId, this.draft.date);
        } else {
          this.showToast("Cannot select a date in the past.");
        }
      };
    }

    const nextDayBtn = document.getElementById("btn-slot-next-day");
    if (nextDayBtn) {
      nextDayBtn.onclick = async () => {
        const parts = this.draft.date.split("-").map(Number);
        const curr = new Date(parts[0], parts[1] - 1, parts[2]);
        curr.setDate(curr.getDate() + 1);
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        this.draft.date = `${y}-${m}-${d}`;
        const mainDate = document.getElementById("input-booking-date");
        if (mainDate) mainDate.value = this.draft.date;
        await this.renderSlots(courtId, this.draft.date);
      };
    }

    const dateAvail = await this.checkDateAvailability(dateStr);
    if (!dateAvail.isAvailable) {
      container.innerHTML = `
        <div class="wf-card" style="grid-column: 1 / -1; text-align: center; padding: 20px 10px; border-style: dashed;">
          <strong style="text-transform: uppercase;">Closed on ${dateStr}</strong>
          <p class="wf-meta" style="margin-top: 4px;">Reason: ${dateAvail.reason}</p>
          <small>Admin marked this date as unavailable. Please pick another date.</small>
        </div>
      `;
      return;
    }

    const slots = await window.api.getSlots(courtId, dateStr);

    container.innerHTML = slots.map(s => {
      if (s.is_past) {
        return `
          <div class="slot-box unavailable past-slot" data-reason="Time slot has already passed for today." title="Time slot has already passed" style="background:#f3f4f6; border:1px dashed #bbb; color:#9ca3af; cursor:not-allowed; opacity:0.65;">
            <span class="slot-time" style="text-decoration:line-through;">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price" style="font-size:0.65rem; color:#6b7280; font-weight:600;">Past Time</span>
            <small style="display:block; font-size:0.6rem; color:#9ca3af; line-height:1.2; margin-top:2px;">Already passed</small>
          </div>
        `;
      }
      if (s.is_unavailable) {
        return `
          <div class="slot-box unavailable" data-reason="${s.unavailability_reason || 'Playground / Academy Unavailable'}" title="${s.unavailability_reason || 'Playground / Academy Unavailable'}" style="background:#f5f5f5; border:1.5px dashed #888; color:#777; cursor:not-allowed; opacity:0.85;">
            <span class="slot-time" style="text-decoration:line-through;">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price" style="font-size:0.68rem; color:var(--rose-accent); font-weight:700;">Unavailable</span>
            <small style="display:block; font-size:0.62rem; color:#444; line-height:1.2; margin-top:2px;">${s.unavailability_reason || 'Blocked (10 AM - 5 PM)'}</small>
          </div>
        `;
      }
      if (s.is_booked) {
        return `
          <div class="slot-box booked" title="Already booked by another player">
            <span class="slot-time">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price">Booked</span>
          </div>
        `;
      }
      const dayLabel = s.day_type === "WEEKEND" ? `<span style="font-size:0.65rem; color:#000; font-weight:700;">(W/E)</span>` : "";
      return `
        <div class="slot-box" data-slot-id="${s.id}" data-time="${s.start_time} - ${s.end_time}" data-price="${s.price}">
          <span class="slot-time">${s.start_time} - ${s.end_time}</span>
          <span class="slot-price">$${s.price.toFixed(2)} ${dayLabel}</span>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".slot-box.unavailable").forEach(box => {
      box.addEventListener("click", () => {
        const reason = box.dataset.reason || "Slot unavailable per academy rules.";
        this.showToast(`🚫 ${reason}`);
      });
    });

    container.querySelectorAll(".slot-box:not(.booked):not(.unavailable)").forEach(box => {
      box.addEventListener("click", async () => {
        this.draft.slotId = Number(box.dataset.slotId);
        this.draft.slotTime = box.dataset.time;
        this.draft.price = Number(box.dataset.price);
        this.navigateTo("screen-checkout");
        await this.renderCheckout();
      });
    });
  }

});
