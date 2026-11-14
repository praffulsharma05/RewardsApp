/**
 * auth.js - Customer Login & Registration Controller (Phone-based authentication only)
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const btnDemoLogin = document.getElementById('btnDemoLogin');
  const btnRegister = document.getElementById('btnRegister');
  const notification = document.getElementById('notification');

  function showMessage(text, isError = false) {
    if (!notification) return;
    notification.textContent = text;
    notification.className = 'wf-toast';
    notification.style.display = 'block';
    notification.style.border = isError ? '1.5px dashed #ff4444' : '1.5px solid #ffffff';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 4000);
  }

  // Handle Customer Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawPhone = document.getElementById('identifier').value.trim();
      const password = document.getElementById('password').value;
      const phone = rawPhone.replace(/\D/g, '').slice(-10);

      if (!phone || !password) {
        showMessage('Please enter your 10-digit mobile number and password.', true);
        return;
      }

      try {
        const user = await window.rewardsDB.loginUser(phone, password);
        showMessage(`Welcome back, ${user.name}! Opening wallet...`);
        setTimeout(() => {
          window.location.href = 'wallet.html';
        }, 700);
      } catch (err) {
        showMessage(err.message || 'Invalid mobile number or password.', true);
      }
    });

    if (btnDemoLogin) {
      btnDemoLogin.addEventListener('click', () => {
        document.getElementById('identifier').value = '9876543210';
        document.getElementById('password').value = 'password123';
        showMessage('Demo credentials inserted. Click Sign In.');
      });
    }
  }

  // Handle Customer Registration
  let isRegistering = false;
  async function performRegistration(e) {
    if (e) e.preventDefault();
    if (isRegistering) return;

    const nameInput = document.getElementById('regName');
    const phoneInput = document.getElementById('regPhone');
    const passInput = document.getElementById('regPassword');

    const name = nameInput ? nameInput.value.trim() : '';
    const rawPhone = phoneInput ? phoneInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    // Extract cleanly the 10 digits
    const phone = rawPhone.replace(/\D/g, '').slice(-10);

    if (!name) {
      showMessage('Please enter your full name.', true);
      if (nameInput) nameInput.focus();
      return;
    }

    if (!phone || phone.length < 10) {
      showMessage('Please enter a valid 10-digit mobile number.', true);
      if (phoneInput) phoneInput.focus();
      return;
    }

    if (!password) {
      showMessage('Please choose a password.', true);
      if (passInput) passInput.focus();
      return;
    }

    isRegistering = true;
    const submitBtn = btnRegister || (registerForm && registerForm.querySelector('button[type="submit"]'));
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering Account...';
    }

    try {
      const newUser = {
        name,
        phone,
        password
      };

      const registered = await window.rewardsDB.registerUser(newUser);
      window.rewardsDB.setCurrentUser(registered);
      showMessage(`Welcome, ${name}! Account created. Opening wallet...`);

      setTimeout(() => {
        window.location.href = 'wallet.html';
      }, 800);
    } catch (err) {
      isRegistering = false;
      console.error('Registration error:', err);
      showMessage(err.message || 'Registration failed. Please try again.', true);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Registration';
      }
    }
  }

  if (registerForm) {
    registerForm.addEventListener('submit', performRegistration);
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', (e) => {
      // If inside form, let submit handle it or invoke directly if not submitted
      if (!registerForm.checkValidity || registerForm.checkValidity()) {
        performRegistration(e);
      }
    });
  }
});
