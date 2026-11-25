/**
 * admin_users_refunds.js - Player Registry, Rules Configuration & Bookings Audit
 */
Object.assign(MobileAdminApp.prototype, {
  // ==========================================
  // SCREEN 3: REGISTERED USERS LIST
  // ==========================================
  async renderUsersList() {
    const container = document.getElementById("admin-users-list-container");
    const badge = document.getElementById("badge-users-total");
    if (!container) return;

    const users = await window.api.getAllUsers();
    if (badge) badge.textContent = `${users.length} Player${users.length === 1 ? '' : 's'}`;

    if (users.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No registered users yet.</p></div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="user-row-card" id="user-row-${u.id}">
        <div class="user-row-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="font-size:0.88rem;">${u.name}</strong>
            <small class="wf-meta" style="display:block;">${u.email} &bull; User ID: #${u.id}</small>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="user-balance-pill" title="Current Reward Balance">
              $${(u.wallet_balance || 0).toFixed(2)}
            </span>
            <button type="button" class="wf-btn wf-btn-danger wf-btn-sm btn-delete-user" data-id="${u.id}" data-name="${u.name}" data-email="${u.email}" style="padding:4px 8px; font-size:0.75rem;">
              Remove
            </button>
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-delete-user").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const name = btn.getAttribute("data-name") || "Player";
        const email = btn.getAttribute("data-email") || "";
        this.openDeleteUserModal(id, name, email);
      });
    });
  },

  // Open User Delete Modal
  openDeleteUserModal(userId, userName, userEmail) {
    this.pendingDeleteUserId = userId;
    const nameElem = document.getElementById("delete-user-name");
    const emailElem = document.getElementById("delete-user-email");
    if (nameElem) nameElem.textContent = `${userName} (#${userId})`;
    if (emailElem) emailElem.textContent = userEmail;
    document.getElementById("modal-delete-user")?.classList.add("active");
  },

  // Close User Delete Modal
  closeDeleteUserModal() {
    document.getElementById("modal-delete-user")?.classList.remove("active");
    this.pendingDeleteUserId = null;
  },

  // Confirm Delete User
  async handleConfirmDeleteUser() {
    if (!this.pendingDeleteUserId) return;
    const id = this.pendingDeleteUserId;

    try {
      await window.api.deleteUser(id);
      this.showToast(`User #${id} removed successfully.`);
      this.closeDeleteUserModal();
      await this.renderUsersList();
      await this.refreshOverview();
    } catch (err) {
      alert(err.message);
    }
  },

  // ==========================================
  // SCREEN 4: REWARDS & CANCELLATION RULES CONFIG
  // ==========================================
  async loadRewardSettings() {
    const rate = await window.api.getRewardRate();
    const input = document.getElementById("admin-reward-input");
    if (input) input.value = rate;

    const cutoff = await window.api.getCancellationCutoffHours();
    const cutoffInput = document.getElementById("admin-cutoff-input");
    if (cutoffInput) cutoffInput.value = cutoff;

    const refundPct = await window.api.getDefaultRefundPercent();
    const refundPctInput = document.getElementById("admin-refund-pct-input");
    if (refundPctInput) refundPctInput.value = refundPct;

    const reschedCutoff = await window.api.getRescheduleCutoffHours();
    const reschedCutoffInput = document.getElementById("admin-reschedule-cutoff-input");
    if (reschedCutoffInput) reschedCutoffInput.value = reschedCutoff;

    const upgradeRatio = await window.api.getWalletUpgradeRatio();
    const upgradeRatioInput = document.getElementById("admin-upgrade-ratio-input");
    if (upgradeRatioInput) upgradeRatioInput.value = upgradeRatio;

    const expiryDays = await window.api.getRewardExpiryDays();
    const expiryDaysInput = document.getElementById("admin-expiry-days-input");
    if (expiryDaysInput) expiryDaysInput.value = expiryDays;

    const maxDiscount = await window.api.getMaxDiscountPercent();
    const maxDiscountInput = document.getElementById("admin-max-discount-input");
    if (maxDiscountInput) maxDiscountInput.value = maxDiscount;

    // Render Availability & Blackout rules in Rules screen
    await this.renderClosedDatesList();
    await this.populateUnavailabilityCourts();
    await this.renderUnavailabilityList();
    await this.renderOverviewRulesSummary();
  },

  // ==========================================
  // SCREEN 5: ALL BOOKINGS AUDIT & MANUAL REFUNDS
  // ==========================================
  async openRefundModal(bookingId) {
    const booking = await window.api.getBookingById(bookingId);
    if (!booking) return;
    this.activeRefundBooking = booking;

    document.getElementById("refund-booking-id").value = booking.id;
    document.getElementById("refund-modal-booking-meta").innerHTML = 
      `<strong>Booking #${booking.id} (${booking.sport_name} &bull; ${booking.court_name})</strong><br>User ID #${booking.user_id} &bull; Date: ${booking.date} (${booking.start_time} - ${booking.end_time})`;
    document.getElementById("refund-modal-price").textContent = `$${booking.price.toFixed(2)}`;
    document.getElementById("refund-modal-cancel-timing").textContent = 
      `Cancellation: ${booking.cancelled_at ? new Date(booking.cancelled_at).toLocaleString() : 'Recently'} (${booking.hours_before_slot != null ? booking.hours_before_slot + 'h before slot' : 'Advance'})`;

    const inputAmount = document.getElementById("refund-input-amount");
    inputAmount.value = booking.refund_amount > 0 ? booking.refund_amount : booking.price;
    inputAmount.max = booking.price;

    const inputNote = document.getElementById("refund-input-note");
    inputNote.value = booking.admin_refund_note || "Full refund per 12h policy";

    document.getElementById("modal-admin-refund")?.classList.add("active");
  },

  closeRefundModal() {
    document.getElementById("modal-admin-refund")?.classList.remove("active");
    this.activeRefundBooking = null;
  },

  async renderAllBookings() {
    const container = document.getElementById("admin-bookings-list-container");
    if (!container) return;

    let bookings = await window.api.getAllBookings();

    if (this.bookingFilter && this.bookingFilter !== "all") {
      bookings = bookings.filter(b => b.status === this.bookingFilter);
    }

    if (bookings.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No reservations match filter "${this.bookingFilter}".</p></div>`;
      return;
    }

    container.innerHTML = bookings.map(b => {
      const isConfirmed = b.status === "CONFIRMED";
      const isRefunded = b.refund_status === "REFUNDED";
      const isRefundPending = b.status === "CANCELLED" && b.refund_status === "PENDING";

      return `
        <div class="wf-card ${isConfirmed ? "" : "highlight"}" style="${isRefundPending ? 'border: 1.5px dashed var(--rose-border); background: var(--rose-bg);' : ''}">
          <div class="wf-card-header">
            <div>
              <strong style="font-size:0.88rem; color:var(--glacier-950);">Booking #${b.id} &bull; ${b.sport_name}</strong>
              <small class="wf-meta" style="display:block;">User ID #${b.user_id} &bull; ${b.date}</small>
            </div>
            <div style="display:flex; gap:4px; align-items:center;">
              <span class="header-pill" style="font-size:0.68rem; ${isConfirmed ? 'background:var(--emerald-bg); color:var(--emerald-accent); border:1px solid var(--emerald-border);' : 'background:var(--rose-bg); color:var(--rose-accent); border:1px solid var(--rose-border);'}">
                ${b.status}
              </span>
              ${b.status === "CANCELLED" ? `
                <span class="header-pill" style="font-size:0.68rem; ${isRefunded ? 'background:var(--glacier-100); color:var(--glacier-800); border:1px solid var(--glacier-200);' : 'background:var(--rose-bg); color:var(--rose-accent); border:1px solid var(--rose-border);'}">
                  ${isRefunded ? `REFUNDED $${Number(b.refund_amount || 0).toFixed(2)}` : 'AWAITING REFUND'}
                </span>
              ` : ''}
            </div>
          </div>
          <div style="font-size:0.78rem; line-height:1.5;">
            <div>Facility: <strong>${b.court_name}</strong> (${b.start_time} - ${b.end_time})</div>
            <div>Slot Fee: <strong>$${b.price.toFixed(2)}</strong> | Net Paid: <strong>$${(b.net_paid || b.price).toFixed(2)}</strong></div>
            
            ${b.status === "CANCELLED" ? `
              <div style="margin-top:8px; padding:10px 12px; background:#ffffff; border:1.5px solid var(--glacier-200); border-radius:12px;">
                <div><strong>Cancellation Timing:</strong> ${b.hours_before_slot != null ? `${b.hours_before_slot} hrs before slot (Policy compliant)` : 'Registered cancellation'}</div>
                <div style="margin-top:4px;"><strong>Refund State:</strong> ${isRefunded ? `<span style="color:var(--emerald-accent); font-weight:700;">Sent $${Number(b.refund_amount).toFixed(2)} to Player Wallet</span> (${b.admin_refund_note || 'Approved'})` : '<span style="color:var(--rose-accent); font-weight:700;">Pending manual admin refund review</span>'}</div>
                <button type="button" class="wf-btn wf-btn-sm btn-open-refund-modal" data-id="${b.id}" style="margin-top:8px; width:100%; font-size:0.75rem;">
                  ${isRefunded ? 'Edit / Adjust Refund' : 'Set & Send Refund to User'}
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    // Bind refund action buttons
    container.querySelectorAll(".btn-open-refund-modal").forEach(btn => {
      btn.addEventListener("click", () => this.openRefundModal(Number(btn.dataset.id)));
    });
  }
});
