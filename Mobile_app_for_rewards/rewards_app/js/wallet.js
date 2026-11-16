/**
 * wallet.js - Customer Mobile Wallet Controller
 * Gained Rewards & Applied Rewards screens, Nearest Expiry & Collapsible Views
 * Strict line limit: <= 300 lines
 */
document.addEventListener('DOMContentLoaded', async () => {
  const customerNameEl = document.getElementById('customerName');
  const customerPhoneEl = document.getElementById('customerPhone');
  const totalPointsEl = document.getElementById('totalPoints');
  const activeCountEl = document.getElementById('activeCount');
  const expiredCountEl = document.getElementById('expiredCount');
  const cappingSummaryEl = document.getElementById('cappingSummary');
  const rewardsListContainer = document.getElementById('rewardsListContainer');
  const appliedRewardsListContainer = document.getElementById('appliedRewardsListContainer');
  const emptyGainedState = document.getElementById('emptyGainedState');
  const emptyAppliedState = document.getElementById('emptyAppliedState');
  const gainedBadge = document.getElementById('gainedCountBadge');
  const appliedBadge = document.getElementById('appliedCountBadge');
  const btnLogout = document.getElementById('btnLogout');

  const tabGained = document.getElementById('tabGainedRewards');
  const tabApplied = document.getElementById('tabAppliedRewards');
  const viewGained = document.getElementById('viewGainedRewards');
  const viewApplied = document.getElementById('viewAppliedRewards');

  const currentUser = window.rewardsDB.getCurrentUser();
  if (!currentUser) { window.location.href = 'login.html'; return; }

  customerNameEl.textContent = currentUser.name || 'Valued Customer';
  customerPhoneEl.textContent = `+91 ${currentUser.phone}`;

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.rewardsDB.logoutUser();
      window.location.href = 'login.html';
    });
  }

  // Segment Tab Switcher
  function switchWalletView(isApplied) {
    tabGained.classList.toggle('active', !isApplied);
    tabApplied.classList.toggle('active', isApplied);
    viewGained.classList.toggle('u-hidden', isApplied);
    viewApplied.classList.toggle('u-hidden', !isApplied);
  }

  tabGained.addEventListener('click', () => switchWalletView(false));
  tabApplied.addEventListener('click', () => switchWalletView(true));

  function toggleCard(card, container) {
    const isExpanded = card.classList.contains('is-expanded');
    container.querySelectorAll('.reward-card.is-expanded').forEach(c => {
      c.classList.remove('is-expanded');
      const h = c.querySelector('.reward-card-header');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
    if (!isExpanded) {
      card.classList.add('is-expanded');
      const h = card.querySelector('.reward-card-header');
      if (h) h.setAttribute('aria-expanded', 'true');
    }
  }

  // Render 1: Gained Rewards (Collapsible view with points & expiry date)
  function renderGainedRewards(rewards) {
    rewardsListContainer.innerHTML = '';
    const now = new Date();
    let totalActivePoints = 0, activeCount = 0, expiredCount = 0;
    let nearestExpReward = null;

    if (!rewards || rewards.length === 0) {
      emptyGainedState.classList.remove('u-hidden');
      totalPointsEl.textContent = '0';
      activeCountEl.textContent = '0 ACTIVE';
      expiredCountEl.textContent = '0 EXPIRED';
      if (gainedBadge) gainedBadge.textContent = '0';
      return { totalActivePoints: 0, nearestExpReward: null };
    }

    emptyGainedState.classList.add('u-hidden');
    if (gainedBadge) gainedBadge.textContent = rewards.length;

    rewards.forEach(r => {
      const pts = Number(r.rewardPoints) || 0;
      const isExp = r.expiryDate ? new Date(r.expiryDate) < now : false;

      if (!isExp && pts > 0) {
        totalActivePoints += pts;
        activeCount++;
        if (r.expiryDate) {
          const expTime = new Date(r.expiryDate).getTime();
          if (!nearestExpReward || expTime < new Date(nearestExpReward.expiryDate).getTime()) {
            nearestExpReward = r;
          }
        }
      } else { expiredCount++; }

      let miniExp = 'No Expiry';
      if (r.expiryDate) {
        const expD = new Date(r.expiryDate);
        const dateStr = expD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        miniExp = isExp ? 'Expired' : `Exp: ${dateStr}`;
      }

      const card = document.createElement('div');
      card.className = `reward-card is-expandable ${isExp ? 'is-expired' : ''}`;
      card.innerHTML = `
        <div class="reward-card-header reward-card-header-btn" role="button" tabindex="0" aria-expanded="false">
          <div class="reward-card-item">
            <div class="thumb-box">${r.productImage ? `<img src="${r.productImage}" alt="" />` : '🎁'}</div>
            <div class="reward-card-info">
              <div class="reward-card-title">${r.productName || 'Order Reward'}</div>
              <div class="reward-card-subrow">
                <span class="reward-pts-grant ${isExp ? 'is-expired-pts' : ''}">+${pts.toLocaleString()} PTS</span>
                <span class="header-pill card-pill-mini ${isExp ? 'pill-expired' : 'pill-active'}">${miniExp}</span>
              </div>
            </div>
            <div class="reward-card-chevron-box"><span class="chevron-icon"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></span></div>
          </div>
        </div>

        <div class="reward-card-drawer">
          <div class="reward-drawer-inner reward-drawer-pad">
            <div class="reward-breakdown-card">
              <div class="breakdown-row"><span class="breakdown-label">Order ID:</span><span class="breakdown-val"><code class="val-order-code">#${r.orderId || 'N/A'}</code></span></div>
              <div class="breakdown-row"><span class="breakdown-label">Order Total:</span><span class="breakdown-val breakdown-bold">₹${Number(r.orderAmount || 0).toLocaleString()}</span></div>
              <div class="breakdown-row"><span class="breakdown-label">Reward Rate:</span><span class="breakdown-val font-brand-blue">${r.rewardPercent || 10}%</span></div>
            </div>
          </div>
        </div>`;

      card.querySelector('.reward-card-header').addEventListener('click', () => toggleCard(card, rewardsListContainer));
      rewardsListContainer.appendChild(card);
    });

    totalPointsEl.textContent = totalActivePoints.toLocaleString();
    activeCountEl.textContent = `${activeCount} ACTIVE`;
    expiredCountEl.textContent = `${expiredCount} EXPIRED`;
    return { totalActivePoints, nearestExpReward };
  }

  // Render 2: Applied Rewards on Products (Separate list screen)
  function renderAppliedRewards(appliedList) {
    appliedRewardsListContainer.innerHTML = '';
    if (!appliedList || appliedList.length === 0) {
      emptyAppliedState.classList.remove('u-hidden');
      if (appliedBadge) appliedBadge.textContent = '0';
      return;
    }

    emptyAppliedState.classList.add('u-hidden');
    if (appliedBadge) appliedBadge.textContent = appliedList.length;

    appliedList.forEach(a => {
      const orderRef = (a.orderId && a.orderId !== 'N/A' && a.orderId.trim()) ? a.orderId : ('ORD-' + (a.id || 101));
      const card = document.createElement('div');
      card.className = 'reward-card is-expandable';
      card.innerHTML = `
        <div class="reward-card-header reward-card-header-btn" role="button" tabindex="0" aria-expanded="false">
          <div class="reward-card-item">
            <div class="thumb-box thumb-box-applied">
              ${a.productImage ? `<img src="${a.productImage}" alt="" />` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`}
            </div>
            <div class="reward-card-info">
              <div class="reward-card-title">${a.productName}</div>
              <div class="reward-card-subrow">
                <span class="card-date-text">${a.date || '2026-11-16'}</span>
                <span class="pill-order-ref">#${orderRef}</span>
              </div>
            </div>
            <div class="reward-card-chevron-box"><span class="chevron-icon"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></span></div>
          </div>
        </div>

        <div class="reward-card-drawer">
          <div class="reward-drawer-inner reward-drawer-pad">
            <div class="reward-breakdown-card">
              <div class="breakdown-row"><span class="breakdown-label">Product Price:</span><span class="breakdown-val breakdown-bold">₹${Number(a.productPrice).toLocaleString()}</span></div>
              <div class="breakdown-row"><span class="breakdown-label">Rewards Applied:</span><span class="breakdown-val font-brand-blue">-${Number(a.pointsApplied).toLocaleString()} PTS</span></div>
              <div class="breakdown-row breakdown-row-due">
                <span class="breakdown-label breakdown-due-label">Due Paid to Shopkeeper:</span>
                <span class="breakdown-val breakdown-due-amount">₹${Number(a.dueAmount).toLocaleString()}</span>
              </div>
              <div class="breakdown-row"><span class="breakdown-label">Order Reference:</span><span class="breakdown-val"><code class="val-order-code">#${orderRef}</code></span></div>
            </div>
          </div>
        </div>`;

      card.querySelector('.reward-card-header').addEventListener('click', () => toggleCard(card, appliedRewardsListContainer));
      appliedRewardsListContainer.appendChild(card);
    });
  }

  // Update Redemption Policy section with Nearest Expiring Points
  function renderRedemptionPolicy(totalActive, nearest) {
    let capPct = 50, maxCap = 10000;
    try {
      const s = localStorage.getItem('rewards_app_admin_settings_v1');
      if (s) {
        const p = JSON.parse(s);
        if (p.cappingPercent) capPct = p.cappingPercent;
        if (p.minOrderAmount) maxCap = p.minOrderAmount;
      }
    } catch(e){}
    let nearestHtml = '<span class="policy-nearest-valid">All points currently valid</span>';
    if (nearest && nearest.expiryDate) {
      const expD = new Date(nearest.expiryDate);
      const dateStr = expD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      nearestHtml = `<strong class="policy-nearest-warning">⚠️ Nearest Expire:</strong> ${Number(nearest.rewardPoints).toLocaleString()} PTS on ${dateStr}`;
    }

    cappingSummaryEl.innerHTML = `
      <div class="glass-policy-header">
        <span class="glass-policy-title">Redemption Policy</span>
      </div>
      <div class="glass-policy-rules policy-rules-row">
        <div class="glass-rule-chip chip-cap"><span class="rule-icon">🛡</span><span>Max <strong>${capPct}%</strong> cap / order</span></div>
        <div class="glass-rule-chip chip-min"><span class="rule-icon">🛒</span><span>Max cap <strong>₹${Number(maxCap).toLocaleString()}</strong></span></div>
      </div>
      <div class="policy-nearest-expire-box">
        ${nearestHtml}
      </div>`;
  }

  // Load All Data
  async function loadWallet() {
    try {
      const rewards = await window.rewardsDB.getRewardsByPhone(currentUser.phone);
      const applied = await window.rewardsDB.getAppliedRewardsByPhone(currentUser.phone);

      const { totalActivePoints, nearestExpReward } = renderGainedRewards(rewards);
      renderAppliedRewards(applied);
      renderRedemptionPolicy(totalActivePoints, nearestExpReward);
    } catch (err) {
      console.error('Wallet load error:', err);
      rewardsListContainer.innerHTML = `<div class="wf-card dashed">Error loading wallet: ${err.message}</div>`;
    }
  }

  await loadWallet();
});
