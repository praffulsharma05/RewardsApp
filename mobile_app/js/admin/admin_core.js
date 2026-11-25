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

  async init() {
    // 1. Initialize IndexedDB (shared with user app)
    await window.api.init();

    // 2. Bind Events
    this.bindEvents();

    // 3. Load Overview and Initial Screen
    await this.refreshOverview();
    await this.renderGamesList();
    await this.populateUnavailabilityCourts();
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
