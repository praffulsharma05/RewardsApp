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
        expiryText.innerHTML = `<span>&#9200; <strong>$${summary.earliestExpiringAmount.toFixed(2)}</strong> expires on <strong>${new Date(summary.earliestExpiry).toLocaleDateString()}</strong> (${summary.daysLeft} days remaining).</span>`;
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
        expiryLabel = `<small style="color:var(--text-muted); display:block;">Expires: ${new Date(l.expires_at).toLocaleDateString()} (${daysLeft > 0 ? `${daysLeft}d left` : 'Expired'})</small>`;
      }

      return `
        <div class="ledger-row">
          <div>
            <strong style="display:block;">${l.description}</strong>
            <small class="wf-meta">${new Date(l.created_at).toLocaleDateString()} &bull; ${l.type}</small>
            ${expiryLabel}
          </div>
          <span class="ledger-amount" style="color: #000;">
            ${isPositive ? `+` : ``}$${l.amount.toFixed(2)}
          </span>
        </div>
      `;
    }).join("");
  }
});
