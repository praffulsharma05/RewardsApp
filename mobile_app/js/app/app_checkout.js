/**
 * app_checkout.js - Booking Checkout, Wallet Credit Deductions & Confirmation
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // SCREEN 4B: TERMS & CONDITIONS BEFORE PAYMENT
  // ==========================================
  async renderTermsAndConditions() {
    const sportName = this.draft.sportName || "Selected Sport";
    const badgeEl = document.getElementById("tc-sport-badge");
    const subEl = document.getElementById("tc-sport-subtitle");
    const dressEl = document.getElementById("tc-dress-code-text");
    const chkEl = document.getElementById("chk-accept-booking-tc");
    const btnEl = document.getElementById("btn-accept-tc-proceed");

    if (badgeEl) badgeEl.textContent = sportName;
    if (subEl) subEl.textContent = `${sportName} • ${this.draft.courtName || "Court"}`;

    const lower = sportName.toLowerCase();
    let dressText = `Wear proper athletic sportswear (shorts/track pants and breathable jersey). Clean sports shoes with non-marking soles are required.`;
    if (lower.includes("badminton") || lower.includes("squash") || lower.includes("table tennis")) {
      dressText = `<strong>${sportName} (Indoor):</strong> Mandatory <strong>non-marking gum/rubber-sole indoor court shoes</strong> and proper athletic attire (t-shirt & shorts/track pants). Street shoes, black-sole sneakers, sandals, or barefoot play are strictly prohibited.`;
    } else if (lower.includes("football")) {
      dressText = `<strong>${sportName} (Turf/Ground):</strong> Wear <strong>turf trainers or rubber studs (AG/TF)</strong>, jersey, shorts, and shin guards. Metal studs/spikes and formal/casual footwear are strictly prohibited.`;
    } else if (lower.includes("tennis")) {
      dressText = `<strong>${sportName} (Court):</strong> Wear <strong>non-marking tennis court shoes</strong> and athletic sportswear. Running spikes, heels, or sandals are not permitted on court.`;
    }
    if (dressEl) dressEl.innerHTML = dressText;

    if (chkEl && btnEl) {
      chkEl.checked = false;
      const syncBtn = () => {
        const ok = chkEl.checked;
        btnEl.disabled = !ok;
        btnEl.style.opacity = ok ? "1" : "0.5";
        btnEl.style.cursor = ok ? "pointer" : "not-allowed";
      };
      syncBtn();
      chkEl.onchange = syncBtn;
      btnEl.onclick = async () => {
        if (!chkEl.checked) {
          this.showToast("Please accept all Terms & Conditions first.");
          return;
        }
        this.navigateTo("screen-checkout");
        await this.renderCheckout();
      };
    }
  },

  // ==========================================
  // SCREEN 5: CHECKOUT & DYNAMIC REWARD CALCULATION
  // ==========================================
  async renderCheckout() {
    const elSport = document.getElementById("chk-sport");
    const elCourt = document.getElementById("chk-court");
    const elDate = document.getElementById("chk-date");
    const elTime = document.getElementById("chk-time");
    const elPrice = document.getElementById("chk-price");

    const isMonthly = this.draft.bookingMode === "MONTHLY";
    const fmtShort = (iso) => {
      if (!iso || !iso.includes("-")) return iso || "";
      const [, m, d] = iso.split("-").map(Number);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d} ${months[m - 1] || ""}`;
    };
    if (elSport) elSport.textContent = this.draft.sportName || "";
    if (elCourt) elCourt.textContent = this.draft.courtName || "";
    if (elDate) {
      elDate.textContent = isMonthly
        ? `${fmtShort(this.draft.date)} – ${fmtShort(this.draft.monthlyEndDate)} (${this.draft.monthlyDays || 30}d)`
        : (this.draft.date || "");
    }
    if (elTime) elTime.textContent = this.draft.slotTime || "";
    if (elPrice) elPrice.textContent = `₹${(this.draft.price || 0).toFixed(2)}`;

    const regRow = document.getElementById("chk-monthly-regular-row");
    const discRow = document.getElementById("chk-monthly-discount-row");
    const regEl = document.getElementById("chk-monthly-regular-price");
    const discEl = document.getElementById("chk-monthly-discount-amt");
    if (isMonthly && Number(this.draft.monthlyDiscountAmount || 0) > 0) {
      regRow?.classList.remove("d-none");
      discRow?.classList.remove("d-none");
      if (regEl) regEl.textContent = `₹${Number(this.draft.regularPrice || 0).toFixed(2)}`;
      if (discEl) discEl.textContent = `-₹${Number(this.draft.monthlyDiscountAmount || 0).toFixed(2)}`;
    } else {
      regRow?.classList.add("d-none");
      discRow?.classList.add("d-none");
    }

    // Refresh user's live wallet balance
    if (this.currentUser) {
      const liveUser = await window.api.getUser(this.currentUser.id);
      if (liveUser) this.currentUser = liveUser;
    }
    const walletBalance = Number(this.currentUser?.wallet_balance || 0);
    const walletAvailPill = document.getElementById("chk-wallet-avail");
    if (walletAvailPill) walletAvailPill.textContent = `₹${walletBalance.toFixed(2)}`;

    // Fetch Admin Configured Maximum Discount / Rewards Redemption Cap from DB (e.g. 30%)
    const maxDiscountCap = await window.api.getMaxDiscountPercent();
    const capBadge = document.getElementById("badge-checkout-discount-cap");
    if (capBadge) capBadge.textContent = `Max Cap: ${maxDiscountCap}%`;

    // Fetch Admin Facility Receiving UPI ID (Default: gyananiharish@ybl)
    const adminUpi = (window.api && window.api.getAdminUPI) ? await window.api.getAdminUPI() : "gyananiharish@ybl";
    this.adminUpi = adminUpi || "gyananiharish@ybl";

    const chkUseWallet = document.getElementById("chk-use-wallet");
    const updatePaymentMath = () => {
      const isChecked = chkUseWallet ? chkUseWallet.checked : false;
      const slotPrice = Number(this.draft.price || 0);

      // Maximum discount/redemption allowed by Admin rule (e.g. 30% of fee)
      const maxAllowedFromPoints = Number(((slotPrice * maxDiscountCap) / 100).toFixed(2));
      const applied = (isChecked && walletBalance > 0)
        ? Math.min(walletBalance, maxAllowedFromPoints, slotPrice)
        : 0;
      const netPayable = Math.max(0, slotPrice - applied);

      this.draft.walletApplied = applied;

      const deductElem = document.getElementById("chk-wallet-deduction");
      const netElem = document.getElementById("chk-net-payable");
      if (deductElem) deductElem.textContent = applied > 0 ? `-₹${applied.toFixed(2)}` : "₹0.00";
      if (netElem) netElem.textContent = `₹${netPayable.toFixed(2)}`;

      this.setupPaymentMethods(netPayable);
    };

    if (chkUseWallet) {
      chkUseWallet.disabled = false;
      chkUseWallet.onchange = () => {
        if (chkUseWallet.checked && walletBalance <= 0) {
          this.showToast("Wallet balance is ₹0.00");
        }
        updatePaymentMath();
      };
    }
    updatePaymentMath();

    // Read Admin Configured Reward Rate from IndexedDB
    const rewardRate = await window.api.getRewardRate();
    const rewardAmount = Number((((this.draft.price || 0) * rewardRate) / 100).toFixed(2));

    const rwdBadge = document.getElementById("chk-reward-badge");
    const rwdRate = document.getElementById("chk-reward-rate");
    const rwdAmt = document.getElementById("chk-reward-amount");
    if (rwdBadge) rwdBadge.textContent = `${rewardRate}% Active`;
    if (rwdRate) rwdRate.textContent = `${rewardRate}%`;
    if (rwdAmt) rwdAmt.textContent = `+₹${rewardAmount.toFixed(2)}`;

    // Check Facility & Date Availability
    const dateAvail = await this.checkDateAvailability(this.draft.date);
    const btnConfirm = document.getElementById("btn-confirm-checkout");
    if (!dateAvail.isAvailable) {
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = `Closed on ${this.draft.date} - Booking Disabled`;
      }
    } else {
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Confirm & Book Slot";
      }
    }
  },

  // Setup Dynamic UPI Payment, QR Code, and COD Options
  setupPaymentMethods(netPayable) {
    const payCard = document.getElementById("checkout-payment-methods-card");
    if (!payCard) return;

    if (netPayable <= 0) {
      payCard.innerHTML = `
        <div class="wf-card-header mb-6">
          <span class="wf-title-sm">Payment Method</span>
          <span class="badge-instant">100% Covered</span>
        </div>
        <div class="wallet-covered-notice">
          &#10003; 100% of this reservation is covered by your reward wallet credits. No additional payment required!
        </div>
      `;
      this.draft.paymentMethod = "WALLET";
      return;
    }

    this.draft.paymentMethod = this.draft.paymentMethod === "COD" ? "COD" : "UPI";

    const adminUPI = this.adminUpi || "gyananiharish@ybl";
    const upiDisplay = document.getElementById("upi-id-display");
    if (upiDisplay) upiDisplay.textContent = adminUPI;

    const upiAmount = netPayable.toFixed(2);
    const upiURL = `upi://pay?pa=${encodeURIComponent(adminUPI)}&pn=${encodeURIComponent("Sports Facility")}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent("Slot Booking")}`;
    const qrContainer = document.getElementById("upi-qr-container");
    if (qrContainer && !document.getElementById("img-upi-qr")) {
      qrContainer.innerHTML = `<img src="assets/upi_qr_code.png" alt="Scan to Pay via UPI" class="upi-qr-img" id="img-upi-qr">`;
    }

    const btnDownloadQR = document.getElementById("btn-download-qr");
    if (btnDownloadQR) {
      btnDownloadQR.onclick = (e) => {
        // Allows direct download of the image
        this.showToast("Downloading QR...");
      };
    }

    const radUPI = document.getElementById("rad-pay-upi");
    const radCOD = document.getElementById("rad-pay-cod");
    const optUPI = document.getElementById("opt-pay-upi");
    const optCOD = document.getElementById("opt-pay-cod");
    const upiBox = document.getElementById("upi-details-box");
    const codBox = document.getElementById("cod-details-box");

    const switchMethod = (method) => {
      this.draft.paymentMethod = method;
      if (method === "UPI") {
        if (radUPI) radUPI.checked = true;
        optUPI?.classList.add("selected");
        optCOD?.classList.remove("selected");
        if (upiBox) upiBox.classList.remove("d-none");
        if (codBox) codBox.classList.add("d-none");
      } else {
        if (radCOD) radCOD.checked = true;
        optCOD?.classList.add("selected");
        optUPI?.classList.remove("selected");
        if (upiBox) upiBox.classList.add("d-none");
        if (codBox) codBox.classList.remove("d-none");
      }
    };

    radUPI?.addEventListener("change", () => switchMethod("UPI"));
    radCOD?.addEventListener("change", () => switchMethod("COD"));
    optUPI?.addEventListener("click", (e) => { if (!e.target.closest("a, button")) switchMethod("UPI"); });
    optCOD?.addEventListener("click", () => switchMethod("COD"));

    const copyUPIOnly = () => {
      try { navigator.clipboard?.writeText(adminUPI); } catch (_) {}
      this.showToast("UPI ID copied!");
    };

    document.getElementById("btn-copy-upi")?.addEventListener("click", (e) => {
      e.stopPropagation();
      copyUPIOnly();
    });
    document.getElementById("btn-upi-id-badge")?.addEventListener("click", () => copyUPIOnly());
  },

  // Handle Checkout Confirmation
  async handleCheckout() {
    if (!this.currentUser) {
      this.showToast("Please sign in first");
      this.navigateTo("screen-auth");
      return;
    }

    const useWallet = document.getElementById("chk-use-wallet")?.checked || false;
    const paymentMethod = this.draft.paymentMethod || "UPI";
    const slotsToBook = (Array.isArray(this.draft.selectedSlots) && this.draft.selectedSlots.length > 0)
      ? this.draft.selectedSlots
      : [{ id: this.draft.slotId, time: this.draft.slotTime, price: this.draft.price }];

    let bookedCount = 0;
    try {
      let lastResult = null;
      let totalWalletApplied = 0;
      let totalRewardAmount = 0;

      for (const s of slotsToBook) {
        const res = (this.draft.bookingMode === "MONTHLY")
          ? await window.api.createMonthlyBooking({
              userId: this.currentUser.id,
              sportId: this.draft.sportId,
              courtId: this.draft.courtId,
              slotId: s.id,
              startDate: this.draft.date,
              useWallet: useWallet,
              paymentMethod: paymentMethod
            })
          : await window.api.createBooking({
              userId: this.currentUser.id,
              sportId: this.draft.sportId,
              courtId: this.draft.courtId,
              slotId: s.id,
              date: this.draft.date,
              useWallet: useWallet,
              paymentMethod: paymentMethod
            });
        lastResult = res;
        bookedCount++;
        totalWalletApplied += Number(res.booking.wallet_applied || 0);
        totalRewardAmount += Number(res.booking.reward_amount || 0);
      }

      if (!lastResult) return;

      this.currentUser.wallet_balance = lastResult.updatedWallet;
      this.updateUserHeaderPill();
      this.draft.selectedSlots = [];

      // Render Success Pass
      const passIdEl = document.getElementById("pass-id");
      if (passIdEl) {
        passIdEl.textContent = bookedCount > 1
          ? `#${lastResult.booking.id} (${bookedCount} slots)`
          : `#${lastResult.booking.id}`;
      }
      const walletPaidElem = document.getElementById("pass-wallet-paid");
      if (walletPaidElem) {
        walletPaidElem.textContent = totalWalletApplied > 0 ? 
          `-₹${totalWalletApplied.toFixed(2)}` : "₹0.00";
      }
      const passRewardEl = document.getElementById("pass-reward");
      if (passRewardEl) {
        passRewardEl.textContent = `+₹${totalRewardAmount.toFixed(2)} (${lastResult.booking.reward_percent}%)`;
      }
      const passWalletEl = document.getElementById("pass-wallet");
      if (passWalletEl) {
        passWalletEl.textContent = `₹${lastResult.updatedWallet.toFixed(2)}`;
      }

      const passMethodElem = document.getElementById("pass-payment-method");
      if (passMethodElem) {
        passMethodElem.textContent = lastResult.booking.payment_method === "COD" 
          ? "COD (Pay at Venue)" 
          : (lastResult.booking.payment_method === "WALLET" ? "100% Wallet Credits" : "UPI (Paid Online)");
      }

      // Render dynamic SVG QR pass for UPI/Online or Pay-at-Venue Card for COD
      const qrPassBox = document.getElementById("pass-qr-box") || document.querySelector(".qr-mock-box");
      const codPassCard = document.getElementById("pass-cod-card");
      const codBookingIdSpan = document.getElementById("pass-cod-booking-id");

      if (lastResult.booking.payment_method === "COD") {
        if (qrPassBox) qrPassBox.classList.add("d-none");
        if (codPassCard) {
          codPassCard.classList.remove("d-none");
          if (codBookingIdSpan) codBookingIdSpan.textContent = `#${lastResult.booking.id}`;
        }
      } else {
        if (codPassCard) codPassCard.classList.add("d-none");
        if (qrPassBox) {
          qrPassBox.classList.remove("d-none");
          if (window.generateQRCodeSVG) {
            qrPassBox.innerHTML = window.generateQRCodeSVG(`PASS-${lastResult.booking.id}-${this.draft.date}-${this.draft.slotTime}`, 140);
          }
        }
      }

      this.showToast(bookedCount > 1 ? `${bookedCount} slots booked!` : "Slot booked!");
      await this.renderBookingsList();
      this.navigateTo("screen-bookings");

    } catch (err) {
      if (bookedCount > 0) {
        await this.renderBookingsList();
      }
      this.showToast(err.message || "Booking failed");
    }
  }

});
