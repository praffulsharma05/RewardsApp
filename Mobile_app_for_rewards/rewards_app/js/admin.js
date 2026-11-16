/**
 * admin.js - Admin Panel Core Controller
 * Handles Grant Form, Settings, Feed & Navigation | STRICT: <= 300 lines
 */
document.addEventListener('DOMContentLoaded', async () => {
  const adminForm = document.getElementById('adminRewardForm'), orderAmountInput = document.getElementById('orderAmount');
  const rewardPercentInput = document.getElementById('rewardPercent'), rewardPointsInput = document.getElementById('rewardPoints');
  const photoInput = document.getElementById('productPhoto'), photoPreview = document.getElementById('photoPreview');
  const btnSampleData = document.getElementById('btnSampleData'), adminRewardsList = document.getElementById('adminRewardsList');
  const adminToast = document.getElementById('admin-toast'), btnAdminRefresh = document.getElementById('btn-admin-refresh'), btnResetForm = document.getElementById('btnResetForm');
  const statIssuedPoints = document.getElementById('stat-issued-points'), statRewardsCount = document.getElementById('stat-rewards-count');
  const statUsersCount = document.getElementById('stat-users-count'), statAppliedCount = document.getElementById('stat-applied-count');

  const navTabItems = document.querySelectorAll('.nav-tab-item[data-screen]');
  const adminScreens = document.querySelectorAll('.admin-screen');
  let base64PhotoData = '', activeFeedTab = 'all';

  window.switchAdminScreen = function(targetId) {
    adminScreens.forEach(s => s.classList.toggle('active', s.id === targetId));
    navTabItems.forEach(t => t.classList.toggle('active', t.dataset.screen === targetId));
    if (targetId === 'screen-issued' || targetId === 'screen-overview') loadRewardsAndStats();
    if (targetId === 'screen-apply' && window.initApplyRewardsScreen) window.initApplyRewardsScreen();
  };

  navTabItems.forEach(tab => tab.addEventListener('click', (e) => {
    e.preventDefault();
    window.switchAdminScreen(tab.dataset.screen);
  }));

  window.showAdminToast = function(msg) {
    if (!adminToast) return;
    adminToast.textContent = msg;
    adminToast.style.display = 'block';
    setTimeout(() => { adminToast.style.display = 'none'; }, 3500);
  };

  const SETTINGS_KEY = 'rewards_app_admin_settings_v1';
  const defaultSettings = { rewardPercent: 10, expiryMonths: 2, cappingPercent: 50, minOrderAmount: 10000 };

  window.getAdminSettings = function() {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) return { ...defaultSettings, ...JSON.parse(s) };
    } catch (e) {}
    return { ...defaultSettings };
  };

  function saveAdminSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  function calculateExpiryDate(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function applySettingsToUI(s) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('settingRewardPercent', s.rewardPercent); setVal('settingExpiryMonths', s.expiryMonths);
    setVal('settingCappingPercent', s.cappingPercent); setVal('settingMinOrderAmount', s.minOrderAmount);
    setText('settingsBadgeReward', `${s.rewardPercent}%`); setText('settingsBadgeExpiry', `${s.expiryMonths}M`);
    setText('settingsBadgeCapping', `${s.cappingPercent}% / ₹${s.minOrderAmount}`);
    setText('pointsGivenRateBadge', `${s.rewardPercent}% Policy`);
    if (rewardPercentInput) rewardPercentInput.value = s.rewardPercent;
    setVal('expiryDate', calculateExpiryDate(s.expiryMonths)); setVal('cappingPercent', s.cappingPercent);
    setVal('minOrderAmount', s.minOrderAmount); setVal('applyCappingPercent', s.cappingPercent);
    setVal('applyMaxCappingLimit', s.minOrderAmount);
    if (window.recalculateApplyMath) window.recalculateApplyMath();
    updatePointsFromPercent();
  }

  function updatePointsFromPercent() {
    const amount = parseFloat(orderAmountInput.value) || 0;
    const pct = parseFloat(rewardPercentInput ? rewardPercentInput.value : 10) || 10;
    const box = document.getElementById('pointsGivenContainer');
    const badge = document.getElementById('pointsGivenRateBadge');
    if (badge) badge.textContent = `${pct}% Policy`;
    if (amount > 0 && pct >= 0) {
      if (rewardPointsInput) rewardPointsInput.value = Math.round((amount * pct) / 100);
      if (box) box.style.display = 'block';
    } else {
      if (rewardPointsInput) rewardPointsInput.value = '';
      if (box) box.style.display = 'none';
    }
  }

  if (orderAmountInput) orderAmountInput.addEventListener('input', updatePointsFromPercent);
  if (rewardPercentInput) rewardPercentInput.addEventListener('input', updatePointsFromPercent);

  // Settings form submit
  const adminSettingsForm = document.getElementById('adminSettingsForm');
  if (adminSettingsForm) {
    adminSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const getNum = (id, def) => parseFloat(document.getElementById(id).value) || def;
      const newSettings = {
        rewardPercent: getNum('settingRewardPercent', 10),
        expiryMonths: getNum('settingExpiryMonths', 2),
        cappingPercent: getNum('settingCappingPercent', 50),
        minOrderAmount: getNum('settingMinOrderAmount', 0)
      };
      saveAdminSettings(newSettings);
      applySettingsToUI(newSettings);
      window.showAdminToast('✅ Settings updated & applied!');
      setTimeout(() => window.switchAdminScreen('screen-grant'), 600);
    });
  }

  // Explicit Reset for Grant Form
  window.resetGrantForm = function() {
    if (adminForm) adminForm.reset();
    ['customerName', 'customerPhone', 'orderId', 'productName', 'orderAmount', 'rewardPoints'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const dateIn = document.getElementById('orderDate');
    if (dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    base64PhotoData = '';
    if (photoInput) photoInput.value = '';
    if (photoPreview) photoPreview.innerHTML = '<span>NO PHOTO</span>';
    const ptsBox = document.getElementById('pointsGivenContainer');
    if (ptsBox) ptsBox.style.display = 'none';
    applySettingsToUI(window.getAdminSettings());
  };

  if (btnAdminRefresh) {
    btnAdminRefresh.addEventListener('click', async () => {
      window.resetGrantForm();
      if (window.resetApplyForm) window.resetApplyForm();
      await loadRewardsAndStats();
      window.showAdminToast('Forms cleared & DB refreshed');
    });
  }

  if (btnResetForm) {
    btnResetForm.addEventListener('click', () => {
      window.resetGrantForm();
      window.showAdminToast('Form fields cleared');
    });
  }

  if (btnSampleData) {
    btnSampleData.addEventListener('click', () => {
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('customerName', 'Rahul Sharma'); setVal('customerPhone', '9876543210');
      setVal('orderId', 'ORD-' + Math.floor(10000 + Math.random() * 90000));
      setVal('productName', 'Android 5G Smartphone'); setVal('orderAmount', '15000');
      setVal('orderDate', new Date().toISOString().split('T')[0]);
      updatePointsFromPercent();
      window.showAdminToast('Loaded sample ₹15,000 order');
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) { base64PhotoData = ''; photoPreview.innerHTML = '<span>NO PHOTO</span>'; return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 120; canvas.height = 120;
          canvas.getContext('2d').drawImage(img, 0, 0, 120, 120);
          base64PhotoData = canvas.toDataURL('image/jpeg', 0.8);
          photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Thumb" />`;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Grant Form Submit
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const getVal = (id) => (document.getElementById(id)?.value || '').trim();
      const customerName = getVal('customerName'), customerPhone = getVal('customerPhone');
      const orderId = getVal('orderId'), productName = getVal('productName'), orderDate = getVal('orderDate');
      const orderAmount = parseFloat(orderAmountInput.value) || 0;
      const settings = window.getAdminSettings();
      const rewardPoints = Math.round((orderAmount * settings.rewardPercent) / 100);
      const expiryDate = calculateExpiryDate(settings.expiryMonths);

      if (!customerName || !customerPhone || !orderAmount) return window.showAdminToast('Please fill all fields');
      try {
        await window.rewardsDB.createReward({
          customerName, customerPhone, orderId, productName, orderDate, orderAmount,
          rewardPercent: settings.rewardPercent, rewardPoints, expiryDate,
          cappingPercent: settings.cappingPercent, minOrderAmount: settings.minOrderAmount,
          productImage: base64PhotoData, status: 'ACTIVE'
        });
        window.showAdminToast(`✅ Granted ${rewardPoints} PTS to ${customerName}`);
        window.resetGrantForm();
        await loadRewardsAndStats();
        setTimeout(() => window.switchAdminScreen('screen-issued'), 700);
      } catch (err) { window.showAdminToast('Error: ' + err.message); }
    });
  }

  // Feed Filter buttons
  const btnFeedAll = document.getElementById('btnFeedAll'), btnFeedApplied = document.getElementById('btnFeedApplied');
  function setFeedTab(tab) {
    activeFeedTab = tab;
    if (btnFeedAll) btnFeedAll.className = `wf-btn wf-btn-sm ${tab === 'all' ? '' : 'wf-btn-secondary'}`;
    if (btnFeedApplied) btnFeedApplied.className = `wf-btn wf-btn-sm ${tab === 'applied' ? '' : 'wf-btn-secondary'}`;
    loadRewardsAndStats();
  }
  if (btnFeedAll) btnFeedAll.addEventListener('click', () => setFeedTab('all'));
  if (btnFeedApplied) btnFeedApplied.addEventListener('click', () => setFeedTab('applied'));

  window.loadRewardsAndStats = async function() {
    try {
      const rewards = await window.rewardsDB.getAllRewards();
      const users = await window.rewardsDB.getAllUsers();
      const applied = await window.rewardsDB.getAllAppliedRewards();

      let totalPoints = 0;
      rewards.forEach(r => totalPoints += Number(r.rewardPoints) || 0);

      if (statIssuedPoints) statIssuedPoints.textContent = totalPoints.toLocaleString();
      if (statRewardsCount) statRewardsCount.textContent = rewards.length;
      if (statUsersCount) statUsersCount.textContent = users.length;
      if (statAppliedCount) statAppliedCount.textContent = applied.length;

      if (!adminRewardsList) return;
      adminRewardsList.innerHTML = '';

      if (activeFeedTab === 'applied') {
        if (applied.length === 0) {
          adminRewardsList.innerHTML = '<div class="wf-card dashed" style="text-align:center; padding:16px;">No applied rewards yet.</div>';
          return;
        }
        applied.forEach(item => {
          const ord = (item.orderId && item.orderId !== 'N/A' && item.orderId.trim()) ? item.orderId : ('ORD-' + (item.id || 101));
          const card = document.createElement('div');
          card.className = 'reward-card';
          card.innerHTML = `
            <div class="admin-applied-card-body">
              <div class="admin-applied-header">
                <strong class="reward-card-title">${item.productName}</strong>
                <span class="header-pill pill-applied-pts">-${item.pointsApplied.toLocaleString()} PTS</span>
              </div>
              <div class="wf-meta">${item.customerName} (+91 ${item.customerPhone}) • ${item.date}</div>
              <div class="admin-applied-grid">
                <div>Order: <strong class="pill-order-ref">#${ord}</strong></div>
                <div>Orig Price: <strong>₹${Number(item.productPrice).toLocaleString()}</strong></div>
                <div>Cap: <strong>${item.cappingPercent}%</strong></div>
                <div>Due Paid: <strong class="val-due-paid">₹${Number(item.dueAmount).toLocaleString()}</strong></div>
              </div>
            </div>`;
          adminRewardsList.appendChild(card);
        });
        return;
      }

      if (rewards.length === 0) {
        adminRewardsList.innerHTML = '<div class="wf-card dashed" style="text-align:center; padding:16px;">No rewards granted yet.</div>';
        return;
      }

      rewards.forEach(item => {
        const isExp = item.expiryDate && new Date(item.expiryDate) < new Date();
        const card = document.createElement('div');
        card.className = `reward-card ${isExp ? 'is-expired' : ''}`;
        card.innerHTML = `
          <div class="admin-reward-card-body">
            <div>
              <strong class="reward-card-title">${item.productName}</strong>
              <div class="wf-meta">${item.customerName} • +${Number(item.rewardPoints).toLocaleString()} PTS</div>
              <small class="wf-meta">Exp: ${item.expiryDate ? item.expiryDate.split('T')[0] : 'N/A'}</small>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="header-pill card-pill-mini ${isExp ? 'pill-expired' : 'pill-active'}">${isExp ? 'EXPIRED' : 'ACTIVE'}</span>
              <button type="button" class="btn-del-reward" title="Delete Reward" data-id="${item.id}">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>`;
        card.querySelector('.btn-del-reward').addEventListener('click', (ev) => {
          ev.stopPropagation();
          openDeleteConfirm(item.id, item.productName || item.customerName, item.rewardPoints);
        });
        adminRewardsList.appendChild(card);
      });
    } catch (e) { console.error(e); }
  };

  // Delete Confirmation Modal Logic
  let pendingDeleteId = null;
  const delModal = document.getElementById('confirmDeleteModal');
  const btnCancelDel = document.getElementById('btnCancelDelete');
  const btnConfirmDel = document.getElementById('btnConfirmDelete');
  const delMsg = document.getElementById('confirmDeleteModalMsg');

  function openDeleteConfirm(id, name, pts) {
    pendingDeleteId = id;
    if (delMsg) delMsg.textContent = `Are you sure you want to delete reward for "${name}" (+${Number(pts || 0).toLocaleString()} PTS)?`;
    if (delModal) delModal.style.display = 'flex';
  }
  function closeDeleteConfirm() {
    pendingDeleteId = null;
    if (delModal) delModal.style.display = 'none';
  }
  if (btnCancelDel) btnCancelDel.addEventListener('click', closeDeleteConfirm);
  if (btnConfirmDel) {
    btnConfirmDel.addEventListener('click', async () => {
      if (pendingDeleteId) {
        await window.rewardsDB.deleteReward(pendingDeleteId);
        window.showAdminToast('Reward deleted successfully');
        closeDeleteConfirm();
        loadRewardsAndStats();
      }
    });
  }

  // Init
  applySettingsToUI(window.getAdminSettings());
  const dateIn = document.getElementById('orderDate');
  if (dateIn && !dateIn.value) dateIn.value = new Date().toISOString().split('T')[0];
  await loadRewardsAndStats();
});
