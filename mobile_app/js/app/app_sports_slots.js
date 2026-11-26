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

    // Monthly Booking Rule Config & Mode Toggle
    const monthlyCfg = (window.api && window.api.getMonthlyBookingConfig)
      ? await window.api.getMonthlyBookingConfig()
      : { enabled: true, discountPercent: 15, daysCount: 30 };

    if (!this.draft.bookingMode || !monthlyCfg.enabled) {
      this.draft.bookingMode = "DAILY";
    }
    const isMonthly = monthlyCfg.enabled && this.draft.bookingMode === "MONTHLY";

    const modeToggleWrap = document.getElementById("slot-booking-mode-toggle");
    const btnDaily = document.getElementById("btn-mode-daily");
    const btnMonthly = document.getElementById("btn-mode-monthly");
    const badgeMonthlyPct = document.getElementById("badge-monthly-discount-pct");
    const monthlyBanner = document.getElementById("monthly-pass-banner");
    const helpText = document.getElementById("slot-mode-help-text");

    if (modeToggleWrap) modeToggleWrap.style.display = monthlyCfg.enabled ? "flex" : "none";
    if (badgeMonthlyPct) badgeMonthlyPct.textContent = `${monthlyCfg.discountPercent}% Off`;

    if (btnDaily && btnMonthly) {
      btnDaily.classList.toggle("wf-btn-secondary", isMonthly);
      btnMonthly.classList.toggle("wf-btn-secondary", !isMonthly);
      btnDaily.onclick = async () => {
        if (this.draft.bookingMode === "DAILY") return;
        this.draft.bookingMode = "DAILY";
        this.draft.selectedSlots = [];
        await this.renderSlots(courtId, this.draft.date);
      };
      btnMonthly.onclick = async () => {
        if (this.draft.bookingMode === "MONTHLY") return;
        this.draft.bookingMode = "MONTHLY";
        this.draft.selectedSlots = [];
        await this.renderSlots(courtId, this.draft.date);
      };
    }

    if (monthlyBanner) {
      if (isMonthly) {
        const endDates = window.api._getDateRange(dateStr, monthlyCfg.daysCount);
        const endStr = endDates[endDates.length - 1];
        const fmt = (iso) => {
          const [, m, d] = iso.split("-").map(Number);
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          return `${d} ${months[m - 1] || ""}`;
        };
        monthlyBanner.classList.remove("d-none");
        monthlyBanner.textContent = `Monthly Pass (${monthlyCfg.daysCount}d): ${fmt(dateStr)} – ${fmt(endStr)} • ${monthlyCfg.discountPercent}% Off`;
      } else {
        monthlyBanner.classList.add("d-none");
      }
    }
    if (helpText) {
      helpText.textContent = isMonthly
        ? `Select slot time(s) to book for ${monthlyCfg.daysCount} consecutive days at a discounted monthly rate.`
        : "Tap one or more available time slots below, then proceed to checkout.";
    }

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
          this.showToast("Date has passed!");
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

    const slots = isMonthly
      ? await window.api.getMonthlySlots(courtId, dateStr)
      : await window.api.getSlots(courtId, dateStr);
    const availableMap = new Map(
      slots.filter(s => !s.is_booked && !s.is_unavailable && !s.is_past).map(s => [s.id, s])
    );

    if (!Array.isArray(this.draft.selectedSlots)) {
      this.draft.selectedSlots = [];
    }
    this.draft.selectedSlots = this.draft.selectedSlots
      .filter(sel => Number(sel.courtId) === Number(courtId) && sel.date === dateStr && availableMap.has(Number(sel.id)))
      .map(sel => {
        const fresh = availableMap.get(Number(sel.id));
        return {
          id: fresh.id,
          time: `${fresh.start_time} - ${fresh.end_time}`,
          price: Number(fresh.price),
          regularPrice: Number(fresh.regular_price || fresh.price),
          discountAmount: Number(fresh.discount_amount || 0),
          discountPercent: Number(fresh.discount_percent || 0),
          endDate: fresh.end_date || dateStr,
          daysCount: Number(fresh.days_count || 1),
          courtId: Number(courtId),
          date: dateStr
        };
      });

    const selectedIds = new Set(this.draft.selectedSlots.map(s => Number(s.id)));

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
        const bookedLabel = isMonthly && s.conflict_days
          ? `Conflict (${s.conflict_days}d)`
          : "Booked";
        return `
          <div class="slot-box booked" title="Already booked by another player">
            <span class="slot-time">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price">${bookedLabel}</span>
          </div>
        `;
      }
      const isSelected = selectedIds.has(Number(s.id));
      if (isMonthly) {
        return `
          <div class="slot-box ${isSelected ? "selected" : ""}" data-slot-id="${s.id}" data-time="${s.start_time} - ${s.end_time}" data-price="${s.price}" data-regular="${s.regular_price}" data-discount-amt="${s.discount_amount}" data-discount-pct="${s.discount_percent}" data-end-date="${s.end_date}" data-days="${s.days_count}">
            <span class="slot-time">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price">₹${Number(s.price).toFixed(0)}/mo</span>
            <small style="display:block; font-size:0.62rem; color:var(--emerald-accent); font-weight:700;">
              <s style="color:var(--text-muted); font-weight:400;">₹${Number(s.regular_price).toFixed(0)}</s> (${s.discount_percent}% off)
            </small>
          </div>
        `;
      }
      const dayLabel = s.day_type === "WEEKEND" ? `<span style="font-size:0.65rem; font-weight:700;">(W/E)</span>` : "";
      return `
        <div class="slot-box ${isSelected ? "selected" : ""}" data-slot-id="${s.id}" data-time="${s.start_time} - ${s.end_time}" data-price="${s.price}">
          <span class="slot-time">${s.start_time} - ${s.end_time}</span>
          <span class="slot-price">₹${s.price.toFixed(2)} ${dayLabel}</span>
        </div>
      `;
    }).join("");

    const updateMultiSlotBar = () => {
      const bar = document.getElementById("user-multi-slot-bar");
      const countEl = document.getElementById("user-multi-slot-count");
      const totalEl = document.getElementById("user-multi-slot-total");
      const list = this.draft.selectedSlots || [];
      if (!bar) return;
      if (list.length === 0) {
        bar.classList.add("d-none");
        return;
      }
      const total = list.reduce((sum, item) => sum + Number(item.price || 0), 0);
      bar.classList.remove("d-none");
      if (countEl) countEl.textContent = `${list.length} slot${list.length === 1 ? "" : "s"} selected`;
      if (totalEl) totalEl.textContent = `Total: ₹${total.toFixed(2)}`;
    };

    updateMultiSlotBar();

    container.querySelectorAll(".slot-box.unavailable").forEach(box => {
      box.addEventListener("click", () => {
        this.showToast("Slot unavailable!");
      });
    });

    container.querySelectorAll(".slot-box:not(.booked):not(.unavailable)").forEach(box => {
      box.addEventListener("click", () => {
        const slotId = Number(box.dataset.slotId);
        const slotTime = box.dataset.time;
        const slotPrice = Number(box.dataset.price);
        const existingIdx = this.draft.selectedSlots.findIndex(item => Number(item.id) === slotId);

        if (existingIdx >= 0) {
          this.draft.selectedSlots.splice(existingIdx, 1);
          box.classList.remove("selected");
        } else {
          this.draft.selectedSlots.push({
            id: slotId,
            time: slotTime,
            price: slotPrice,
            regularPrice: Number(box.dataset.regular || slotPrice),
            discountAmount: Number(box.dataset.discountAmt || 0),
            discountPercent: Number(box.dataset.discountPct || 0),
            endDate: box.dataset.endDate || dateStr,
            daysCount: Number(box.dataset.days || 1),
            courtId: Number(courtId),
            date: dateStr
          });
          box.classList.add("selected");
        }
        updateMultiSlotBar();
      });
    });

    const btnProceed = document.getElementById("btn-proceed-multi-slots");
    if (btnProceed) {
      btnProceed.onclick = async () => {
        const list = this.draft.selectedSlots || [];
        if (list.length === 0) {
          this.showToast("Please select at least one slot.");
          return;
        }
        this.draft.slotId = list[0].id;
        this.draft.slotTime = list.map(s => s.time).join(", ");
        this.draft.price = list.reduce((sum, s) => sum + Number(s.price || 0), 0);
        this.draft.regularPrice = list.reduce((sum, s) => sum + Number(s.regularPrice || s.price || 0), 0);
        this.draft.monthlyDiscountAmount = list.reduce((sum, s) => sum + Number(s.discountAmount || 0), 0);
        this.draft.monthlyEndDate = list[0].endDate || dateStr;
        this.draft.monthlyDays = list[0].daysCount || 30;
        this.navigateTo("screen-terms");
        await this.renderTermsAndConditions();
      };
    }
  }

});
