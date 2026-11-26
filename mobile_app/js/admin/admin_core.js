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
    const validScreens = [
      "screen-overview",
      "screen-games",
      "screen-pricing",
      "screen-users",
      "screen-rewards",
      "screen-bookings"
    ];
    try {
      const hash = window.location.hash ? window.location.hash.replace("#", "") : "";
      if (validScreens.includes(hash)) return hash;
      if (validScreens.includes("screen-" + hash)) return "screen-" + hash;
    } catch (e) {}
    try {
      const ss = sessionStorage.getItem("admin_active_screen");
      if (validScreens.includes(ss)) return ss;
    } catch (e) {}
    try {
      const ls = localStorage.getItem("admin_active_screen");
      if (validScreens.includes(ls)) return ls;
    } catch (e) {}
    try {
      if (window.name && window.name.startsWith("admin_active_screen:")) {
        const wn = window.name.slice("admin_active_screen:".length);
        if (validScreens.includes(wn)) return wn;
      }
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
      try { sessionStorage.setItem("admin_active_screen", screenId); } catch (e) {}
      try { localStorage.setItem("admin_active_screen", screenId); } catch (e) {}
      try { window.name = "admin_active_screen:" + screenId; } catch (e) {}
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "#" + screenId);
        }
        if (window.location.hash !== "#" + screenId) {
          window.location.hash = "#" + screenId;
        }
      } catch (e) {
        try { window.location.hash = "#" + screenId; } catch (_) {}
      }
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
    if (typeof this.bindBookSlotEvents === "function") {
      this.bindBookSlotEvents();
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
