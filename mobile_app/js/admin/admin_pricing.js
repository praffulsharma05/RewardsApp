/**
 * admin_pricing.js - Time-Tiered Slot Pricing Schedule Renderer
 */
Object.assign(MobileAdminApp.prototype, {
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

    // 2. Fetch slot pricing & monthly rule config
    const tiers = await window.api.getSlotPricingOverview(this.selectedPricingSportId);
    const monthlyCfg = (window.api.getMonthlyBookingConfig)
      ? await window.api.getMonthlyBookingConfig()
      : { enabled: true, discountPercent: 15, daysCount: 30 };
    this._cachedMonthlyCfg = monthlyCfg;

    // 3. Populate slot selector dropdown (always include standard slots + any existing custom tiers)
    if (slotSelect) {
      const prevVal = slotSelect.value;
      const standardTimes = [
        { start: "06:00", end: "07:00" },
        { start: "07:00", end: "08:00" },
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
        { start: "11:00", end: "12:00" },
        { start: "12:00", end: "13:00" },
        { start: "13:00", end: "14:00" },
        { start: "14:00", end: "15:00" },
        { start: "15:00", end: "16:00" },
        { start: "16:00", end: "17:00" },
        { start: "17:00", end: "18:00" },
        { start: "18:00", end: "19:00" },
        { start: "19:00", end: "20:00" },
        { start: "20:00", end: "21:00" },
        { start: "21:00", end: "22:00" },
        { start: "22:00", end: "23:00" }
      ];
      const mergedMap = new Map();
      standardTimes.forEach(t => mergedMap.set(`${t.start}-${t.end}`, t));
      tiers.forEach(t => mergedMap.set(`${t.start}-${t.end}`, { start: t.start, end: t.end }));
      const allTimeOptions = Array.from(mergedMap.values()).sort((a, b) => a.start.localeCompare(b.start));

      slotSelect.innerHTML = `
        <optgroup label="Single Slot Times">
          ${allTimeOptions.map(t => `<option value="${t.start}-${t.end}">${t.start} - ${t.end}</option>`).join("")}
        </optgroup>
        <optgroup label="Bulk Window Presets">
          <option value="peak">Peak Evening (18:00 - 23:00)</option>
          <option value="day">Daytime Hours (08:00 - 18:00)</option>
          <option value="all-slots">All Slots (Full Day)</option>
        </optgroup>
      `;
      if (prevVal && Array.from(slotSelect.options).some(o => o.value === prevVal)) {
        slotSelect.value = prevVal;
      }
    }

    if (tiers.length === 0) {
      container.innerHTML = `
        <div class="wf-card" style="text-align:center; padding:14px;">
          <p class="wf-meta" style="margin-bottom:10px;">No slots configured for ${sportTitle}. Use "Set Game &amp; Slot Rate" above or restore standard 8 AM – 11 PM slots.</p>
          <button type="button" class="wf-btn wf-btn-sm" id="btn-restore-default-slots" style="width:auto;">+ Restore 8 AM – 11 PM Slots (₹500/₹600)</button>
        </div>
      `;
      document.getElementById("btn-restore-default-slots")?.addEventListener("click", async () => {
        await window.api.updateSlotDayWisePrice(this.selectedPricingSportId, "all-slots", "WEEKDAY", 500, null);
        await window.api.updateSlotDayWisePrice(this.selectedPricingSportId, "all-slots", "WEEKEND", 600, null);
        this.showToast(`Restored 8 AM – 11 PM slots for ${sportTitle}!`);
        await this.renderPricingSchedule();
      });
      return;
    }

    // 4. Render slot schedule list (Per-Day + Discounted Monthly Rate)
    const mDays = Number(monthlyCfg.daysCount || 30);
    const mDisc = Number(monthlyCfg.discountPercent ?? 15);
    const nowDt = new Date();
    const todayIso = `${nowDt.getFullYear()}-${String(nowDt.getMonth() + 1).padStart(2, "0")}-${String(nowDt.getDate()).padStart(2, "0")}`;
    container.innerHTML = tiers.map(t => {
      const isPeak = t.start >= "18:00" && t.start < "23:00";
      const wdPrice = Number(t.weekday_price ?? t.price);
      const wePrice = Number(t.weekend_price ?? Math.round(Number(t.price) * 1.3));
      const hasDiffDayPrices = wdPrice !== wePrice;
      const pricingPreview = (window.api && window.api._calculateMonthlySlotPricing)
        ? window.api._calculateMonthlySlotPricing({ price: t.price, weekday_price: wdPrice, weekend_price: wePrice, monthly_price: t.monthly_price }, todayIso, monthlyCfg)
        : null;
      const regMonthly = pricingPreview ? pricingPreview.regularPrice : Number(t.price) * mDays;
      const hasCustomMonthly = t.monthly_price != null && Number(t.monthly_price) > 0;
      const effMonthly = pricingPreview
        ? pricingPreview.discountedPrice
        : (hasCustomMonthly ? Number(t.monthly_price) : Number((regMonthly * (1 - mDisc / 100)).toFixed(2)));
      const effDiscPct = pricingPreview
        ? pricingPreview.discountPercent
        : (regMonthly > 0 ? Math.max(0, Math.round(((regMonthly - effMonthly) / regMonthly) * 100)) : 0);

      const dayPriceBadges = hasDiffDayPrices
        ? `<span style="display:inline-flex; align-items:center; white-space:nowrap; font-size:0.72rem; font-weight:700; color:var(--glacier-900); background:var(--glacier-100); border:1px solid var(--glacier-200); border-radius:999px; padding:2px 8px;">Weekday ₹${wdPrice.toFixed(0)}</span>
           <span style="display:inline-flex; align-items:center; white-space:nowrap; font-size:0.72rem; font-weight:700; color:var(--rose-accent); background:var(--rose-bg); border:1px solid var(--rose-border); border-radius:999px; padding:2px 8px;">Weekend ₹${wePrice.toFixed(0)}</span>`
        : `<span class="user-balance-pill" style="font-size:0.74rem; white-space:nowrap; padding:2px 8px;">₹${Number(t.price).toFixed(2)}/d</span>`;

      return `
        <div class="wf-card ${isPeak ? "highlight" : ""}" style="padding: 10px 12px; margin-bottom: 8px;">
          <div class="wf-card-header" style="gap: 8px; flex-wrap: nowrap;">
            <div style="min-width: 0;">
              <strong style="font-size:0.88rem; display:block;">${t.start} - ${t.end}</strong>
              <small class="wf-meta" style="display:block;">${sportTitle} &bull; ${isPeak ? "Peak Slot" : "Standard Slot"}</small>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
              <button type="button" class="header-btn btn-edit-single-tier" data-start="${t.start}" data-end="${t.end}" data-price="${t.price}" data-weekday="${wdPrice}" data-weekend="${wePrice}" data-monthly="${hasCustomMonthly ? effMonthly : ""}" style="font-size:0.7rem; padding:4px 10px;">Edit</button>
              <button type="button" class="header-btn btn-delete-single-tier" data-start="${t.start}" data-end="${t.end}" style="font-size:0.7rem; padding:4px 8px; color:var(--rose-accent); border-color:var(--rose-border);">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:8px; padding-top:8px; border-top:1px dashed var(--glacier-200);">
            ${dayPriceBadges}
            <span style="display:inline-flex; align-items:center; white-space:nowrap; font-size:0.72rem; font-weight:600; color:var(--emerald-accent); background:var(--emerald-bg); border:1px solid var(--emerald-border); border-radius:999px; padding:2px 8px;">
              Monthly (${mDays}d): ₹${effMonthly.toFixed(0)}${effDiscPct > 0 ? ` (${effDiscPct}% off)` : ""}${hasCustomMonthly ? " • Custom" : ""}
            </span>
          </div>
        </div>
      `;
    }).join("");

    this.bindSlotPriceModalEvents();

    container.querySelectorAll(".btn-edit-single-tier").forEach(btn => {
      btn.addEventListener("click", () => {
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        const currentPrice = Number(btn.dataset.price);
        const currentWeekday = btn.dataset.weekday ? Number(btn.dataset.weekday) : currentPrice;
        const currentWeekend = btn.dataset.weekend ? Number(btn.dataset.weekend) : currentPrice;
        const currentMonthly = btn.dataset.monthly ? Number(btn.dataset.monthly) : "";
        this.openEditSlotPriceModal(start, end, currentPrice, sportTitle, currentMonthly, currentWeekday, currentWeekend);
      });
    });

    container.querySelectorAll(".btn-delete-single-tier").forEach(btn => {
      btn.addEventListener("click", () => {
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        this.openDeleteSlotPriceModal(start, end, sportTitle);
      });
    });
  },

  openEditSlotPriceModal(start, end, currentPrice, sportTitle, currentMonthly = "", currentWeekday = null, currentWeekend = null) {
    this.pendingEditSlot = { start, end, sportTitle };
    const meta = document.getElementById("edit-slot-price-meta");
    if (meta) meta.textContent = `${sportTitle} \u2022 ${start} - ${end}`;
    const input = document.getElementById("input-edit-slot-price");
    const weekdayInput = document.getElementById("input-edit-slot-weekday-price");
    const weekendInput = document.getElementById("input-edit-slot-weekend-price");
    const monthlyInput = document.getElementById("input-edit-slot-monthly-price");
    const monthlyHint = document.getElementById("edit-slot-monthly-hint");
    const mCfg = this._cachedMonthlyCfg || { daysCount: 30, discountPercent: 15 };

    const updateMonthlyHint = (dailyVal) => {
      if (!monthlyHint) return;
      const dPrice = Number(dailyVal) || 0;
      const reg = dPrice * mCfg.daysCount;
      const autoDisc = Number((reg * (1 - mCfg.discountPercent / 100)).toFixed(2));
      monthlyHint.textContent = `Auto ${mCfg.daysCount}d rate (${mCfg.discountPercent}% off ₹${reg.toFixed(0)}): ₹${autoDisc.toFixed(2)}`;
    };

    if (input) {
      input.value = currentPrice;
      input.oninput = () => updateMonthlyHint(input.value);
      setTimeout(() => input.focus(), 80);
    }
    if (weekdayInput) weekdayInput.value = currentWeekday != null ? currentWeekday : currentPrice;
    if (weekendInput) weekendInput.value = currentWeekend != null ? currentWeekend : currentPrice;
    if (monthlyInput) {
      monthlyInput.value = currentMonthly !== "" ? currentMonthly : "";
    }
    updateMonthlyHint(currentPrice);
    document.getElementById("modal-edit-slot-price")?.classList.add("active");
  },

  closeEditSlotPriceModal() {
    document.getElementById("modal-edit-slot-price")?.classList.remove("active");
    this.pendingEditSlot = null;
  },

  openDeleteSlotPriceModal(start, end, sportTitle) {
    this.pendingDeleteSlot = { start, end, sportTitle };
    const meta = document.getElementById("delete-slot-price-meta");
    if (meta) meta.textContent = `${sportTitle} \u2022 ${start} – ${end}`;
    document.getElementById("modal-delete-slot-pricing")?.classList.add("active");
  },

  closeDeleteSlotPriceModal() {
    document.getElementById("modal-delete-slot-pricing")?.classList.remove("active");
    this.pendingDeleteSlot = null;
  },

  bindSlotPriceModalEvents() {
    if (this._slotPriceModalBound) return;
    this._slotPriceModalBound = true;

    document.getElementById("btn-close-slot-price-modal")?.addEventListener("click", () => this.closeEditSlotPriceModal());
    document.getElementById("btn-cancel-slot-price")?.addEventListener("click", () => this.closeEditSlotPriceModal());

    document.getElementById("btn-close-delete-slot-price-modal")?.addEventListener("click", () => this.closeDeleteSlotPriceModal());
    document.getElementById("btn-abort-delete-slot-price")?.addEventListener("click", () => this.closeDeleteSlotPriceModal());
    document.getElementById("btn-confirm-delete-slot-price")?.addEventListener("click", async () => {
      if (!this.pendingDeleteSlot) return;
      const { start, end } = this.pendingDeleteSlot;
      try {
        await window.api.deleteSlotPricing(this.selectedPricingSportId, start, end);
        this.closeDeleteSlotPriceModal();
        this.showToast(`Deleted slot ${start} – ${end}`);
        await this.renderPricingSchedule();
      } catch (err) {
        alert(err.message);
      }
    });

    document.querySelectorAll(".btn-quick-price-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const price = btn.dataset.price;
        const input = document.getElementById("input-edit-slot-price");
        if (input) input.value = price;
      });
    });

    document.getElementById("form-edit-slot-price")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!this.pendingEditSlot) return;
      const { start, end, sportTitle } = this.pendingEditSlot;
      const newPrice = Number(document.getElementById("input-edit-slot-price").value);
      const rawWeekday = document.getElementById("input-edit-slot-weekday-price")?.value?.trim();
      const rawWeekend = document.getElementById("input-edit-slot-weekend-price")?.value?.trim();
      const rawMonthly = document.getElementById("input-edit-slot-monthly-price")?.value?.trim();
      const weekdayPrice = rawWeekday ? Number(rawWeekday) : null;
      const weekendPrice = rawWeekend ? Number(rawWeekend) : null;
      const monthlyPrice = rawMonthly ? Number(rawMonthly) : null;
      if (isNaN(newPrice) || newPrice <= 0) return;

      try {
        await window.api.updateSlotPriceForSport(this.selectedPricingSportId, start, end, newPrice, monthlyPrice, weekdayPrice, weekendPrice);
        this.closeEditSlotPriceModal();
        const msg = (typeof APP_CONSTANTS !== "undefined" && APP_CONSTANTS.MESSAGES.SLOT_PRICE_UPDATED) ?
          APP_CONSTANTS.MESSAGES.SLOT_PRICE_UPDATED(sportTitle, start, end, newPrice) :
          `Price: ₹${newPrice}`;
        this.showToast(msg);
        await this.renderPricingSchedule();
      } catch (err) {
        alert(err.message);
      }
    });
  }

});
