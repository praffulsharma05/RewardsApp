/**
 * app_bookings.js - My Bookings List and Cancellation Flow
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // SCREEN 7: MY BOOKINGS (LIST, EDIT & CANCEL)
  // ==========================================
  async renderBookingsList() {
    const container = document.getElementById("bookings-list-container");
    if (!container) return;

    if (!this.currentUser) {
      container.innerHTML = `<div class="wf-card"><p>Please sign in to view your bookings.</p></div>`;
      return;
    }

    const bookings = await window.api.getUserBookings(this.currentUser.id);

    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="wf-card" style="text-align: center; padding: 24px 12px;">
          <p class="wf-meta">No reservations found.</p>
          <button class="wf-btn wf-btn-sm" id="btn-empty-book-now" style="margin-top: 8px;">Book Table Tennis &rarr;</button>
        </div>
      `;
      document.getElementById("btn-empty-book-now")?.addEventListener("click", () => {
        this.navigateTo("screen-sports");
      });
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    container.innerHTML = bookings.map((b, idx) => {
      const isConfirmed = b.status === "CONFIRMED";
      const isPastGame = isConfirmed && ((b.date < todayStr) || (b.date === todayStr && (b.end_time || b.start_time) <= currentHourMin));

      let statusBadge = `<span class="wf-pill ${isConfirmed ? "" : "cancelled"}">${b.status}</span>`;
      if (isPastGame) {
        statusBadge = `<span class="wf-pill" style="background:var(--glacier-100); color:var(--glacier-800); border-color:var(--glacier-200);">COMPLETED</span>`;
      }

      return `
        <div class="wf-card ${isConfirmed ? "" : "highlight"} booking-accordion-card" data-booking-id="${b.id}">
          <div class="booking-collapse-header" title="Tap to expand or collapse details">
            <div>
              <strong style="font-size:0.88rem; color:var(--glacier-950);">${b.sport_name}</strong>
              <small class="wf-meta" style="display:block;">${b.date}</small>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${statusBadge}
              <span class="booking-chevron" aria-label="Toggle details">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
          </div>

          <div class="booking-collapse-body">
            <div class="app-booking-detail-container">
              <div class="app-booking-detail-row justify-between">
                <span><span class="app-booking-detail-label">Facility:</span> <strong class="app-booking-detail-val">${b.court_name}</strong></span>
                <span><span class="app-booking-detail-label">Booking ID:</span> <strong class="app-booking-detail-val">#${b.id}</strong></span>
              </div>
              <div class="app-booking-detail-row justify-between">
                <span><span class="app-booking-detail-label">Slot Fee:</span> <strong class="app-booking-detail-val">₹${b.price.toFixed(2)}</strong></span>
                <span><span class="app-booking-detail-label">Reward:</span> <span class="app-booking-reward-val">${isConfirmed ? `+` : `Reversed `}₹${b.reward_amount.toFixed(2)} (${b.reward_percent}%)</span></span>
              </div>
              ${b.wallet_applied > 0 ? `
              <div class="app-booking-detail-row justify-between">
                <small style="color:var(--text-muted); font-weight:600;">Paid with Wallet: -₹${b.wallet_applied.toFixed(2)}</small>
                <span><span class="app-booking-detail-label">Net Paid:</span> <strong class="app-booking-detail-val">₹${b.net_paid.toFixed(2)}</strong></span>
              </div>` : ''}
            </div>

            ${isConfirmed ? (isPastGame ? `
              <div class="past-game-banner">
                &#10003; <strong>Game Completed</strong> &bull; Past reservations cannot be edited or cancelled.
              </div>
            ` : `
              <div style="display:flex; gap:6px; margin-top:8px;">
                <button class="wf-btn wf-btn-secondary wf-btn-sm btn-edit-booking" data-id="${b.id}" style="flex:1;">
                  Edit / Reschedule
                </button>
                <button class="wf-btn wf-btn-danger wf-btn-sm btn-cancel-booking" data-id="${b.id}" style="flex:1;">
                  Cancel Slot
                </button>
              </div>
            `) : `
              <div style="margin-top: 8px; padding: 10px 12px; border: 1.5px dashed var(--glacier-300); border-radius: 12px; background: var(--glacier-50); font-size: 0.78rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <strong style="color:var(--glacier-950);">Refund Status:</strong>
                  ${b.refund_status === 'REFUNDED' 
                    ? `<span class="wf-pill" style="background:var(--emerald-bg); color:var(--emerald-accent); border:1px solid var(--emerald-border);">Refunded ₹${Number(b.refund_amount || 0).toFixed(2)}</span>` 
                    : `<span class="wf-pill" style="border-style:dashed; color:var(--rose-accent); background:var(--rose-bg); border-color:var(--rose-border);">Pending Admin Review</span>`}
                </div>
                ${b.refund_status === 'REFUNDED' 
                  ? `<div style="color:var(--text-muted);">${b.admin_refund_note ? `Admin Note: "${b.admin_refund_note}"` : ''}</div>` 
                  : `<div style="color:var(--text-muted);">Slot cancelled ${b.hours_before_slot != null ? `(${b.hours_before_slot}h before slot)` : ''}. Admin will manually review & disburse refund.</div>`}
              </div>
            `}
          </div>
        </div>
      `;
    }).join("");

    // Bind Expand / Collapse Toggle on Header Click (Single-open accordion)
    container.querySelectorAll(".booking-collapse-header").forEach(hdr => {
      hdr.addEventListener("click", () => {
        const card = hdr.closest(".booking-accordion-card");
        if (!card) return;
        const isCurrentlyExpanded = card.classList.contains("expanded");

        // Auto-close all other cards in the container
        container.querySelectorAll(".booking-accordion-card").forEach(c => {
          if (c !== card) c.classList.remove("expanded");
        });

        // Toggle the clicked card
        card.classList.toggle("expanded", !isCurrentlyExpanded);
      });
    });

    // Bind Edit & Cancel Buttons (prevent bubbling to accordion toggle)
    container.querySelectorAll(".btn-edit-booking").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openEditModal(Number(btn.dataset.id));
      });
    });

    container.querySelectorAll(".btn-cancel-booking").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openCancelModal(Number(btn.dataset.id));
      });
    });
  },

  // ==========================================
  // CANCEL MODAL ACTIONS
  // ==========================================
  async openCancelModal(bookingId) {
    this.activeCancelBookingId = bookingId;
    const booking = await window.api.getBookingById(bookingId);
    if (!booking) return;

    // Check cancellation cutoff window
    const check = await window.api.checkCancellationEligibility(booking);

    const titleEl = document.getElementById("cancel-modal-title");
    if (titleEl) {
      titleEl.textContent = `Booking #${booking.id} • ${booking.sport_name} (${booking.start_time})`;
    }

    const rewardEl = document.getElementById("cancel-modal-reward");
    if (rewardEl) {
      rewardEl.textContent = `-₹${(booking.reward_amount || 0).toFixed(2)}`;
    }

    const refundEl = document.getElementById("cancel-modal-refund-amt");
    const timingMeta = document.getElementById("cancel-modal-timing-meta");
    const submitBtn = document.getElementById("btn-submit-cancel");
    const noticeBox = document.getElementById("cancel-cutoff-notice");

    if (check.isEligible) {
      if (noticeBox) {
        noticeBox.style.borderColor = "var(--emerald-accent, #10b981)";
        noticeBox.style.background = "#f0fdf4";
      }
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:var(--emerald-accent, #059669); font-weight:700;">&#10003; Eligible for Cancellation</span>`;
      }
      if (refundEl) {
        refundEl.textContent = `+₹${check.estimatedRefund.toFixed(2)}`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `Confirm Cancellation`;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
      }
    } else {
      if (noticeBox) {
        noticeBox.style.borderColor = "var(--rose-border, #fecdd3)";
        noticeBox.style.background = "#fff1f2";
      }
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:var(--rose-accent, #e11d48); font-weight:700;">&#9888; Cancellation Locked</span> <span style="color:var(--glacier-700); font-weight:normal;">(< ${check.cutoffHours}h notice)</span>`;
      }
      if (refundEl) {
        refundEl.textContent = `₹0.00`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Locked (< ${check.cutoffHours}h Notice)`;
        submitBtn.style.opacity = "0.45";
        submitBtn.style.cursor = "not-allowed";
      }
    }

    document.getElementById("modal-cancel-booking")?.classList.add("active");
  },

  closeCancelModal() {
    document.getElementById("modal-cancel-booking")?.classList.remove("active");
    this.activeCancelBookingId = null;
  },

  async handleConfirmCancellation() {
    if (!this.activeCancelBookingId) return;
    try {
      const res = await window.api.cancelBooking(this.activeCancelBookingId);
      this.currentUser.wallet_balance = res.updatedWallet;
      this.updateUserHeaderPill();
      this.closeCancelModal();
      this.showToast("Booking cancelled!");
      await this.renderBookingsList();
    } catch (err) {
      alert(err.message);
    }
  }

});
