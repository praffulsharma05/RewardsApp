/**
 * app_checkout.js - Booking Checkout, Wallet Credit Deductions & Confirmation
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // SCREEN 5: CHECKOUT & DYNAMIC REWARD CALCULATION
  // ==========================================
  async renderCheckout() {
    document.getElementById("chk-sport").textContent = this.draft.sportName;
    document.getElementById("chk-court").textContent = this.draft.courtName;
    document.getElementById("chk-date").textContent = this.draft.date;
    document.getElementById("chk-time").textContent = this.draft.slotTime;
    document.getElementById("chk-price").textContent = `$${this.draft.price.toFixed(2)}`;

    // Refresh user's live wallet balance
    if (this.currentUser) {
      const liveUser = await window.api.getUser(this.currentUser.id);
      if (liveUser) this.currentUser = liveUser;
    }
    const walletBalance = Number(this.currentUser?.wallet_balance || 0);
    const walletAvailPill = document.getElementById("chk-wallet-avail");
    if (walletAvailPill) walletAvailPill.textContent = `$${walletBalance.toFixed(2)}`;

    // Fetch Admin Configured Maximum Discount / Rewards Redemption Cap from DB (e.g. 30%)
    const maxDiscountCap = await window.api.getMaxDiscountPercent();
    const capBadge = document.getElementById("badge-checkout-discount-cap");
    if (capBadge) capBadge.textContent = `Max Cap: ${maxDiscountCap}%`;

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
      if (deductElem) deductElem.textContent = applied > 0 ? `-$${applied.toFixed(2)}` : "$0.00";
      if (netElem) netElem.textContent = `$${netPayable.toFixed(2)}`;
    };

    if (chkUseWallet) {
      chkUseWallet.disabled = walletBalance <= 0;
      chkUseWallet.checked = walletBalance > 0;
      chkUseWallet.onchange = () => updatePaymentMath();
    }
    updatePaymentMath();

    // Read Admin Configured Reward Rate from IndexedDB
    const rewardRate = await window.api.getRewardRate();
    const rewardAmount = Number(((this.draft.price * rewardRate) / 100).toFixed(2));

    document.getElementById("chk-reward-badge").textContent = `${rewardRate}% Active`;
    document.getElementById("chk-reward-rate").textContent = `${rewardRate}%`;
    document.getElementById("chk-reward-amount").textContent = `+$${rewardAmount.toFixed(2)}`;

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

  // Handle Checkout Confirmation
  async handleCheckout() {
    if (!this.currentUser) {
      alert("Please sign in first to book a slot.");
      this.navigateTo("screen-auth");
      return;
    }

    const useWallet = document.getElementById("chk-use-wallet")?.checked || false;

    try {
      const result = await window.api.createBooking({
        userId: this.currentUser.id,
        sportId: this.draft.sportId,
        courtId: this.draft.courtId,
        slotId: this.draft.slotId,
        date: this.draft.date,
        useWallet: useWallet
      });

      this.currentUser.wallet_balance = result.updatedWallet;
      this.updateUserHeaderPill();

      // Render Success Pass
      document.getElementById("pass-id").textContent = `#${result.booking.id}`;
      const walletPaidElem = document.getElementById("pass-wallet-paid");
      if (walletPaidElem) {
        walletPaidElem.textContent = result.booking.wallet_applied > 0 ? 
          `-$${result.booking.wallet_applied.toFixed(2)}` : "$0.00";
      }
      document.getElementById("pass-reward").textContent = `+$${result.booking.reward_amount.toFixed(2)} (${result.booking.reward_percent}%)`;
      document.getElementById("pass-wallet").textContent = `$${result.updatedWallet.toFixed(2)}`;

      const payNote = result.booking.wallet_applied > 0 ? 
        ` Paid $${result.booking.wallet_applied.toFixed(2)} with wallet credits!` : "";
      this.showToast(`Slot booked!${payNote} +$${result.booking.reward_amount.toFixed(2)} rewards credited.`);
      this.navigateTo("screen-success");

    } catch (err) {
      alert(err.message);
    }
  }

});
