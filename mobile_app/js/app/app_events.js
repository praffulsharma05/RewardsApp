/**
 * app_events.js - Mobile App UI Event Listeners and Navigation Bindings
 */
Object.assign(MobileWireframeApp.prototype, {
  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  bindEvents() {
    // Header Back Button
    document.getElementById("btn-header-back")?.addEventListener("click", () => this.goBack());

    // Logout Buttons (Header & Wallet Screen)
    document.getElementById("btn-header-logout")?.addEventListener("click", () => this.handleLogout());
    document.getElementById("btn-wallet-logout")?.addEventListener("click", () => this.handleLogout());

    // Header User Tag (Quick Switch to Wallet)
    document.getElementById("header-user-pill")?.addEventListener("click", () => {
      if (this.currentUser) {
        this.navigateTo("screen-wallet");
        this.renderWallet();
      } else {
        this.navigateTo("screen-auth");
      }
    });

    // Bottom Navigation Tabs
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.addEventListener("click", async () => {
        const target = tab.dataset.target;
        this.navigateTo(target);

        if (target === "screen-sports") await this.renderSports();
        if (target === "screen-bookings") await this.renderBookingsList();
        if (target === "screen-wallet") await this.renderWallet();
      });
    });

    // Auth Tabs (Sign In / Register toggle)
    const tabLogin = document.getElementById("btn-auth-tab-login");
    const tabReg = document.getElementById("btn-auth-tab-reg");
    const viewLogin = document.getElementById("view-auth-login");
    const viewReg = document.getElementById("view-auth-register");
    const switchReg = document.getElementById("btn-switch-to-reg");
    const switchLogin = document.getElementById("btn-switch-to-login");

    const showLoginView = () => {
      tabLogin?.classList.add("active");
      tabReg?.classList.remove("active");
      if (viewLogin) viewLogin.style.display = "block";
      if (viewReg) viewReg.style.display = "none";
    };

    const showRegisterView = () => {
      tabReg?.classList.add("active");
      tabLogin?.classList.remove("active");
      if (viewReg) viewReg.style.display = "block";
      if (viewLogin) viewLogin.style.display = "none";
    };

    tabLogin?.addEventListener("click", showLoginView);
    tabReg?.addEventListener("click", showRegisterView);
    switchReg?.addEventListener("click", showRegisterView);
    switchLogin?.addEventListener("click", showLoginView);

    // Login Form Submit (Supports email or phone, saves session to localStorage if Remember Me checked)
    document.getElementById("form-login")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const identifier = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;
      const remember = document.getElementById("chk-remember-me")?.checked;
      try {
        const user = await window.api.login(identifier, pass);
        this.currentUser = user;
        if (remember) {
          localStorage.setItem("sports_active_user_id", user.id);
        } else {
          localStorage.removeItem("sports_active_user_id");
        }
        this.updateUserHeaderPill();
        this.showToast(`Signed in as ${user.name}`);
        this.navigateTo("screen-sports");
        await this.renderSports();
      } catch (err) {
        alert(err.message);
      }
    });

    // SSO: Google OAuth & Apple ID
    const handleSSO = async (provider) => {
      const user = await window.api.getUser(1);
      this.currentUser = user;
      localStorage.setItem("sports_active_user_id", user.id);
      this.updateUserHeaderPill();
      this.showToast(`Signed in via ${provider} (${user.name})`);
      this.navigateTo("screen-sports");
      await this.renderSports();
    };

    document.getElementById("btn-sso-google")?.addEventListener("click", () => handleSSO("Google OAuth 2.0"));
    document.getElementById("btn-sso-apple")?.addEventListener("click", () => handleSSO("Apple ID"));

    // Password Visibility Toggles
    const togglePass = (btnId, inputId) => {
      document.getElementById(btnId)?.addEventListener("click", () => {
        const p = document.getElementById(inputId);
        if (p) p.type = (p.type === "password") ? "text" : "password";
      });
    };
    togglePass("toggle-login-pass", "login-password");
    togglePass("toggle-reg-pass", "reg-password");
    togglePass("toggle-reg-confirm-pass", "reg-confirm-password");

    // Quick Demo Login Button
    document.getElementById("btn-quick-demo-login")?.addEventListener("click", async () => {
      const emailInput = document.getElementById("login-email");
      const passInput = document.getElementById("login-password");
      if (emailInput) emailInput.value = "alex.morgan@sportsmail.com";
      if (passInput) passInput.value = "password123";
      try {
        const user = await window.api.login("alex.morgan@sportsmail.com", "password123");
        this.currentUser = user;
        localStorage.setItem("sports_active_user_id", user.id);
        this.updateUserHeaderPill();
        this.showToast(`Signed in as ${user.name}`);
        this.navigateTo("screen-sports");
        await this.renderSports();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("link-forgot-pass")?.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Password reset OTP simulated: Sent to registered email/phone.");
    });

    // Register Form Submit (SPEC AUTH-2.0: name, email, phone, password)
    document.getElementById("form-register")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-name").value;
      const email = document.getElementById("reg-email").value;
      const phone = document.getElementById("reg-phone")?.value || "";
      const pass = document.getElementById("reg-password").value;
      const confirmPass = document.getElementById("reg-confirm-password")?.value || "";

      if (pass !== confirmPass) {
        alert("Passwords do not match. Please re-enter.");
        return;
      }

      try {
        const user = await window.api.register(name, email, pass, phone);
        this.currentUser = user;
        localStorage.setItem("sports_active_user_id", user.id);
        this.updateUserHeaderPill();
        this.showToast(`Welcome ${user.name}! 10 sports credits added.`);
        this.navigateTo("screen-sports");
        await this.renderSports();
      } catch (err) {
        alert(err.message);
      }
    });

    // Booking Date Change
    const inputDate = document.getElementById("input-booking-date");
    if (inputDate) {
      inputDate.value = this.draft.date;
      inputDate.min = this.getTodayDateString();
      inputDate.addEventListener("change", async (e) => {
        this.draft.date = e.target.value;
        await this.checkDateAvailability(this.draft.date);
      });
    }

    // Confirm Checkout Action Button
    document.getElementById("btn-confirm-checkout")?.addEventListener("click", async () => {
      await this.handleCheckout();
    });

    // Success Screen Buttons
    document.getElementById("btn-pass-view-bookings")?.addEventListener("click", async () => {
      this.navigateTo("screen-bookings");
      await this.renderBookingsList();
    });

    document.getElementById("btn-pass-book-another")?.addEventListener("click", async () => {
      this.navigateTo("screen-sports");
      await this.renderSports();
    });

    // Refresh Bookings List
    document.getElementById("btn-refresh-bookings-list")?.addEventListener("click", async () => {
      await this.renderBookingsList();
      this.showToast("Bookings list reloaded from IndexedDB");
    });

    // Edit Modal Close & Abort
    document.getElementById("btn-close-edit-modal")?.addEventListener("click", () => this.closeEditModal());
    document.getElementById("btn-submit-edit")?.addEventListener("click", async () => this.handleSaveEditedBooking());

    // Cancel Modal Close & Actions
    document.getElementById("btn-close-cancel-modal")?.addEventListener("click", () => this.closeCancelModal());
    document.getElementById("btn-abort-cancel")?.addEventListener("click", () => this.closeCancelModal());
    document.getElementById("btn-submit-cancel")?.addEventListener("click", async () => this.handleConfirmCancellation());

    // Hash change listener for browser navigation & reloads
    window.addEventListener("hashchange", async () => {
      if (!this.currentUser) return;
      const rawHash = window.location.hash.replace("#", "");
      const validScreens = ["screen-sports", "screen-bookings", "screen-wallet"];
      if (validScreens.includes(rawHash) && this.currentScreen !== rawHash) {
        this.navigateTo(rawHash, false);
        if (rawHash === "screen-bookings") await this.renderBookingsList();
        else if (rawHash === "screen-wallet") await this.renderWallet();
        else await this.renderSports();
      }
    });
  }

});
