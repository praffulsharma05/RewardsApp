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

});
