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
        <div class="user-row-header">
          <div class="user-row-info">
            <div class="user-row-name-group">
              <strong class="user-row-name">${u.name}</strong>
              <span class="user-id-badge">#${u.id}</span>
            </div>
            <span class="user-row-email">${u.email}</span>
          </div>
          <div class="user-row-actions">
            <span class="user-balance-pill" title="Current Reward Balance">
              ₹${(u.wallet_balance || 0).toFixed(2)}
            </span>
            <button type="button" class="btn-user-remove btn-delete-user" data-id="${u.id}" data-name="${u.name}" data-email="${u.email}">
              Remove
            </button>
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-delete-user").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const name = btn.getAttribute("data-name") || "";
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
      this.showToast(APP_CONSTANTS.MESSAGES.USER_REMOVED(id));
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

    const adminUpi = await window.api.getAdminUPI();
    const adminUpiInput = document.getElementById("admin-upi-input");
    if (adminUpiInput) adminUpiInput.value = adminUpi;

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
      `<strong>Booking #${booking.id} &bull; ${booking.court_name}</strong>`;
    document.getElementById("refund-modal-price").textContent = `₹${booking.price.toFixed(2)}`;

    const inputAmount = document.getElementById("refund-input-amount");
    inputAmount.value = booking.refund_amount > 0 ? booking.refund_amount : booking.price;
    inputAmount.max = booking.price;

    const inputNote = document.getElementById("refund-input-note");
    inputNote.value = booking.admin_refund_note || "";

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
        <div class="wf-card ${isConfirmed ? "" : "highlight"} admin-booking-card card-accordion ${isRefundPending ? "refund-pending" : ""}">
          <div class="admin-booking-header card-collapse-header" title="Tap to expand or collapse">
            <div class="admin-booking-title-group">
              <div class="admin-booking-title">
                <span>Booking #${b.id}</span>
                <span class="wf-meta">&bull;</span>
                <span>${b.sport_name}</span>
              </div>
            </div>
            <div class="admin-booking-badges">
              <span class="header-pill pill-sm ${isConfirmed ? "pill-confirmed" : "pill-cancelled"}">
                ${b.status}
              </span>
              <span class="card-chevron">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
          </div>
          <div class="admin-booking-body card-collapse-body">
            <div class="admin-booking-detail-row justify-between">
              <span class="admin-booking-detail-item"><span class="admin-booking-detail-label">Date:</span> <strong class="facility-date-badge">${b.date}</strong></span>
              <span><span class="admin-booking-detail-label">User ID:</span> <strong class="admin-css">#${b.user_id}</strong></span>
            </div>
            <div class="admin-booking-detail-row justify-between">
              <span class="admin-booking-detail-item"><span class="admin-booking-detail-label">Facility:</span> <strong class="admin-css">${b.court_name}</strong></span>
              <span class="facility-date-badge">${b.start_time} - ${b.end_time}</span>
            </div>
            <div class="admin-booking-detail-row justify-between">
              <span><span class="admin-booking-detail-label">Slot Fee:</span> <strong  class="admin-css">₹${b.price.toFixed(2)}</strong></span>
              <span><span class="admin-booking-detail-label">Net Paid:</span> <strong    class="admin-css" >₹${(b.net_paid || b.price).toFixed(2)}</strong></span>
            </div>
            
            ${b.status === "CANCELLED" ? `
              <div class="admin-refund-box">
                <div class="d-flex items-center justify-between mb-6 flex-wrap gap-4">
                  <span><strong>Refund Status:</strong></span>
                  <span class="header-pill pill-sm ${isRefunded ? "pill-refunded" : "pill-awaiting-refund"}">
                    ${isRefunded ? `REFUNDED ₹${Number(b.refund_amount || 0).toFixed(2)}` : "AWAITING REFUND"}
                  </span>
                </div>
                <div class="admin-cancellation-meta">Cancellation: <strong>${b.hours_before_slot != null ? `${b.hours_before_slot}h before slot` : "Advance"}</strong></div>
                ${isRefunded ? `
                  <div class="admin-refund-note-done">
                    &#10003; Refund Disbursed: ₹${Number(b.refund_amount || 0).toFixed(2)} credited to user's wallet.
                  </div>
                ` : `
                  <button type="button" class="wf-btn wf-btn-sm btn-open-refund-modal mt-8" data-id="${b.id}">
                    Send Refund
                  </button>
                `}
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    // Bind refund action buttons
    container.querySelectorAll(".btn-open-refund-modal").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openRefundModal(Number(btn.dataset.id));
      });
    });
  }
});
