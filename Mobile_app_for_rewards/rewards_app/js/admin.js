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

  // Reset Grant Form Functionality
  function resetGrantForm() {
    if (adminForm) {
      adminForm.reset();
    }
    const customerNameInput = document.getElementById('customerName');
    const customerPhoneInput = document.getElementById('customerPhone');
    const orderIdInput = document.getElementById('orderId');
    const productNameInput = document.getElementById('productName');
    if (customerNameInput) customerNameInput.value = '';
    if (customerPhoneInput) customerPhoneInput.value = '';
    if (orderIdInput) orderIdInput.value = '';
    if (productNameInput) productNameInput.value = '';
    if (orderAmountInput) orderAmountInput.value = '';

    if (orderDateInput) {
      orderDateInput.value = new Date().toISOString().split('T')[0];
    }
    base64PhotoData = '';
    if (photoInput) {
      photoInput.value = '';
    }
    if (photoPreview) {
      photoPreview.innerHTML = '<span>NO PHOTO</span>';
    }
    const currentSettings = getAdminSettings();
    applySettingsToUI(currentSettings);
    const pointsGroup = document.getElementById('pointsGivenContainer');
    if (pointsGroup) {
      pointsGroup.style.display = 'none';
    }
    if (rewardPointsInput) {
      rewardPointsInput.value = '';
    }
  }

  // Header Reset / Refresh button
  if (btnAdminRefresh) {
    btnAdminRefresh.addEventListener('click', () => {
      resetGrantForm();
      loadRewardsAndStats();
      showToast('Form reset & database refreshed');
    });
  }

  // Grant card Reset button
  const btnResetForm = document.getElementById('btnResetForm');
  if (btnResetForm) {
    btnResetForm.addEventListener('click', () => {
      resetGrantForm();
      showToast('Form fields cleared');
    });
  }

  // Navigation shortcuts to Settings
  document.querySelectorAll('.btn-nav-settings').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchScreen('screen-settings');
    });
  });

  // Global Settings Storage & State
  const SETTINGS_KEY = 'rewards_app_admin_settings_v1';
  const defaultSettings = {
    rewardPercent: 10,
    expiryMonths: 2,
    cappingPercent: 50,
    minOrderAmount: 10000,
    lockGrantForm: true
  };

  function getAdminSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error reading settings:', e);
    }
    return { ...defaultSettings };
  }

  function saveAdminSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  // Format local datetime string for datetime-local inputs
  function formatLocalDatetime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function calculateExpiryDate(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return formatLocalDatetime(d);
  }

  const cappingPercentInput = document.getElementById('cappingPercent');
  const minOrderAmountInput = document.getElementById('minOrderAmount');
  const expiryDateInput = document.getElementById('expiryDate');
  const adminSettingsForm = document.getElementById('adminSettingsForm');

  // Lock protection state on Grant form - strictly locked to Settings
  function applyGrantFormLockState(settings) {
    if (rewardPercentInput) {
      rewardPercentInput.readOnly = true;
    }
    if (rewardPointsInput) {
      rewardPointsInput.readOnly = true;
    }
    if (expiryDateInput) {
      expiryDateInput.readOnly = true;
    }
    if (cappingPercentInput) {
      cappingPercentInput.readOnly = true;
    }
    if (minOrderAmountInput) {
      minOrderAmountInput.readOnly = true;
    }
  }

  // Apply settings across Settings page and Grant page
  function applySettingsToUI(settings) {
    // 1. Update Settings Form Fields & Badges
    const settingReward = document.getElementById('settingRewardPercent');
    const settingExpiry = document.getElementById('settingExpiryMonths');
    const settingCap = document.getElementById('settingCappingPercent');
    const settingMin = document.getElementById('settingMinOrderAmount');

    const badgeReward = document.getElementById('settingsBadgeReward');
    const badgeExpiry = document.getElementById('settingsBadgeExpiry');
    const badgeCap = document.getElementById('settingsBadgeCapping');

    if (settingReward) settingReward.value = settings.rewardPercent;
    if (settingExpiry) settingExpiry.value = settings.expiryMonths;
    if (settingCap) settingCap.value = settings.cappingPercent;
    if (settingMin) settingMin.value = settings.minOrderAmount;

    if (badgeReward) badgeReward.textContent = `${settings.rewardPercent}%`;
    if (badgeExpiry) badgeExpiry.textContent = `${settings.expiryMonths} Month${settings.expiryMonths > 1 ? 's' : ''}`;
    if (badgeCap) badgeCap.textContent = `${settings.cappingPercent}% / ₹${Number(settings.minOrderAmount).toLocaleString()}`;

    // Update Settings Presets active states
    document.querySelectorAll('#settingsRewardPresets .preset-pill').forEach(p => {
      p.classList.toggle('active', parseFloat(p.dataset.pct) === settings.rewardPercent);
    });
    document.querySelectorAll('#settingsExpiryPresets .preset-pill').forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.months) === settings.expiryMonths);
    });
    document.querySelectorAll('#settingsCappingPresets .preset-pill').forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.cap) === settings.cappingPercent);
    });

    // 2. Update Grant Form Badges
    const pointsGivenRateBadge = document.getElementById('pointsGivenRateBadge');
    if (pointsGivenRateBadge) {
      pointsGivenRateBadge.textContent = `${settings.rewardPercent}% Policy`;
    }

    // 3. Populate Grant Form Fields with Fixed Settings Values
    if (rewardPercentInput) rewardPercentInput.value = settings.rewardPercent;
    if (cappingPercentInput) cappingPercentInput.value = settings.cappingPercent;
    if (minOrderAmountInput) minOrderAmountInput.value = settings.minOrderAmount;

    if (expiryDateInput) {
      expiryDateInput.value = calculateExpiryDate(settings.expiryMonths);
    }
    const grantExpiryMeta = document.getElementById('grantExpiryMeta');
    if (grantExpiryMeta) {
      grantExpiryMeta.textContent = `Auto-set to ${settings.expiryMonths} Month${settings.expiryMonths > 1 ? 's' : ''}`;
    }

    // 4. Update Overview Tab Stat
    const statDefaultCap = document.getElementById('stat-default-cap');
    if (statDefaultCap) statDefaultCap.textContent = `${settings.cappingPercent}%`;

    // 5. Update Lock Protection State
    applyGrantFormLockState(settings);

    // 6. Recalculate Points Given
    updatePointsFromPercent();
  }

  // Compact auto-calculation & dynamic visibility for Points Given
  function updatePointsFromPercent() {
    const amount = parseFloat(orderAmountInput.value) || 0;
    const percent = parseFloat(rewardPercentInput ? rewardPercentInput.value : 10) || 10;
    const pointsGivenContainer = document.getElementById('pointsGivenContainer');

    if (amount > 0 && percent >= 0) {
      const points = Math.round((amount * percent) / 100);
      if (rewardPointsInput) {
        rewardPointsInput.value = points;
      }
      if (pointsGivenContainer) {
        pointsGivenContainer.style.display = 'block';
      }
    } else {
      if (rewardPointsInput) {
        rewardPointsInput.value = '';
      }
      if (pointsGivenContainer) {
        pointsGivenContainer.style.display = 'none';
      }
    }
  }

  function updatePercentFromPoints() {
    const amount = parseFloat(orderAmountInput.value) || 0;
    const points = parseFloat(rewardPointsInput.value) || 0;
    if (amount > 0 && points >= 0) {
      const pct = parseFloat(((points / amount) * 100).toFixed(1));
      rewardPercentInput.value = pct;
    }
  }

  orderAmountInput.addEventListener('input', updatePointsFromPercent);
  rewardPercentInput.addEventListener('input', updatePointsFromPercent);
  rewardPointsInput.addEventListener('input', updatePercentFromPoints);



  // Setup Settings Presets Click Handlers
  document.querySelectorAll('#settingsRewardPresets .preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const pct = parseFloat(pill.dataset.pct);
      const input = document.getElementById('settingRewardPercent');
      if (input) input.value = pct;
      document.querySelectorAll('#settingsRewardPresets .preset-pill').forEach(p => p.classList.toggle('active', p === pill));
    });
  });

  document.querySelectorAll('#settingsExpiryPresets .preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const months = parseInt(pill.dataset.months);
      const input = document.getElementById('settingExpiryMonths');
      if (input) input.value = months;
      document.querySelectorAll('#settingsExpiryPresets .preset-pill').forEach(p => p.classList.toggle('active', p === pill));
    });
  });

  document.querySelectorAll('#settingsCappingPresets .preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const cap = parseInt(pill.dataset.cap);
      const input = document.getElementById('settingCappingPercent');
      if (input) input.value = cap;
      document.querySelectorAll('#settingsCappingPresets .preset-pill').forEach(p => p.classList.toggle('active', p === pill));
    });
  });

  // Settings Form Submit Handler
  if (adminSettingsForm) {
    adminSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newSettings = {
        rewardPercent: parseFloat(document.getElementById('settingRewardPercent').value) || 10,
        expiryMonths: parseInt(document.getElementById('settingExpiryMonths').value) || 2,
        cappingPercent: parseFloat(document.getElementById('settingCappingPercent').value) || 50,
        minOrderAmount: parseFloat(document.getElementById('settingMinOrderAmount').value) || 0
      };

      saveAdminSettings(newSettings);
      applySettingsToUI(newSettings);
      showToast('✅ Global settings saved & applied to Grant form!');

      // Smooth switch back to Grant screen after 600ms
      setTimeout(() => {
        switchScreen('screen-grant');
      }, 600);
    });
  }

  // Initialize Settings & UI
  const initialSettings = getAdminSettings();
  applySettingsToUI(initialSettings);

  // Auto-fill today's date if empty
  const orderDateInput = document.getElementById('orderDate');
  if (orderDateInput && !orderDateInput.value) {
    orderDateInput.value = new Date().toISOString().split('T')[0];
  }

  // Photo Attachment with Canvas Auto-Resizing (Prevents Quota & Payload Limits)
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      base64PhotoData = '';
      photoPreview.innerHTML = '<span>NO PHOTO</span>';
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
        photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Thumb" />`;
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
    if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];

    // Order: ₹15,000
    orderAmountInput.value = '15000';
    const settings = getAdminSettings();
    applySettingsToUI(settings);

    base64PhotoData = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ededed"/><text x="50" y="52" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23444" text-anchor="middle">PRODUCT</text></svg>';
    photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Preview" />`;

    showToast(`Loaded sample ₹15,000 order (${settings.rewardPercent}% / ${settings.expiryMonths}M / ${settings.cappingPercent}% cap)`);
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
    
    // Policy values are strictly and exclusively enforced from Settings
    const settings = getAdminSettings();
    const rewardPercent = settings.rewardPercent;
    const rewardPoints = Math.round((orderAmount * rewardPercent) / 100);
    const expiryDate = expiryDateInput.value || calculateExpiryDate(settings.expiryMonths);
    const cappingPercent = settings.cappingPercent;
    const minOrderAmount = settings.minOrderAmount;

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
      const currentSettings = getAdminSettings();
      applySettingsToUI(currentSettings);
      if (orderDateInput) orderDateInput.value = new Date().toISOString().split('T')[0];
      base64PhotoData = '';
      photoPreview.innerHTML = '<span>NO PHOTO</span>';
      
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

            const points = Number(item.rewardPoints) || 0;
            const capping = Number(item.cappingPercent) || 50;
            const minOrd = Number(item.minOrderAmount) || 10000;
            const ordAmt = Number(item.orderAmount) || 0;
            const maxDisc = Math.floor(points * (capping / 100));
            const safeItemTitle = (item.productName || 'Order Item').replace(/"/g, '&quot;');
            const fallbackAdminSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
            const imgHtml = (item.productImage && item.productImage.trim())
              ? `<img src="${item.productImage}" alt="${safeItemTitle}" onerror="this.onerror=null; this.parentElement.innerHTML='${fallbackAdminSvg.replace(/'/g, "\\'")}';">`
              : fallbackAdminSvg;

            const card = document.createElement('div');
            card.className = `reward-card is-expandable ${isExpired ? 'is-expired' : ''}`;
            card.innerHTML = `
              <div class="reward-card-header" role="button" tabindex="0" aria-expanded="false">
                <div class="reward-card-item">
                  <div class="thumb-box">${imgHtml}</div>
                  <div class="reward-card-info">
                    <div class="reward-card-title">${item.productName}</div>
                  </div>
                  <div class="reward-card-chevron-box">
                    <button type="button" class="btn-delete-reward" data-id="${item.id}" title="Delete Reward" style="background: none; border: none; padding: 2px 4px; cursor: pointer; color: var(--slate-400); display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; margin-right: 4px; transition: color 0.15s ease;" onmouseover="this.style.color='var(--rose-600)'" onmouseout="this.style.color='var(--slate-400)'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    <span class="chevron-icon" aria-hidden="true" title="Click to view details">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Expandable Drawer -->
              <div class="reward-card-drawer">
                <div class="reward-drawer-inner">

                  <div class="drawer-reward-header">
                    <div>
                      <span class="reward-card-points">+${points.toLocaleString()} PTS</span>
                      <div class="reward-card-meta">${item.customerName} (${item.customerPhone})</div>
                    </div>
                    <span class="header-pill ${isExpired ? 'pill-expired' : 'pill-active'}">
                      ${isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </span>
                  </div>

                  <div class="policy-strip" style="margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                      <span>🛡 <strong>Capping Rule:</strong> Max ${capping}% redeemable</span>
                      ${minOrd ? `<span>🛒 <strong>Min Order:</strong> ₹${minOrd.toLocaleString()}</span>` : ''}
                    </div>
                    <div style="margin-top: 2px; font-weight: 700; font-size: 0.68rem; color: ${isExpired ? 'var(--slate-400)' : 'var(--emerald-600)'};">
                      ⏳ Expiry: ${expText}
                    </div>
                  </div>

                  <div class="reward-breakdown-card">
                    <div class="breakdown-row">
                      <span class="breakdown-label">Customer:</span>
                      <span class="breakdown-val">${item.customerName} (+91 ${item.customerPhone})</span>
                    </div>
                    <div class="breakdown-row">
                      <span class="breakdown-label">Order Reference:</span>
                      <span class="breakdown-val"><code>#${item.orderId}</code></span>
                    </div>
                    <div class="breakdown-row">
                      <span class="breakdown-label">Order Total Amount:</span>
                      <span class="breakdown-val">₹${ordAmt.toLocaleString()}</span>
                    </div>
                    <div class="breakdown-row">
                      <span class="breakdown-label">Reward Calculation:</span>
                      <span class="breakdown-val font-brand">${item.rewardPercent || 0}% of ₹${ordAmt.toLocaleString()} = <strong>${points.toLocaleString()} PTS</strong></span>
                    </div>
                    <div class="breakdown-row">
                      <span class="breakdown-label">Max Usable Discount:</span>
                      <span class="breakdown-val font-emerald">Save up to ₹${maxDisc.toLocaleString()} (${capping}% Cap)</span>
                    </div>
                  </div>

                  <div class="reward-drawer-footer">
                    <button type="button" class="btn-collapse-card">
                      <span>Show Less</span>
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `;

            const adminHeader = card.querySelector('.reward-card-header');
            adminHeader.addEventListener('click', (e) => {
              if (e.target.closest('button')) return;
              const isCurrentlyExpanded = card.classList.contains('is-expanded');
              if (isCurrentlyExpanded) {
                card.classList.remove('is-expanded');
                adminHeader.setAttribute('aria-expanded', 'false');
              } else {
                // Auto-collapse any other open cards
                adminRewardsList.querySelectorAll('.reward-card.is-expanded').forEach(other => {
                  if (other !== card) {
                    other.classList.remove('is-expanded');
                    const otherHeader = other.querySelector('.reward-card-header');
                    if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
                  }
                });
                card.classList.add('is-expanded');
                adminHeader.setAttribute('aria-expanded', 'true');
              }
            });

            const btnAdminCollapse = card.querySelector('.btn-collapse-card');
            if (btnAdminCollapse) {
              btnAdminCollapse.addEventListener('click', (e) => {
                e.stopPropagation();
                card.classList.remove('is-expanded');
                adminHeader.setAttribute('aria-expanded', 'false');
              });
            }

            adminRewardsList.appendChild(card);
          });

          // Delete buttons
          document.querySelectorAll('.btn-delete-reward').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (confirm('Delete this reward entry?')) {
                await window.rewardsDB.deleteReward(btn.dataset.id);
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

  await loadRewardsAndStats();
});
