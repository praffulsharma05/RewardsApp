/**
 * admin_apply.js - Apply Rewards on Product Controller
 * Automatic Capping Calculation & Due Amount | STRICT: <= 300 lines
 */
document.addEventListener('DOMContentLoaded', () => {
  const customerSelect = document.getElementById('applyCustomerSelect');
  const orderIdInput = document.getElementById('applyOrderId');
  const productNameInput = document.getElementById('applyProductName');
  const productPriceInput = document.getElementById('applyProductPrice');
  const summaryPrice = document.getElementById('applySummaryPrice');
  const summaryPointsApplied = document.getElementById('applySummaryPointsApplied');
  const dueAmountDisplay = document.getElementById('applyDueAmountDisplay');
  const applyPhotoInput = document.getElementById('applyProductPhoto');
  const applyPhotoPreview = document.getElementById('applyPhotoPreview');
  const btnSample = document.getElementById('btnSampleApplyData');
  const btnResetApply = document.getElementById('btnResetApplyForm');
  const form = document.getElementById('adminApplyRewardForm');

  let currentCustomer = null;
  let availablePoints = 0;
  let activeCappingPercent = 50;
  let activeMaxCappingLimit = 10000;
  let autoCalculatedPoints = 0;
  let autoCalculatedDue = 0;
  let applyPhotoData = '';

  // Initialize and populate customer dropdown
  window.initApplyRewardsScreen = async function() {
    if (!customerSelect) return;
    try {
      const users = await window.rewardsDB.getAllUsers();
      customerSelect.innerHTML = '';
      if (users.length === 0) {
        customerSelect.innerHTML = '<option value="">No customers registered</option>';
        return;
      }

      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.phone;
        opt.textContent = `${u.name} (+91 ${u.phone})`;
        customerSelect.appendChild(opt);
      });

      const rahul = users.find(u => u.phone === '9876543210') || users[0];
      customerSelect.value = rahul.phone;
      await onCustomerChanged();
    } catch (e) {
      console.error('Error init apply rewards:', e);
    }
  };

  function getCurrentCapping() {
    const s = window.getAdminSettings ? window.getAdminSettings() : { cappingPercent: 50, minOrderAmount: 10000 };
    return {
      cappingPercent: Number(s.cappingPercent) || 50,
      maxCappingLimit: Number(s.minOrderAmount) || 10000
    };
  }

  async function onCustomerChanged() {
    const phone = customerSelect.value;
    if (!phone) return;
    const users = await window.rewardsDB.getAllUsers();
    currentCustomer = users.find(u => u.phone === phone) || { name: 'Customer', phone };

    const rewards = await window.rewardsDB.getRewardsByPhone(phone);
    const now = new Date();
    const activeRewards = rewards.filter(r => (!r.expiryDate || new Date(r.expiryDate) > now));

    availablePoints = activeRewards.reduce((sum, r) => sum + (Number(r.rewardPoints) || 0), 0);
    recalculateApplyMath();
  }

  // Automatic calculation of capped points & due amount to shopkeeper
  function recalculateApplyMath() {
    const { cappingPercent, maxCappingLimit } = getCurrentCapping();
    activeCappingPercent = cappingPercent;
    activeMaxCappingLimit = maxCappingLimit;

    const price = parseFloat(productPriceInput.value) || 0;
    const priceCap = Math.floor(price * (activeCappingPercent / 100));
    autoCalculatedPoints = Math.min(availablePoints, priceCap, activeMaxCappingLimit);
    if (autoCalculatedPoints < 0) autoCalculatedPoints = 0;

    // Due amount to pay shopkeeper = Price - Automatically Capped Points
    autoCalculatedDue = Math.max(0, price - autoCalculatedPoints);

    if (summaryPrice) summaryPrice.textContent = `₹${price.toLocaleString()}`;
    if (summaryPointsApplied) {
      summaryPointsApplied.textContent = `-${autoCalculatedPoints.toLocaleString()} PTS (₹${autoCalculatedPoints.toLocaleString()} at ${activeCappingPercent}% Cap)`;
    }
    if (dueAmountDisplay) dueAmountDisplay.textContent = `₹${autoCalculatedDue.toLocaleString()}`;
  }

  window.recalculateApplyMath = recalculateApplyMath;

  // Reset Apply Form
  window.resetApplyForm = function() {
    if (form) form.reset();
    if (orderIdInput) orderIdInput.value = '';
    if (productNameInput) productNameInput.value = '';
    if (productPriceInput) productPriceInput.value = '';
    applyPhotoData = '';
    if (applyPhotoInput) applyPhotoInput.value = '';
    if (applyPhotoPreview) applyPhotoPreview.innerHTML = '<span>NO PHOTO</span>';
    recalculateApplyMath();
  };

  if (applyPhotoInput) {
    applyPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) { applyPhotoData = ''; if (applyPhotoPreview) applyPhotoPreview.innerHTML = '<span>NO PHOTO</span>'; return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 120; canvas.height = 120;
          canvas.getContext('2d').drawImage(img, 0, 0, 120, 120);
          applyPhotoData = canvas.toDataURL('image/jpeg', 0.8);
          if (applyPhotoPreview) applyPhotoPreview.innerHTML = `<img src="${applyPhotoData}" alt="Thumb" />`;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnResetApply) {
    btnResetApply.addEventListener('click', () => {
      window.resetApplyForm();
      if (window.showAdminToast) window.showAdminToast('Apply form reset');
    });
  }

  if (customerSelect) customerSelect.addEventListener('change', onCustomerChanged);
  if (productPriceInput) productPriceInput.addEventListener('input', recalculateApplyMath);

  // Quick Sample Button
  if (btnSample) {
    btnSample.addEventListener('click', async () => {
      await onCustomerChanged();
      if (orderIdInput) orderIdInput.value = 'ORD-APPLY-' + Math.floor(1000 + Math.random() * 9000);
      if (productNameInput) productNameInput.value = 'Smart LED 4K TV 55"';
      if (productPriceInput) productPriceInput.value = '20000';
      recalculateApplyMath();
      if (window.showAdminToast) {
        window.showAdminToast(`Loaded sample order (Auto ${activeCappingPercent}% cap -> ₹${autoCalculatedDue.toLocaleString()} due)`);
      }
    });
  }

  // Form submission: uses auto-calculated points and saves order id, without adding gains
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentCustomer) {
        if (window.showAdminToast) window.showAdminToast('Please select a customer');
        return;
      }

      const orderId = orderIdInput ? orderIdInput.value.trim() : '';
      const pName = productNameInput.value.trim();
      const pPrice = parseFloat(productPriceInput.value) || 0;

      if (!orderId || !pName || pPrice <= 0) {
        if (window.showAdminToast) window.showAdminToast('Please fill Order ID, Product Name, and Price');
        return;
      }

      recalculateApplyMath();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing Sale...'; }

      try {
        await window.rewardsDB.applyProductReward({
          orderId: orderId,
          customerPhone: currentCustomer.phone,
          customerName: currentCustomer.name,
          productName: pName,
          productPrice: pPrice,
          pointsApplied: autoCalculatedPoints,
          dueAmount: autoCalculatedDue,
          cappingPercent: activeCappingPercent,
          maxCappingLimit: activeMaxCappingLimit,
          productImage: applyPhotoData
        });

        if (window.showAdminToast) {
          window.showAdminToast(`✅ Applied ${autoCalculatedPoints.toLocaleString()} PTS on Order #${orderId}! Due: ₹${autoCalculatedDue.toLocaleString()}`);
        }

        window.resetApplyForm();
        await onCustomerChanged();

        if (window.loadRewardsAndStats) await window.loadRewardsAndStats();

        setTimeout(() => {
          if (window.switchAdminScreen) window.switchAdminScreen('screen-issued');
        }, 800);
      } catch (err) {
        console.error('Error applying rewards:', err);
        if (window.showAdminToast) window.showAdminToast('Error: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apply Rewards & Complete Sale';
        }
      }
    });
  }

  window.initApplyRewardsScreen();
});
