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

  // Helper function to toggle card expansion (accordion behavior: only one open at a time)
  function toggleCard(card) {
    const isExpanded = card.classList.contains('is-expanded');
    if (isExpanded) {
      collapseCard(card);
    } else {
      // Auto-collapse any other card that is currently open
      const otherExpandedCards = rewardsListContainer.querySelectorAll('.reward-card.is-expanded');
      otherExpandedCards.forEach(otherCard => {
        if (otherCard !== card) {
          collapseCard(otherCard);
        }
      });
      // Expand the clicked card
      card.classList.add('is-expanded');
      const header = card.querySelector('.reward-card-header');
      if (header) header.setAttribute('aria-expanded', 'true');
    }
  }

  function collapseCard(card) {
    card.classList.remove('is-expanded');
    const header = card.querySelector('.reward-card-header');
    if (header) header.setAttribute('aria-expanded', 'false');
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

    rewards.forEach((reward, index) => {
      const isExpired = reward.expiryDate ? new Date(reward.expiryDate) < now : false;
      const points = Number(reward.rewardPoints) || 0;
      const cappingPercent = Number(reward.cappingPercent) || 50;
      const minOrder = Number(reward.minOrderAmount) || 10000;
      const orderAmount = Number(reward.orderAmount) || 0;
      const maxDiscountValue = Math.floor(points * (cappingPercent / 100));

      if (!isExpired) {
        totalActivePoints += points;
        activeRewardsCount++;
        defaultCappingPercent = cappingPercent;
        defaultMinOrder = minOrder;
      } else {
        expiredRewardsCount++;
      }

      // Format Expiry display and relative text
      let expiryDisplay = 'No Expiry Set';
      let miniExpiryText = 'No Expiry';
      if (reward.expiryDate) {
        const expDate = new Date(reward.expiryDate);
        const formattedDate = expDate.toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        if (isExpired) {
          expiryDisplay = `Expired: ${formattedDate}`;
          miniExpiryText = 'Expired';
        } else {
          const diffMs = expDate - now;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          miniExpiryText = diffDays > 1 ? `${diffDays}d left` : (diffDays === 1 ? '1d left' : 'Today');
          expiryDisplay = `Valid Until: ${formattedDate} (${miniExpiryText})`;
        }
      }

      // Product image thumbnail with robust fallback
      const safeTitle = (reward.productName || 'Order Item').replace(/"/g, '&quot;');
      const fallbackSvg = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
      const imgHtml = (reward.productImage && reward.productImage.trim())
        ? `<img src="${reward.productImage}" alt="${safeTitle}" onerror="this.onerror=null; this.parentElement.innerHTML='${fallbackSvg.replace(/'/g, "\\'")}';">`
        : fallbackSvg;

      const card = document.createElement('div');
      card.className = `reward-card is-expandable ${isExpired ? 'is-expired' : ''}`;
      card.setAttribute('data-reward-id', reward.id || index);

      card.innerHTML = `
        <!-- Collapsed List View: Product info and '>' indicator -->
        <div class="reward-card-header" role="button" tabindex="0" aria-expanded="false" aria-label="Toggle reward details for ${safeTitle}">
          <div class="reward-card-item">
            <div class="thumb-box">${imgHtml}</div>
            <div class="reward-card-info">
              <div class="reward-card-title">${reward.productName || 'Order Item'}</div>
            </div>
            <div class="reward-card-chevron-box">
              <span class="chevron-icon" aria-hidden="true" title="Click to view details">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </div>
          </div>
        </div>

        <!-- Smooth Expandable Drawer: Shows full reward details, points, capping, and breakdown -->
        <div class="reward-card-drawer">
          <div class="reward-drawer-inner">

            <!-- Reward Points & Status (Shown inside expanded view) -->
            <div class="drawer-reward-header">
              <div>
                <span class="reward-card-points">+${points.toLocaleString()} PTS</span>
                <div class="reward-card-meta">${reward.rewardPercent ? reward.rewardPercent + '% Reward on ' : ''}Order ₹${orderAmount.toLocaleString()}</div>
              </div>
              <span class="header-pill ${isExpired ? 'pill-expired' : 'pill-active'}">
                ${isExpired ? 'EXPIRED' : 'ACTIVE'}
              </span>
            </div>

            <!-- Capping & Expiry Policy Strip -->
            <div class="policy-strip" style="margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                <span>🛡 <strong>Capping Rule:</strong> Max ${cappingPercent}% redeemable</span>
                ${minOrder ? `<span>🛒 <strong>Min Order:</strong> ₹${minOrder.toLocaleString()}</span>` : ''}
              </div>
              <div style="margin-top: 3px; font-weight: 700; font-size: 0.69rem; color: ${isExpired ? 'var(--slate-400)' : 'var(--emerald-600)'};">
                ⏳ ${expiryDisplay}
              </div>
            </div>

            <!-- Order & Points Breakdown Card -->
            <div class="reward-breakdown-card">
              <div class="breakdown-row">
                <span class="breakdown-label">Order Reference:</span>
                <span class="breakdown-val">
                  <code>#${reward.orderId || 'N/A'}</code>
                  <button type="button" class="btn-copy-order" data-order="${reward.orderId || ''}" title="Copy Order ID">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span class="copy-text">Copy</span>
                  </button>
                </span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Order Date:</span>
                <span class="breakdown-val">${reward.orderDate || 'N/A'}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Order Total Amount:</span>
                <span class="breakdown-val">₹${orderAmount.toLocaleString()}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Reward Calculation:</span>
                <span class="breakdown-val font-brand">${reward.rewardPercent || 0}% of ₹${orderAmount.toLocaleString()} = <strong>${points.toLocaleString()} PTS</strong></span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Max Usable Discount:</span>
                <span class="breakdown-val font-emerald">Save up to ₹${maxDiscountValue.toLocaleString()} (${cappingPercent}% Cap)</span>
              </div>
            </div>

            <!-- Drawer Footer Collapse Helper -->
            <div class="reward-drawer-footer">
              <button type="button" class="btn-collapse-card">
                <span>Show Less</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
            </div>

          </div>
        </div>
      `;

      // Wire up card toggle interactions
      const cardHeader = card.querySelector('.reward-card-header');
      cardHeader.addEventListener('click', (e) => {
        // Prevent toggle if clicking interactive elements inside header
        if (e.target.closest('button') || e.target.closest('a')) return;
        toggleCard(card);
      });

      cardHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCard(card);
        }
      });

      // Wire up Show Less button
      const btnCollapse = card.querySelector('.btn-collapse-card');
      if (btnCollapse) {
        btnCollapse.addEventListener('click', (e) => {
          e.stopPropagation();
          collapseCard(card);
        });
      }

      // Wire up Copy Order ID button
      const btnCopy = card.querySelector('.btn-copy-order');
      if (btnCopy) {
        btnCopy.addEventListener('click', (e) => {
          e.stopPropagation();
          const orderId = btnCopy.getAttribute('data-order');
          if (orderId && navigator.clipboard) {
            navigator.clipboard.writeText(orderId).then(() => {
              const textSpan = btnCopy.querySelector('.copy-text');
              if (textSpan) {
                const orig = textSpan.textContent;
                textSpan.textContent = 'Copied!';
                btnCopy.classList.add('copied');
                setTimeout(() => {
                  textSpan.textContent = orig;
                  btnCopy.classList.remove('copied');
                }, 1600);
              }
            }).catch(() => {
              // Fallback
              const textSpan = btnCopy.querySelector('.copy-text');
              if (textSpan) textSpan.textContent = 'Copied!';
            });
          }
        });
      }

      rewardsListContainer.appendChild(card);
    });

    totalPointsEl.textContent = totalActivePoints.toLocaleString();
    activeCountEl.textContent = `${activeRewardsCount} Active`;
    expiredCountEl.textContent = `${expiredRewardsCount} Expired`;

    // Optimized Glass Capping & Redemption Summary
    const maxRedeemableSample = Math.floor((totalActivePoints * (defaultCappingPercent / 100)));
    cappingSummaryEl.innerHTML = `
      <div class="glass-policy-header">
        <span class="glass-policy-title">Redemption Policy</span>
        <span class="glass-redeem-pill">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>
          ${maxRedeemableSample.toLocaleString()} Pts Usable Now
        </span>
      </div>
      <div class="glass-policy-rules">
        <div class="glass-rule-chip">
          <span class="rule-icon">🛡</span>
          <span>Max <strong>${defaultCappingPercent}%</strong> cap / order</span>
        </div>
        <div class="glass-rule-chip">
          <span class="rule-icon">🛒</span>
          <span>Min order <strong>₹${Number(defaultMinOrder).toLocaleString()}</strong></span>
        </div>
      </div>
    `;
  }

  // Load wallet on init
  await loadCustomerWallet();
});
