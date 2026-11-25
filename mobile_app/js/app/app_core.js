/**
 * app.js - Mobile Wireframe UI Controller
 * Connects black & white mobile screens to the IndexedDB mock API layer.
 */

class MobileWireframeApp {
  constructor() {
    this.currentUser = null;
    this.screenHistory = ["screen-auth"];
    this.currentScreen = "screen-auth";

    // Booking Flow Draft State
    this.draft = {
      sportId: 1, // Default Table Tennis
      sportName: "Table Tennis",
      courtId: 1,
      courtName: "Table 1",
      date: this.getTodayDateString(),
      slotId: null,
      slotTime: "",
      price: 35.00
    };

    // Modal State
    this.activeEditBookingId = null;
    this.activeCancelBookingId = null;
  }

  getTodayDateString(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async init() {
    // 1. Initialize IndexedDB
    await window.api.init();

    // 2. Check if user chose "Remember me" from localStorage
    const savedUserId = localStorage.getItem("sports_active_user_id");
    if (savedUserId) {
      const user = await window.api.getUser(Number(savedUserId));
      if (user) {
        this.currentUser = user;
      }
    }

    // 3. Bind UI Events
    this.bindEvents();

    // 4. Update Promo & Admin Badges from DB
    await this.refreshAdminRewardDisplay();
    await this.checkDateAvailability(this.draft.date);

    // 5. If user session is active, restore active screen (e.g. bookings, wallet); otherwise show Sign In
    if (this.currentUser) {
      this.updateUserHeaderPill();
      const rawHash = window.location.hash.replace("#", "");
      const validScreens = ["screen-sports", "screen-bookings", "screen-wallet"];
      const targetScreen = validScreens.includes(rawHash) ? rawHash : (localStorage.getItem("sports_active_screen") || "screen-sports");
      const resolved = validScreens.includes(targetScreen) ? targetScreen : "screen-sports";

      this.navigateTo(resolved, false);
      if (resolved === "screen-bookings") {
        await this.renderBookingsList();
      } else if (resolved === "screen-wallet") {
        await this.renderWallet();
      } else {
        await this.renderSports();
      }
    } else {
      this.currentUser = null;
      this.updateUserHeaderPill();
      this.navigateTo("screen-auth", false);
    }
  }

  // Header and user pill updater
  updateUserHeaderPill() {
    const pill = document.getElementById("header-user-pill");
    const logoutBtn = document.getElementById("btn-header-logout");
    if (!pill) return;
    if (this.currentUser) {
      pill.textContent = `${this.currentUser.name.split(" ")[0]} ($${this.currentUser.wallet_balance.toFixed(2)})`;
      const hidePill = this.currentScreen === "screen-bookings" || this.currentScreen === "screen-wallet";
      pill.style.display = hidePill ? "none" : "inline-flex";
      if (logoutBtn) logoutBtn.style.display = "inline-flex";
    } else {
      pill.textContent = "Guest";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
      this.currentUser = null;
      localStorage.removeItem("sports_active_user_id");
      localStorage.removeItem("sports_active_screen");
      try { history.replaceState(null, "", " "); } catch (_) {}
      this.updateUserHeaderPill();
      this.screenHistory = ["screen-auth"];
      this.navigateTo("screen-auth", false);
      this.showToast("Signed out successfully.");
    }
  }

  // Toast feedback
  showToast(msg) {
    const toast = document.getElementById("wf-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }

  // Screen Navigator
  navigateTo(screenId, pushHistory = true) {
    const screens = document.querySelectorAll(".wireframe-screen");
    screens.forEach(s => s.classList.remove("active"));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add("active");
      this.currentScreen = screenId;
      if (pushHistory && this.screenHistory[this.screenHistory.length - 1] !== screenId) {
        this.screenHistory.push(screenId);
      }
    }

    // Persist top-level active tab for page reload
    if (this.currentUser && screenId !== "screen-auth") {
      const topTabs = ["screen-sports", "screen-bookings", "screen-wallet"];
      if (topTabs.includes(screenId)) {
        localStorage.setItem("sports_active_screen", screenId);
        try { history.replaceState(null, "", "#" + screenId); } catch (_) {}
      }
    }

    // Update Header Title
    const titleElem = document.getElementById("header-screen-title");
    const backBtn = document.getElementById("btn-header-back");

    const titles = {
      "screen-auth": "Sign In",
      "screen-sports": "Sports",
      "screen-courts": "Select Table",
      "screen-slots": "Select Slot",
      "screen-checkout": "Confirm Booking",
      "screen-success": "Digital Pass",
      "screen-bookings": "My Bookings",
      "screen-wallet": "Rewards Wallet"
    };

    if (titleElem) titleElem.textContent = titles[screenId] || "SportsSlot";
    if (backBtn) {
      backBtn.style.display = (screenId === "screen-auth" || screenId === "screen-sports") ? "none" : "inline-flex";
    }

    const userPill = document.getElementById("header-user-pill");
    if (userPill) {
      const hidePill = screenId === "screen-bookings" || screenId === "screen-wallet" || !this.currentUser;
      userPill.style.display = hidePill ? "none" : "inline-flex";
    }

    // Hide bottom navigation bar on auth screen for clean login experience
    const bottomNav = document.querySelector(".mobile-bottom-nav");
    if (bottomNav) {
      bottomNav.style.display = (screenId === "screen-auth") ? "none" : "flex";
    }

    // Update Bottom Tab Active States
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.target === screenId);
    });
  }

  goBack() {
    if (this.screenHistory.length > 1) {
      this.screenHistory.pop();
      const prevScreen = this.screenHistory[this.screenHistory.length - 1];
      this.navigateTo(prevScreen, false);
    } else {
      this.navigateTo("screen-sports", false);
    }
  }

  async refreshAdminRewardDisplay() {
    const rate = await window.api.getRewardRate();
    const promoBadge = document.getElementById("badge-promo-rate");
    const promoText = document.getElementById("lbl-promo-text");
    const adminInput = document.getElementById("input-admin-reward");

    if (promoBadge) promoBadge.textContent = `${rate}% Rewards`;
    if (promoText) promoText.textContent = `${rate}%`;
    if (adminInput) adminInput.value = rate;
  }

  async checkDateAvailability(targetDate) {
    const todayStr = this.getTodayDateString();
    const isTargetToday = (targetDate === todayStr);
    const closedCheck = await window.api.isDateClosed(targetDate);
    const globalStatus = await window.api.getFacilityStatus();
    const banner = document.getElementById("facility-closed-banner");
    const reasonElem = document.getElementById("facility-closed-reason");

    // 1. Facility closed today only affects TODAY's date - future dates are OPEN!
    if (!globalStatus.isOpen && isTargetToday) {
      if (banner) {
        banner.style.display = "block";
        if (reasonElem) {
          reasonElem.textContent = `Today (${todayStr}) is closed by admin: "${globalStatus.reason}". You can pick future dates to book slots!`;
        }
      }
      return { isAvailable: false, reason: globalStatus.reason, isTodayOnly: true };
    }

    // 2. Specific date blackout check (Admin Closed Dates - Full Day)
    if (closedCheck.isClosed) {
      if (banner) {
        banner.style.display = "block";
        if (reasonElem) {
          reasonElem.textContent = `Facility Closed on ${targetDate}: "${closedCheck.reason}". Please select another date.`;
        }
      }
      return { isAvailable: false, reason: closedCheck.reason, isTodayOnly: false };
    }

    // 3. Partial-day time blackouts notice (e.g. 14/11/2026 from 10 AM to 2 PM)
    if (closedCheck.hasPartialClosure) {
      if (banner) {
        banner.style.display = "block";
        if (reasonElem) {
          reasonElem.innerHTML = `<strong>Notice for ${targetDate}:</strong> Scheduled closure during ${closedCheck.reason}. Slots in that window are blocked, but other hours remain open!`;
        }
      }
      return { isAvailable: true, reason: closedCheck.reason, hasPartialClosure: true };
    }

    // If looking at an open future date, hide the closed banner
    if (banner) banner.style.display = "none";
    return { isAvailable: true, reason: "" };
  }

}

window.MobileWireframeApp = MobileWireframeApp;
window.MobileApp = MobileWireframeApp;
