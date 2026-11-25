/**
 * app_reschedule_modal.js - Slot Rescheduling Modal & Pricing Delta Logic
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // EDIT MODAL ACTIONS (ENFORCES ADMIN X-HOUR CUTOFF RULE)
  // ==========================================
  async openEditModal(bookingId) {
    this.activeEditBookingId = bookingId;
    const booking = await window.api.getBookingById(bookingId);
    if (!booking) return;

    // Check slot change cutoff window (X hours before slot)
    const check = await window.api.checkRescheduleEligibility(booking);

    document.getElementById("edit-modal-meta").textContent = 
      `Booking #${booking.id} (${booking.sport_name} - ${booking.court_name} on ${booking.date} at ${booking.start_time})`;

    const dateInput = document.getElementById("edit-date-input");
    dateInput.value = booking.date;
    dateInput.min = this.getTodayDateString();

    const rulePill = document.getElementById("reschedule-modal-rule-pill");
    const timingMeta = document.getElementById("reschedule-modal-timing-meta");
    const submitBtn = document.getElementById("btn-submit-edit");
    const noticeBox = document.getElementById("reschedule-cutoff-notice");

    if (rulePill) rulePill.textContent = `${check.cutoffHours}h Policy`;

    if (check.isEligible) {
      if (noticeBox) noticeBox.style.borderColor = "var(--glacier-300)";
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:var(--emerald-accent); font-weight:700;">&#10003; Slot Change Allowed:</span> ${check.diffHours} hrs remaining before slot start (Cutoff rule: &ge; ${check.cutoffHours} hrs).`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Rescheduled Slot";
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
      }
    } else {
      if (noticeBox) noticeBox.style.borderColor = "var(--rose-border)";
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:var(--rose-accent); font-weight:700;">&#9888; Slot Change Window Expired:</span> Only ${check.diffHours > 0 ? check.diffHours + ' hrs' : '0 hrs (past)'} remaining. Facility policy requires at least <strong>${check.cutoffHours} hours</strong> notice before slot to reschedule.<br><small style="color:var(--text-muted); display:block; margin-top:3px;">You can still browse dates/slots below. To allow reschedule, adjust cutoff in Admin Rules Engine.</small>`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Locked (< ${check.cutoffHours}h Rule)`;
        submitBtn.style.opacity = "0.4";
        submitBtn.style.cursor = "not-allowed";
      }
    }
    dateInput.disabled = false; // Always allow user to browse and select other dates

    const adminRatio = await window.api.getWalletUpgradeRatio();
    const adminRewardRate = await window.api.getRewardRate();

    const updatePriceBreakdown = (selectedSlot) => {
      const breakdownBox = document.getElementById("edit-price-breakdown");
      if (!breakdownBox || !selectedSlot) return;

      const currPrice = Number(booking.price);
      const newPrice = Number(selectedSlot.price);
      const diff = Number((newPrice - currPrice).toFixed(2));

      document.getElementById("edit-curr-price").textContent = `$${currPrice.toFixed(2)}`;
      document.getElementById("edit-new-price").textContent = `$${newPrice.toFixed(2)}`;
      document.getElementById("edit-admin-ratio").textContent = `${adminRatio}%`;

      if (diff === 0) {
        breakdownBox.style.display = "none";
        submitBtn.textContent = "Save Rescheduled Slot (No Fee Change)";
        return;
      }

      breakdownBox.style.display = "block";
      const userBal = Number(this.currentUser?.wallet_balance || 0);

      if (diff > 0) {
        // Price increased (e.g. from $20 to $35 => +$15)
        const maxWalletCut = Number(((diff * adminRatio) / 100).toFixed(2));
        const walletCut = Math.min(userBal, maxWalletCut);
        const netPayable = Number((diff - walletCut).toFixed(2));

        const oldReward = Number(booking.reward_amount || 0);
        const newReward = Number(((newPrice * adminRewardRate) / 100).toFixed(2));
        const rewardDelta = Number((newReward - oldReward).toFixed(2));

        document.getElementById("edit-price-diff").textContent = `+$${diff.toFixed(2)} (Upgrade)`;
        document.getElementById("edit-wallet-cut").textContent = `-$${walletCut.toFixed(2)} (Wallet Bal: $${userBal.toFixed(2)})`;
        document.getElementById("edit-net-payable").textContent = `$${netPayable.toFixed(2)}`;
        document.getElementById("edit-reward-delta").textContent = `+$${rewardDelta.toFixed(2)} (${adminRewardRate}% reward)`;

        if (walletCut >= diff) {
          submitBtn.textContent = `Confirm Upgrade (-$${walletCut.toFixed(2)} from Wallet)`;
        } else if (walletCut > 0) {
          submitBtn.textContent = `Confirm (-$${walletCut.toFixed(2)} Wallet + $${netPayable.toFixed(2)} Pay)`;
        } else {
          submitBtn.textContent = `Confirm Upgrade (Pay $${diff.toFixed(2)})`;
        }
      } else {
        // Cheaper slot (e.g. $35 down to $20 => -$15)
        const refundAmt = Math.abs(diff);
        document.getElementById("edit-price-diff").textContent = `-$${refundAmt.toFixed(2)} (Downgrade)`;
        document.getElementById("edit-wallet-cut").textContent = `+$${refundAmt.toFixed(2)} (Refund to Wallet)`;
        document.getElementById("edit-net-payable").textContent = `$0.00`;
        document.getElementById("edit-reward-delta").textContent = `Adjusted`;
        submitBtn.textContent = `Confirm Reschedule (Refund +$${refundAmt.toFixed(2)} to Wallet)`;
      }
    };

    const loadSlots = async () => {
      const slotsContainer = document.getElementById("edit-slots-container");
      const slots = await window.api.getSlots(booking.court_id, dateInput.value);
      
      slotsContainer.innerHTML = slots.map(s => {
        if (s.is_past) {
          return `
            <div class="slot-box unavailable" title="Time slot has already passed" style="background:#f3f4f6; border:1px dashed #bbb; color:#9ca3af; cursor:not-allowed; opacity:0.65;">
              <span class="slot-time" style="text-decoration:line-through;">${s.start_time}</span>
              <span class="slot-price" style="font-size:0.62rem; color:#6b7280;">Past</span>
            </div>
          `;
        }
        if (s.is_unavailable) {
          return `
            <div class="slot-box unavailable" title="${s.unavailability_reason || 'Court/Academy Unavailable'}" style="background:#f5f5f5; border:1px dashed #aaa; color:#888; cursor:not-allowed; opacity:0.8;">
              <span class="slot-time" style="text-decoration:line-through;">${s.start_time}</span>
              <span class="slot-price" style="font-size:0.65rem; color:var(--rose-accent);">Blocked</span>
            </div>
          `;
        }
        if (s.is_booked && s.id !== booking.slot_id) {
          return `<div class="slot-box booked"><span class="slot-time">${s.start_time}</span><span class="slot-price">Booked</span></div>`;
        }
        const isSelected = s.id === booking.slot_id;
        return `
          <div class="slot-box ${isSelected ? "selected" : ""}" data-slot-id="${s.id}">
            <span class="slot-time">${s.start_time}</span>
            <span class="slot-price">$${s.price.toFixed(2)}</span>
          </div>
        `;
      }).join("");

      // Trigger initial breakdown calculation
      const initialSlot = slots.find(s => s.id === this.activeEditSlotId);
      if (initialSlot && !initialSlot.is_unavailable) updatePriceBreakdown(initialSlot);

      slotsContainer.querySelectorAll(".slot-box:not(.booked):not(.unavailable)").forEach(box => {
        box.addEventListener("click", () => {
          slotsContainer.querySelectorAll(".slot-box").forEach(b => b.classList.remove("selected"));
          box.classList.add("selected");
          this.activeEditSlotId = Number(box.dataset.slotId);
          const picked = slots.find(s => s.id === this.activeEditSlotId);
          if (picked) updatePriceBreakdown(picked);
        });
      });
    };

    this.activeEditSlotId = booking.slot_id;
    await loadSlots();

    dateInput.onchange = async () => await loadSlots();

    document.getElementById("modal-edit-booking")?.classList.add("active");
  },

  closeEditModal() {
    document.getElementById("modal-edit-booking")?.classList.remove("active");
    this.activeEditBookingId = null;
  },

  async handleSaveEditedBooking() {
    if (!this.activeEditBookingId || !this.activeEditSlotId) {
      alert("Please select a slot.");
      return;
    }
    const newDate = document.getElementById("edit-date-input").value;
    try {
      const res = await window.api.updateBooking(this.activeEditBookingId, newDate, this.activeEditSlotId);
      this.currentUser.wallet_balance = res.updatedWallet;
      this.updateUserHeaderPill();
      this.closeEditModal();

      let toastMsg = `Booking #${res.booking.id} rescheduled!`;
      if (res.walletCut > 0) {
        toastMsg += ` Cut $${res.walletCut.toFixed(2)} from wallet.`;
      }
      if (res.netPayable > 0) {
        toastMsg += ` Net paid: $${res.netPayable.toFixed(2)}.`;
      }
      if (res.priceDelta < 0) {
        toastMsg += ` Refunded $${Math.abs(res.priceDelta).toFixed(2)} to wallet.`;
      }
      this.showToast(toastMsg);
      await this.renderBookingsList();
    } catch (err) {
      alert(err.message);
    }
  }

});
