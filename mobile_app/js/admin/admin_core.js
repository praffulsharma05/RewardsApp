/**
 * admin.js - Mobile Wireframe Admin Panel Controller
 * Interacts directly with the shared IndexedDB (SportsSlotWireframeDB).
 */

class MobileAdminApp {
  constructor() {
    this.currentScreen = "screen-overview";
    this.pendingDeleteSportId = null;
    this.pendingDeleteUserId = null;
    this.bookingFilter = "all";
    this.activeRefundBooking = null;
  }

  getRestoredScreen() {
    try {
      const hash = window.location.hash ? window.location.hash.replace("#", "") : "";
      const savedScreen = sessionStorage.getItem("admin_active_screen") || localStorage.getItem("admin_active_screen");
      const validScreens = [
        "screen-overview",
        "screen-games",
        "screen-pricing",
        "screen-users",
        "screen-rewards",
        "screen-bookings"
      ];
      if (validScreens.includes(hash)) return hash;
      if (validScreens.includes("screen-" + hash)) return "screen-" + hash;
      if (validScreens.includes(savedScreen)) return savedScreen;
    } catch (e) {}
    return "screen-overview";
  }

  async init() {
    // 1. Immediately activate restored screen to avoid flash of overview
    const restored = this.getRestoredScreen();
    if (restored && restored !== "screen-overview") {
      this.navigateTo(restored);
    }

    // 2. Initialize IndexedDB (shared with user app)
    await window.api.init();

    // 3. Bind Events
    this.bindEvents();

    // 4. Pre-populate base overview and facility data
    await this.refreshOverview();
    await this.renderGamesList();
    await this.populateUnavailabilityCourts();

    // 5. Load restored screen data
    if (restored && restored !== "screen-overview") {
      if (restored === "screen-pricing") await this.renderPricingSchedule();
      if (restored === "screen-users") await this.renderUsersList();
      if (restored === "screen-rewards") await this.loadRewardSettings();
      if (restored === "screen-bookings") await this.renderAllBookings();
    }
  }

  showToast(msg) {
    const toast = document.getElementById("admin-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }

  navigateTo(screenId) {
    document.querySelectorAll(".admin-screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add("active");
      this.currentScreen = screenId;
      try {
        sessionStorage.setItem("admin_active_screen", screenId);
        localStorage.setItem("admin_active_screen", screenId);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "#" + screenId);
        }
      } catch (e) {}
    }

    // Update Bottom Navigation Active States
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.target === screenId);
    });

    const titles = {
      "screen-overview": "Admin Overview",
      "screen-games": "Manage Sports",
      "screen-pricing": "Slot Pricing",
      "screen-users": "Player Registry",
      "screen-rewards": "Rules & Availability",
      "screen-bookings": "All Bookings"
    };

    const titleElem = document.getElementById("header-admin-title");
    if (titleElem) titleElem.textContent = titles[screenId] || "Admin Panel";
  }

  async switchToScreen(screenId) {
    this.navigateTo(screenId);
    if (screenId === "screen-overview") await this.refreshOverview();
    if (screenId === "screen-games") await this.renderGamesList();
    if (screenId === "screen-pricing") await this.renderPricingSchedule();
    if (screenId === "screen-users") await this.renderUsersList();
    if (screenId === "screen-rewards") await this.loadRewardSettings();
    if (screenId === "screen-bookings") await this.renderAllBookings();
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  bindEvents() {
    if (typeof this.bindNavigationAndFacilityEvents === "function") {
      this.bindNavigationAndFacilityEvents();
    }
    if (typeof this.bindManagementEvents === "function") {
      this.bindManagementEvents();
    }
  }

  getDateString(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

}

window.MobileAdminApp = MobileAdminApp;
window.AdminApp = MobileAdminApp;
