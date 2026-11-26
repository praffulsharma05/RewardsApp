/**
 * app_reschedule_modal.js - Slot Rescheduling Modal & Pricing Delta Logic
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // EDIT MODAL ACTIONS (ENFORCES ADMIN X-HOUR CUTOFF RULE)
  // ==========================================
  async openEditModal(bookingId) {
    try {
      this.activeEditBookingId = bookingId;
      document.getElementById("modal-edit-booking")?.classList.add("active");

      const booking = await window.api.getBookingById(bookingId);
      if (!booking) {
        this.closeEditModal();
        return;
      }
      this.activeEditBooking = booking;

      const monthlyDayWrap = document.getElementById("edit-monthly-day-wrap");
      const monthlyDaySelect = document.getElementById("edit-monthly-day-select");
      const isMonthly = booking.booking_type === "MONTHLY";

      if (isMonthly) {
        const mCfg = await window.api.getMonthlyBookingConfig();
        const todayStr = this.getTodayDateString();
        const activeDates = window.api.getMonthlyActiveDates(booking).filter(d => d.date >= todayStr);
        const usedReschedules = Array.isArray(booking.added_dates) ? booking.added_dates.length : 0;
        const limitReached = mCfg.maxRescheduleDays > 0 && usedReschedules >= mCfg.maxRescheduleDays;

        const fmt = (iso) => {
          const [, m, d] = iso.split("-").map(Number);
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          return `${d} ${months[m - 1] || ""}`;
        };

        if (monthlyDayWrap) monthlyDayWrap.classList.remove("d-none");
        if (monthlyDaySelect) {
          monthlyDaySelect.innerHTML = activeDates.length > 0
            ? activeDates.map(d => `<option value="${d.date}">${fmt(d.date)} (${d.start_time}${d.is_rescheduled ? " • Shifted" : ""})</option>`).join("")
            : `<option value="">No upcoming days left in pass</option>`;
        }

        const metaEl = document.getElementById("edit-modal-meta");
        if (metaEl) metaEl.textContent = `Pass #${booking.id} • ${booking.sport_name} (${usedReschedules}/${mCfg.maxRescheduleDays || "∞"} moved)`;

        const dateInput = document.getElementById("edit-date-input");
        const nextRange = window.api._getDateRange(booking.end_date || todayStr, 2);
        const defaultNextDate = nextRange[1] > todayStr ? nextRange[1] : todayStr;
        if (dateInput) {
          dateInput.value = defaultNextDate;
          dateInput.min = todayStr;
        }

        const noticeBox = document.getElementById("reschedule-cutoff-notice");
        const timingMeta = document.getElementById("reschedule-modal-timing-meta");
        const submitBtn = document.getElementById("btn-submit-edit");
        const breakdownBox = document.getElementById("edit-price-breakdown");
        if (breakdownBox) breakdownBox.style.display = "none";

        if (!mCfg.allowSingleDayReschedule || limitReached || activeDates.length === 0) {
          if (noticeBox) {
            noticeBox.style.borderColor = "var(--rose-border, #fecdd3)";
            noticeBox.style.background = "#fff1f2";
          }
          if (timingMeta) {
            const msg = !mCfg.allowSingleDayReschedule
              ? "Single-day reschedule is disabled by Admin."
              : (limitReached ? `Limit reached (${usedReschedules}/${mCfg.maxRescheduleDays} days moved).` : "No upcoming days left to move.");
            timingMeta.innerHTML = `<span style="color:var(--rose-accent, #e11d48); font-weight:700;">&#9888; ${msg}</span>`;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add("btn-locked");
            submitBtn.textContent = "Reschedule Unavailable";
          }
        } else {
          if (noticeBox) {
            noticeBox.style.borderColor = "var(--emerald-accent, #10b981)";
            noticeBox.style.background = "#f0fdf4";
          }
          if (timingMeta) {
            timingMeta.innerHTML = `<span style="color:var(--emerald-accent, #059669); font-weight:700;">&#10003; Move 1 pass day to another available date/slot</span>`;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove("btn-locked");
            submitBtn.textContent = "Move Selected Day";
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
          }
        }

        const loadMonthlyTargetSlots = async () => {
          const slotsContainer = document.getElementById("edit-slots-container");
          if (!slotsContainer) return;
          const slots = await window.api.getSlots(booking.court_id, dateInput.value);
          slotsContainer.innerHTML = slots.map(s => {
            if (s.is_past) return `<div class="slot-box past-slot unavailable"><span class="slot-time">${s.start_time}</span><span class="slot-price">Past</span></div>`;
            if (s.is_unavailable) return `<div class="slot-box blocked-slot unavailable"><span class="slot-time">${s.start_time}</span><span class="slot-price">Blocked</span></div>`;
            if (s.is_booked) return `<div class="slot-box booked"><span class="slot-time">${s.start_time}</span><span class="slot-price">Booked</span></div>`;
            const isSelected = s.id === this.activeEditSlotId;
            return `<div class="slot-box ${isSelected ? "selected" : ""}" data-slot-id="${s.id}"><span class="slot-time">${s.start_time}</span><span class="slot-price">Included</span></div>`;
          }).join("");

          let selectedSlot = slots.find(s => s.id === this.activeEditSlotId && !s.is_past && !s.is_unavailable && !s.is_booked);
          if (!selectedSlot) {
            selectedSlot = slots.find(s => !s.is_past && !s.is_unavailable && !s.is_booked);
            if (selectedSlot) {
              this.activeEditSlotId = selectedSlot.id;
              slotsContainer.querySelectorAll(".slot-box").forEach(b => b.classList.toggle("selected", Number(b.dataset.slotId) === selectedSlot.id));
            }
          }
          slotsContainer.querySelectorAll(".slot-box:not(.booked):not(.unavailable):not(.past-slot)").forEach(box => {
            box.addEventListener("click", () => {
              slotsContainer.querySelectorAll(".slot-box").forEach(b => b.classList.remove("selected"));
              box.classList.add("selected");
              this.activeEditSlotId = Number(box.dataset.slotId);
            });
          });
        };

        this.activeEditSlotId = booking.slot_id;
        await loadMonthlyTargetSlots();
        if (dateInput) dateInput.onchange = async () => await loadMonthlyTargetSlots();
        return;
      }

      if (monthlyDayWrap) monthlyDayWrap.classList.add("d-none");

      // Check slot change cutoff window (X hours before slot)
      const check = await window.api.checkRescheduleEligibility(booking);
      this.activeEditEligibility = check;

      const metaEl = document.getElementById("edit-modal-meta");
      if (metaEl) {
        metaEl.textContent = `Booking #${booking.id} • ${booking.sport_name} (${booking.start_time})`;
      }

      const dateInput = document.getElementById("edit-date-input");
      if (dateInput) {
        dateInput.value = booking.date;
        dateInput.min = this.getTodayDateString();
        dateInput.disabled = false;
      }

      const rulePill = document.getElementById("reschedule-modal-rule-pill");
      const timingMeta = document.getElementById("reschedule-modal-timing-meta");
      const submitBtn = document.getElementById("btn-submit-edit");
      const noticeBox = document.getElementById("reschedule-cutoff-notice");

      if (rulePill) rulePill.textContent = `${check.cutoffHours}h Policy`;

      if (check.isEligible) {
        if (noticeBox) {
          noticeBox.style.borderColor = "var(--emerald-accent, #10b981)";
          noticeBox.style.background = "#f0fdf4";
        }
        if (timingMeta) {
          timingMeta.innerHTML = `<span style="color:var(--emerald-accent, #059669); font-weight:700;">&#10003; Reschedule Allowed</span>`;
        }
        if (submitBtn) {
          submitBtn.classList.remove("btn-locked");
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Rescheduled Slot";
          submitBtn.style.opacity = "1";
          submitBtn.style.cursor = "pointer";
        }
      } else {
        if (noticeBox) {
          noticeBox.style.borderColor = "var(--rose-border, #fecdd3)";
          noticeBox.style.background = "#fff1f2";
        }
        if (timingMeta) {
          timingMeta.innerHTML = `<span style="color:var(--rose-accent, #e11d48); font-weight:700;">&#9888; Reschedule Locked</span> <span style="color:var(--glacier-700); font-weight:normal;">(< ${check.cutoffHours}h notice)</span>`;
        }
        if (submitBtn) {
          submitBtn.classList.add("btn-locked");
          submitBtn.textContent = `Locked (< ${check.cutoffHours}h Policy)`;
        }
      }

      const adminRatio = await window.api.getWalletUpgradeRatio();
      const adminRewardRate = await window.api.getRewardRate();

      const updatePriceBreakdown = (selectedSlot) => {
        const breakdownBox = document.getElementById("edit-price-breakdown");
        if (!breakdownBox || !selectedSlot) return;

        const currPrice = Number(booking.price);
        const newPrice = Number(selectedSlot.price);
        const diff = Number((newPrice - currPrice).toFixed(2));

        const currPriceEl = document.getElementById("edit-curr-price");
        if (currPriceEl) currPriceEl.textContent = `₹${currPrice.toFixed(2)}`;
        const newPriceEl = document.getElementById("edit-new-price");
        if (newPriceEl) newPriceEl.textContent = `₹${newPrice.toFixed(2)}`;
        const adminRatioEl = document.getElementById("edit-admin-ratio");
        if (adminRatioEl) adminRatioEl.textContent = `${adminRatio}%`;

        submitBtn.classList.remove("btn-locked");
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";

        if (diff === 0) {
          breakdownBox.style.display = "none";
          submitBtn.textContent = "Save Rescheduled Slot";
          return;
        }

        breakdownBox.style.display = "block";
        const userBal = Number(this.currentUser?.wallet_balance || 0);

        if (diff > 0) {
          const maxWalletCut = Number(((diff * adminRatio) / 100).toFixed(2));
          const walletCut = Math.min(userBal, maxWalletCut);
          const netPayable = Number((diff - walletCut).toFixed(2));

          const oldReward = Number(booking.reward_amount || 0);
          const newReward = Number(((newPrice * adminRewardRate) / 100).toFixed(2));
          const rewardDelta = Number((newReward - oldReward).toFixed(2));

          const priceDiffEl = document.getElementById("edit-price-diff");
          if (priceDiffEl) priceDiffEl.textContent = `+₹${diff.toFixed(2)}`;
          
          const walletRow = document.getElementById("edit-wallet-row");
          if (walletRow) walletRow.style.display = walletCut > 0 ? "flex" : "none";
          
          const walletCutEl = document.getElementById("edit-wallet-cut");
          if (walletCutEl) walletCutEl.textContent = `-₹${walletCut.toFixed(2)}`;
          
          const netPayableEl = document.getElementById("edit-net-payable");
          if (netPayableEl) netPayableEl.textContent = `₹${netPayable.toFixed(2)}`;
          
          const rewardDeltaEl = document.getElementById("edit-reward-delta");
          if (rewardDeltaEl) rewardDeltaEl.textContent = `+₹${rewardDelta.toFixed(2)}`;

          if (walletCut >= diff) {
            submitBtn.textContent = `Confirm Upgrade (-₹${walletCut.toFixed(2)} Wallet)`;
          } else if (walletCut > 0) {
            submitBtn.textContent = `Confirm (Pay ₹${netPayable.toFixed(2)})`;
          } else {
            submitBtn.textContent = `Confirm Upgrade (Pay ₹${diff.toFixed(2)})`;
          }
        } else {
          const refundAmt = Math.abs(diff);
          const priceDiffEl = document.getElementById("edit-price-diff");
          if (priceDiffEl) priceDiffEl.textContent = `-₹${refundAmt.toFixed(2)}`;
          
          const walletRow = document.getElementById("edit-wallet-row");
          if (walletRow) walletRow.style.display = "flex";
          
          const walletCutEl = document.getElementById("edit-wallet-cut");
          if (walletCutEl) walletCutEl.textContent = `+₹${refundAmt.toFixed(2)} (Refund)`;
          
          const netPayableEl = document.getElementById("edit-net-payable");
          if (netPayableEl) netPayableEl.textContent = `₹0.00`;
          
          const rewardDeltaEl = document.getElementById("edit-reward-delta");
          if (rewardDeltaEl) rewardDeltaEl.textContent = `Adjusted`;
          
          submitBtn.textContent = `Confirm Reschedule (Refund +₹${refundAmt.toFixed(2)})`;
        }
      };

      const loadSlots = async () => {
        const slotsContainer = document.getElementById("edit-slots-container");
        if (!slotsContainer) return;
        const slots = await window.api.getSlots(booking.court_id, dateInput.value);
        
        slotsContainer.innerHTML = slots.map(s => {
          if (s.is_past) {
            return `
              <div class="slot-box past-slot unavailable" title="Time slot has already passed">
                <span class="slot-time">${s.start_time}</span>
                <span class="slot-price">Past</span>
              </div>
            `;
          }
          if (s.is_unavailable) {
            return `
              <div class="slot-box blocked-slot unavailable" title="${s.unavailability_reason || 'Court/Academy Unavailable'}">
                <span class="slot-time">${s.start_time}</span>
                <span class="slot-price">Blocked</span>
              </div>
            `;
          }
          if (s.is_booked && s.id !== booking.slot_id) {
            return `<div class="slot-box booked"><span class="slot-time">${s.start_time}</span><span class="slot-price">Booked</span></div>`;
          }
          const isSelected = s.id === this.activeEditSlotId;
          return `
            <div class="slot-box ${isSelected ? "selected" : ""}" data-slot-id="${s.id}">
              <span class="slot-time">${s.start_time}</span>
              <span class="slot-price">₹${s.price.toFixed(2)}</span>
            </div>
          `;
        }).join("");

        // Initial breakdown calculation
        let selectedSlot = slots.find(s => s.id === this.activeEditSlotId);
        if (!selectedSlot || selectedSlot.is_unavailable || selectedSlot.is_past) {
          // Fall back to first available slot on this date
          selectedSlot = slots.find(s => !s.is_unavailable && !s.is_past && !s.is_booked);
          if (selectedSlot) {
            this.activeEditSlotId = selectedSlot.id;
            slotsContainer.querySelectorAll(".slot-box").forEach(b => {
              b.classList.toggle("selected", Number(b.dataset.slotId) === selectedSlot.id);
            });
          }
        }
        if (selectedSlot) updatePriceBreakdown(selectedSlot);

        slotsContainer.querySelectorAll(".slot-box:not(.booked):not(.unavailable):not(.past-slot)").forEach(box => {
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

      if (dateInput) {
        dateInput.onchange = async () => await loadSlots();
      }
    } catch (err) {
      console.error("openEditModal error:", err);
      alert("Could not load reschedule details: " + err.message);
    }
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
    const newDate = document.getElementById("edit-date-input")?.value;
    if (!newDate) {
      alert("Please choose a date.");
      return;
    }
    try {
      if (this.activeEditBooking?.booking_type === "MONTHLY") {
        const originalDate = document.getElementById("edit-monthly-day-select")?.value;
        if (!originalDate) {
          alert("No pass day selected to move.");
          return;
        }
        await window.api.rescheduleMonthlyDay(this.activeEditBookingId, originalDate, newDate, this.activeEditSlotId);
        this.closeEditModal();
        this.showToast("Pass day rescheduled!");
        await this.renderBookingsList();
        return;
      }
      const res = await window.api.updateBooking(this.activeEditBookingId, newDate, this.activeEditSlotId);
      this.currentUser.wallet_balance = res.updatedWallet;
      this.updateUserHeaderPill();
      this.closeEditModal();

      this.showToast("Rescheduled!");
      await this.renderBookingsList();
    } catch (err) {
      alert(err.message);
    }
  }

});
