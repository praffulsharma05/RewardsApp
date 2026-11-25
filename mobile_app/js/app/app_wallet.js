/**
 * app_wallet.js - Rewards Wallet Balance & History Ledger Renderer
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // SCREEN 8: WALLET & REWARDS LEDGER
  // ==========================================
  async renderWallet() {
    const balDisplay = document.getElementById("wallet-balance-display");
    const container = document.getElementById("wallet-history-container");
    if (!balDisplay || !container) return;

    if (!this.currentUser) {
      balDisplay.textContent = "$0.00";
      container.innerHTML = `<p class="wf-meta">Please sign in to view rewards.</p>`;
      return;
    }

    // Refresh user balance from IndexedDB
    const user = await window.api.getUser(this.currentUser.id);
    this.currentUser = user;
    this.updateUserHeaderPill();

    balDisplay.textContent = `$${user.wallet_balance.toFixed(2)}`;

    // Load Wallet Expiry Summary
    const summary = await window.api.getUserWalletSummary(user.id);
    const pill = document.getElementById("wallet-validity-pill");
    const expiryText = document.getElementById("wallet-expiry-text");
    if (pill && summary) pill.textContent = `${summary.expiryDays} Days Policy`;
    if (expiryText && summary) {
      if (summary.earliestExpiry) {
        expiryText.innerHTML = `<span class="wallet-expiry-notice"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span><strong>$${summary.earliestExpiringAmount.toFixed(2)}</strong> expires on <strong>${new Date(summary.earliestExpiry).toLocaleDateString()}</strong> (${summary.daysLeft} days remaining).</span></span>`;
      } else {
        expiryText.innerHTML = `<span>All cashback rewards are valid for <strong>${summary.expiryDays} days</strong> from date of credit.</span>`;
      }
    }

    const ledger = await window.api.getWalletLedger(user.id);
    if (ledger.length === 0) {
      container.innerHTML = `<p class="wf-meta" style="padding:10px 0;">No reward transactions yet.</p>`;
      return;
    }

    container.innerHTML = ledger.map(l => {
      const isPositive = l.amount >= 0;
      let expiryLabel = "";
      if (l.amount > 0 && l.expires_at) {
        const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000);
        if (daysLeft > 0) {
          expiryLabel = `<span>&bull; Expires in ${daysLeft}d</span>`;
        }
      }

      // Format clean, human-readable title & only necessary info
      let displayTitle = l.description || "Reward Transaction";
      let noteText = "";

      if (l.type === "ADMIN_MANUAL_REFUND") {
        displayTitle = l.booking_id ? `Admin Refund &bull; Booking #${l.booking_id}` : `Admin Refund`;
        if (l.description && l.description.includes(" - ")) {
          const rawNote = l.description.split(" - ").slice(1).join(" - ").trim();
          if (rawNote && rawNote.toLowerCase() !== "manual refund") {
            noteText = rawNote;
          }
        }
      } else if (l.type === "REWARD_EARNED") {
        displayTitle = l.booking_id ? `Cashback Reward &bull; Booking #${l.booking_id}` : `Cashback Reward`;
      } else if (l.type === "WALLET_PAYMENT") {
        displayTitle = l.booking_id ? `Wallet Payment &bull; Booking #${l.booking_id}` : `Wallet Payment`;
      } else if (l.type === "WALLET_UPGRADE_PAYMENT") {
        displayTitle = l.booking_id ? `Reschedule Upgrade &bull; Booking #${l.booking_id}` : `Reschedule Upgrade`;
      } else if (l.type === "WALLET_DOWNGRADE_REFUND") {
        displayTitle = l.booking_id ? `Reschedule Difference &bull; Booking #${l.booking_id}` : `Reschedule Difference`;
      } else if (l.type === "REWARD_REVERSED") {
        displayTitle = l.booking_id ? `Reward Reversal &bull; Booking #${l.booking_id}` : `Reward Reversal`;
      } else if (l.type === "WELCOME_BONUS") {
        displayTitle = `Welcome Bonus`;
      } else if (displayTitle.includes(" - ")) {
        displayTitle = displayTitle.split(" - ")[0].trim();
      }

      const dateStr = new Date(l.created_at).toLocaleDateString();

      return `
        <div class="ledger-row">
          <div class="ledger-info">
            <strong class="ledger-title">${displayTitle}</strong>
            <div class="ledger-meta">
              <span>${dateStr}</span>
              ${noteText ? `<span>&bull; ${noteText}</span>` : ""}
              ${expiryLabel}
            </div>
          </div>
          <span class="ledger-amount ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? `+` : ``}$${l.amount.toFixed(2)}
          </span>
        </div>
      `;
    }).join("");
  }
});
