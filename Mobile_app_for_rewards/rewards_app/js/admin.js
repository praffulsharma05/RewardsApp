/**
 * admin.js - Mobile Prototype Device Shell Admin Controller
 * Reference Model: D:\Project Office\wireFram\mobile_app\admin.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  const adminForm = document.getElementById('adminRewardForm');
  const orderAmountInput = document.getElementById('orderAmount');
  const rewardPercentInput = document.getElementById('rewardPercent');
  const rewardPointsInput = document.getElementById('rewardPoints');
  const photoInput = document.getElementById('productPhoto');
  const photoPreview = document.getElementById('photoPreview');
  const btnSampleData = document.getElementById('btnSampleData');
  const adminRewardsList = document.getElementById('adminRewardsList');
  const adminToast = document.getElementById('admin-toast');
  const btnAdminRefresh = document.getElementById('btn-admin-refresh');

  // Stats
  const statIssuedPoints = document.getElementById('stat-issued-points');
  const statRewardsCount = document.getElementById('stat-rewards-count');
  const statUsersCount = document.getElementById('stat-users-count');

  // Screen Tabs
  const navTabItems = document.querySelectorAll('.nav-tab-item[data-screen]');
  const adminScreens = document.querySelectorAll('.admin-screen');

  let base64PhotoData = '';

  function switchScreen(targetScreenId) {
    adminScreens.forEach(screen => {
      screen.classList.toggle('active', screen.id === targetScreenId);
    });
    navTabItems.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.screen === targetScreenId);
    });
    if (targetScreenId === 'screen-issued' || targetScreenId === 'screen-overview') {
      loadRewardsAndStats();
    }
  }

  navTabItems.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchScreen(tab.dataset.screen);
    });
  });

  // Toast message
  function showToast(msg) {
    if (!adminToast) return;
    adminToast.textContent = msg;
    adminToast.style.display = 'block';
    setTimeout(() => {
      adminToast.style.display = 'none';
    }, 4000);
  }

  // Refresh
  if (btnAdminRefresh) {
    btnAdminRefresh.addEventListener('click', () => {
      loadRewardsAndStats();
      showToast('Database refreshed from IndexedDB');
    });
  }

  // Default Reward Percentage Configuration & Persistence
  const DEFAULT_PCT_KEY = 'rewards_app_admin_default_percent';

  function getAdminDefaultPercent() {
    const saved = localStorage.getItem(DEFAULT_PCT_KEY);
    if (saved !== null && !isNaN(parseFloat(saved))) {
      return parseFloat(saved);
    }
    return 10; // User specification: by default set 10%
  }

  function applyAdminDefaultUI(pct) {
    const badge = document.getElementById('badgeDefaultPercent');
    const defaultInput = document.getElementById('adminDefaultSettingInput');
    if (badge) badge.textContent = `Default: ${pct}%`;
    if (defaultInput) defaultInput.value = pct;

    // Update pill text if 10% is default or changed
    document.querySelectorAll('.preset-pill').forEach(pill => {
      const p = parseFloat(pill.dataset.pct);
      if (p === 10) {
        pill.textContent = pct === 10 ? '10% (Default)' : '10%';
      } else if (p === pct) {
        pill.textContent = `${pct}% (Default)`;
      }
    });
  }

  function saveAdminDefaultPercent(val) {
    const num = Math.max(0, Math.min(100, parseFloat(val) || 10));
    localStorage.setItem(DEFAULT_PCT_KEY, num.toString());
    applyAdminDefaultUI(num);
    showToast(`Default reward rate updated to ${num}%`);
  }

  function syncPresetPills(currentPct) {
    document.querySelectorAll('.preset-pill').forEach(pill => {
      const p = parseFloat(pill.dataset.pct);
      pill.classList.toggle('active', p === currentPct);
    });
  }

  // Auto-calculation
  function updatePointsFromPercent() {
    const amount = parseFloat(orderAmountInput.value) || 0;
    const percent = parseFloat(rewardPercentInput.value) || 0;
    syncPresetPills(percent);

    const rewardPointsLabel = document.getElementById('rewardPointsLabel');
    if (amount > 0 && percent >= 0) {
      const points = Math.round((amount * percent) / 100);
      rewardPointsInput.value = points;
      if (rewardPointsLabel) {
        rewardPointsLabel.textContent = `Points Given (${percent}% of ₹${amount.toLocaleString()} = ${points.toLocaleString()}) *`;
      }
    } else if (rewardPointsLabel) {
      rewardPointsLabel.textContent = `Points Given (${percent}% of Order) *`;
    }
  }

  function updatePercentFromPoints() {
    const amount = parseFloat(orderAmountInput.value) || 0;
    const points = parseFloat(rewardPointsInput.value) || 0;
    if (amount > 0 && points >= 0) {
      const pct = parseFloat(((points / amount) * 100).toFixed(1));
      rewardPercentInput.value = pct;
      syncPresetPills(pct);
      const rewardPointsLabel = document.getElementById('rewardPointsLabel');
      if (rewardPointsLabel) {
        rewardPointsLabel.textContent = `Points Given (${pct}% of ₹${amount.toLocaleString()} = ${points.toLocaleString()}) *`;
      }
    }
  }

  orderAmountInput.addEventListener('input', updatePointsFromPercent);
  rewardPercentInput.addEventListener('input', updatePointsFromPercent);
  rewardPointsInput.addEventListener('input', updatePercentFromPoints);

  // Setup Quick Presets Click Handlers ("Set at once")
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const pct = parseFloat(pill.dataset.pct);
      rewardPercentInput.value = pct;
      updatePointsFromPercent();
      syncPresetPills(pct);
    });
  });

  // Setup "★ Set as Default" and "Save" controls
  const btnSetAsDefault = document.getElementById('btnSetAsDefault');
  if (btnSetAsDefault) {
    btnSetAsDefault.addEventListener('click', () => {
      const currentPct = parseFloat(rewardPercentInput.value) || 10;
      saveAdminDefaultPercent(currentPct);
    });
  }

  const btnSaveAdminDefault = document.getElementById('btnSaveAdminDefault');
  const adminDefaultSettingInput = document.getElementById('adminDefaultSettingInput');
  if (btnSaveAdminDefault && adminDefaultSettingInput) {
    btnSaveAdminDefault.addEventListener('click', () => {
      const val = parseFloat(adminDefaultSettingInput.value) || 10;
      saveAdminDefaultPercent(val);
      rewardPercentInput.value = val;
      updatePointsFromPercent();
      syncPresetPills(val);
    });
  }

  // Initialize Default Reward %
  const initialDefaultPct = getAdminDefaultPercent();
  applyAdminDefaultUI(initialDefaultPct);
  rewardPercentInput.value = initialDefaultPct;
  syncPresetPills(initialDefaultPct);
  updatePointsFromPercent();

  // Photo Attachment with Canvas Auto-Resizing (Prevents Quota & Payload Limits)
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      base64PhotoData = '';
      photoPreview.innerHTML = '<span>NO PHOTO ATTACHED</span>';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 320x320 thumbnail for ultra-fast storage
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compact JPEG data URL (~20KB)
        base64PhotoData = canvas.toDataURL('image/jpeg', 0.82);
        photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Product Preview" />`;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Autofill sample data from prompt
  btnSampleData.addEventListener('click', () => {
    document.getElementById('customerName').value = 'Rahul Sharma';
    document.getElementById('customerPhone').value = '9876543210';
    document.getElementById('orderId').value = 'ORD-' + Math.floor(10000 + Math.random() * 90000);
    document.getElementById('productName').value = 'Android 5G Smartphone';
    document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];

    // Order: ₹15,000, 10% = 1,500 pts
    orderAmountInput.value = '15000';
    rewardPercentInput.value = '10';
    rewardPointsInput.value = '1500';
    syncPresetPills(10);
    updatePointsFromPercent();

    // Expiry: Default 2 months (60 days)
    setExpiryMonths(2);

    // Capping: 50% on ₹10,000
    document.getElementById('cappingPercent').value = '50';
    document.getElementById('minOrderAmount').value = '10000';

    base64PhotoData = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ededed"/><text x="50" y="52" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23444" text-anchor="middle">PRODUCT</text></svg>';
    photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Preview" />`;

    showToast('Loaded sample: ₹15,000 order -> 10% (1,500 pts), 50% capping on ₹10k product.');
  });

  // Submit Handler: Saves to IndexedDB
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const customerName = document.getElementById('customerName').value.trim();
    const rawPhone = document.getElementById('customerPhone').value.trim();
    const customerPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const orderId = document.getElementById('orderId').value.trim();
    const productName = document.getElementById('productName').value.trim();
    const orderDate = document.getElementById('orderDate').value;
    const orderAmount = parseFloat(orderAmountInput.value) || 0;
    const rewardPercent = parseFloat(rewardPercentInput.value) || 0;
    const rewardPoints = parseFloat(rewardPointsInput.value) || 0;
    const expiryDate = document.getElementById('expiryDate').value;
    const cappingPercent = parseFloat(document.getElementById('cappingPercent').value) || 50;
    const minOrderAmount = parseFloat(document.getElementById('minOrderAmount').value) || 0;

    if (!customerName || !customerPhone || !orderId || !productName || !orderAmount || !rewardPoints || !expiryDate) {
      showToast('Please fill all required fields');
      return;
    }

    const submitBtn = adminForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving to Database...';
    }

    try {
      const payload = {
        customerName,
        customerPhone,
        orderId,
        productName,
        orderDate: orderDate || new Date().toISOString().split('T')[0],
        orderAmount,
        rewardPercent,
        rewardPoints,
        expiryDate,
        cappingPercent,
        minOrderAmount,
        productImage: base64PhotoData,
        status: 'ACTIVE'
      };

      await window.rewardsDB.createReward(payload);
      showToast(`✅ Saved! Granted ${rewardPoints.toLocaleString()} pts to ${customerName}`);

      adminForm.reset();
      const currentDefaultPct = getAdminDefaultPercent();
      rewardPercentInput.value = currentDefaultPct;
      syncPresetPills(currentDefaultPct);
      updatePointsFromPercent();
      base64PhotoData = '';
      photoPreview.innerHTML = '<span>NO PHOTO ATTACHED</span>';
      setDefaultExpiry(true);
      
      await loadRewardsAndStats();
      
      // Auto-switch to Issued feed after 800ms so admin sees the new card immediately
      setTimeout(() => {
        switchScreen('screen-issued');
      }, 800);
    } catch (err) {
      console.error('Save reward error:', err);
      showToast('Error: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save & Issue Reward Points';
      }
    }
  });

  // Render Issued Rewards & Stats
  async function loadRewardsAndStats() {
    try {
      const rewards = await window.rewardsDB.getAllRewards();
      const users = await window.rewardsDB.getAllUsers();

      let totalPoints = 0;
      if (statRewardsCount) statRewardsCount.textContent = rewards.length;
      if (statUsersCount) statUsersCount.textContent = users.length;

      if (adminRewardsList) {
        adminRewardsList.innerHTML = '';
        if (rewards.length === 0) {
          adminRewardsList.innerHTML = `
            <div class="wf-card dashed" style="text-align: center; padding: 20px;">
              <strong class="wf-title-sm">No Rewards Issued Yet</strong>
              <p class="wf-meta" style="margin-top: 4px;">Use the 'Grant' tab to allocate rewards points.</p>
            </div>
          `;
        } else {
          rewards.forEach(item => {
            totalPoints += Number(item.rewardPoints) || 0;
            const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();
            const expText = item.expiryDate ? item.expiryDate.replace('T', ' ') : 'N/A';

            const card = document.createElement('div');
            card.className = `reward-card ${isExpired ? 'is-expired' : ''}`;
            card.innerHTML = `
              <div class="reward-card-top">
                <div>
                  <span class="reward-card-points">+${Number(item.rewardPoints).toLocaleString()} PTS</span>
                  <div class="wf-meta">${item.customerName} (${item.customerPhone})</div>
                </div>
                <span class="header-pill" style="${isExpired ? 'background: #fff; color: #000; border-style: dashed;' : ''}">
                  ${isExpired ? 'EXPIRED' : 'ACTIVE'}
                </span>
              </div>

              <div class="reward-card-item">
                <div class="thumb-box">
                  ${item.productImage ? `<img src="${item.productImage}" alt="Product" />` : '<span>PHOTO</span>'}
                </div>
                <div style="font-size: 0.78rem; line-height: 1.35;">
                  <strong>${item.productName}</strong>
                  <div class="wf-meta">Order #${item.orderId} | ₹${Number(item.orderAmount).toLocaleString()}</div>
                  <div class="wf-meta">Date: ${item.orderDate || 'N/A'}</div>
                </div>
              </div>

              <div class="policy-strip">
                <div><strong>Capping Rule:</strong> Max ${item.cappingPercent || 50}% points redeemable</div>
                ${item.minOrderAmount ? `<div><strong>Min Order:</strong> Valid on orders above ₹${Number(item.minOrderAmount).toLocaleString()}</div>` : ''}
                <div style="margin-top: 3px; font-weight: 700;">Expiry: ${expText}</div>
              </div>

              <div style="margin-top: 8px; text-align: right;">
                <button type="button" class="wf-btn wf-btn-secondary wf-btn-sm btn-delete-reward" data-id="${item.id}">
                  Delete
                </button>
              </div>
            `;
            adminRewardsList.appendChild(card);
          });

          // Delete buttons
          document.querySelectorAll('.btn-delete-reward').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              if (confirm('Delete this reward entry?')) {
                await window.rewardsDB.deleteReward(e.target.dataset.id);
                showToast('Reward record deleted');
                await loadRewardsAndStats();
              }
            });
          });
        }
      }

      if (statIssuedPoints) statIssuedPoints.textContent = totalPoints.toLocaleString();
    } catch (err) {
      console.error('Error loading rewards & stats:', err);
    }
  }

  // Local datetime formatter for datetime-local input
  function formatLocalDatetime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  // Set expiry date to N months in future (default: 2 months)
  function setExpiryMonths(months = 2) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const expInput = document.getElementById('expiryDate');
    if (expInput) {
      expInput.value = formatLocalDatetime(d);
    }
    // Update active state on expiry preset pills
    document.querySelectorAll('#expiryPresetGroup .preset-pill').forEach(pill => {
      const pMonths = parseInt(pill.dataset.months);
      pill.classList.toggle('active', pMonths === months);
    });
  }

  function setDefaultExpiry(force = false) {
    const expInput = document.getElementById('expiryDate');
    if (expInput && (!expInput.value || force)) {
      setExpiryMonths(2); // By default set 2 months
    }
  }

  // Setup Expiry Preset Pills Click Handlers
  document.querySelectorAll('#expiryPresetGroup .preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const months = parseInt(pill.dataset.months) || 2;
      setExpiryMonths(months);
    });
  });

  setDefaultExpiry(true);
  await loadRewardsAndStats();
});
