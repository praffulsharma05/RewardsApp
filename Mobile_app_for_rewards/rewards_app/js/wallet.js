/**
 * wallet.js - Mobile Customer Wallet Controller
 * Name: Rewards Points collection for customers
 */

document.addEventListener('DOMContentLoaded', async () => {
  const customerNameEl = document.getElementById('customerName');
  const customerPhoneEl = document.getElementById('customerPhone');
  const totalPointsEl = document.getElementById('totalPoints');
  const activeCountEl = document.getElementById('activeCount');
  const expiredCountEl = document.getElementById('expiredCount');
  const cappingSummaryEl = document.getElementById('cappingSummary');
  const rewardsListContainer = document.getElementById('rewardsListContainer');
  const btnLogout = document.getElementById('btnLogout');
  const emptyState = document.getElementById('emptyState');

  // Load active customer
  const currentUser = window.rewardsDB.getCurrentUser();
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  customerNameEl.textContent = currentUser.name || 'Valued Customer';
  customerPhoneEl.textContent = `+91 ${currentUser.phone}`;

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.rewardsDB.logoutUser();
      window.location.href = 'login.html';
    });
  }

  // Load and render rewards
  async function loadCustomerWallet() {
    try {
      const rewards = await window.rewardsDB.getRewardsByPhone(currentUser.phone);
      renderRewards(rewards);
    } catch (err) {
      console.error('Error loading wallet rewards:', err);
      rewardsListContainer.innerHTML = `<div class="wf-card dashed">Error loading rewards: ${err.message}</div>`;
    }
  }

  function renderRewards(rewards) {
    rewardsListContainer.innerHTML = '';
    const now = new Date();

    let totalActivePoints = 0;
    let activeRewardsCount = 0;
    let expiredRewardsCount = 0;
    let defaultCappingPercent = 50;
    let defaultMinOrder = 10000;

    if (!rewards || rewards.length === 0) {
      emptyState.style.display = 'block';
      totalPointsEl.textContent = '0';
      activeCountEl.textContent = '0 Active';
      expiredCountEl.textContent = '0 Expired';
      cappingSummaryEl.textContent = 'No rewards allocated yet by Admin.';
      return;
    }

    emptyState.style.display = 'none';

    rewards.forEach((reward) => {
      const isExpired = reward.expiryDate ? new Date(reward.expiryDate) < now : false;

      if (!isExpired) {
        totalActivePoints += Number(reward.rewardPoints) || 0;
        activeRewardsCount++;
        defaultCappingPercent = reward.cappingPercent || defaultCappingPercent;
        defaultMinOrder = reward.minOrderAmount || defaultMinOrder;
      } else {
        expiredRewardsCount++;
      }

      // Format Expiry display
      let expiryDisplay = 'No Expiry';
      let expiryClass = 'active';
      if (reward.expiryDate) {
        const expDate = new Date(reward.expiryDate);
        expiryDisplay = expDate.toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        if (isExpired) {
          expiryClass = 'expired';
          expiryDisplay = `Expired: ${expiryDisplay}`;
        } else {
          expiryDisplay = `Valid Until: ${expiryDisplay}`;
        }
      }

      // Product image thumbnail
      const imgHtml = reward.productImage
        ? `<img src="${reward.productImage}" alt="Product">`
        : `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;

      const card = document.createElement('div');
      card.className = `reward-card ${isExpired ? 'is-expired' : ''}`;
      card.innerHTML = `
        <div class="reward-card-top">
          <div>
            <span class="reward-card-points">+${Number(reward.rewardPoints).toLocaleString()} PTS</span>
            <div class="reward-card-meta">${reward.rewardPercent ? reward.rewardPercent + '% Reward on ' : ''}Order ₹${Number(reward.orderAmount).toLocaleString()}</div>
          </div>
          <span class="header-pill ${isExpired ? 'pill-expired' : 'pill-active'}">
            ${isExpired ? 'EXPIRED' : 'ACTIVE'}
          </span>
        </div>

        <div class="reward-card-item">
          <div class="thumb-box">${imgHtml}</div>
          <div style="font-size: 0.8rem; line-height: 1.4;">
            <strong style="color: var(--slate-900);">${reward.productName || 'Order Item'}</strong>
            <div style="font-size: 0.72rem; color: var(--slate-500);">Order ID: #${reward.orderId || 'N/A'}</div>
            <div style="font-size: 0.72rem; color: var(--slate-500);">Date: ${reward.orderDate || 'N/A'}</div>
          </div>
        </div>

        <div class="policy-strip">
          <div><strong>Capping Rule:</strong> Max ${reward.cappingPercent || 50}% points redeemable per order</div>
          ${reward.minOrderAmount ? `<div><strong>Applicable On:</strong> Orders above ₹${Number(reward.minOrderAmount).toLocaleString()}</div>` : ''}
          <div style="margin-top: 4px; font-weight: 700; color: ${isExpired ? 'var(--slate-400)' : 'var(--emerald-600)'};">
            ${expiryDisplay}
          </div>
        </div>
      `;

      rewardsListContainer.appendChild(card);
    });

    totalPointsEl.textContent = totalActivePoints.toLocaleString();
    activeCountEl.textContent = `${activeRewardsCount} Active`;
    expiredCountEl.textContent = `${expiredRewardsCount} Expired`;

    // Capping summary
    const maxRedeemableSample = Math.floor((totalActivePoints * (defaultCappingPercent / 100)));
    cappingSummaryEl.innerHTML = `
      <strong>Redemption Policy (Admin Setting):</strong><br>
      • Maximum <strong>${defaultCappingPercent}%</strong> points can be used per order.<br>
      • Applicable on product purchases of min <strong>₹${Number(defaultMinOrder).toLocaleString()}</strong>.<br>
      • Available to redeem now: <strong>${maxRedeemableSample.toLocaleString()} Pts</strong>.
    `;
  }

  // Load wallet on init
  await loadCustomerWallet();
});
