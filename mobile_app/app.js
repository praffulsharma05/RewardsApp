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
      courtName: "Table 1 (Pro Stiga Arena)",
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

    // 5. If user session is active, navigate to sports; otherwise show Sign In wireframe first
    if (this.currentUser) {
      this.updateUserHeaderPill();
      this.navigateTo("screen-sports", false);
      await this.renderSports();
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
      pill.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      pill.textContent = "Guest";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
      this.currentUser = null;
      localStorage.removeItem("sports_active_user_id");
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
      backBtn.style.visibility = (screenId === "screen-auth" || screenId === "screen-sports") ? "hidden" : "visible";
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

    tabLogin?.addEventListener("click", () => {
      tabLogin.className = "wf-btn wf-btn-sm";
      tabReg.className = "wf-btn wf-btn-secondary wf-btn-sm";
      if (viewLogin) viewLogin.style.display = "block";
      if (viewReg) viewReg.style.display = "none";
    });

    tabReg?.addEventListener("click", () => {
      tabReg.className = "wf-btn wf-btn-sm";
      tabLogin.className = "wf-btn wf-btn-secondary wf-btn-sm";
      if (viewReg) viewReg.style.display = "block";
      if (viewLogin) viewLogin.style.display = "none";
    });

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

    // Password Visibility Toggle & Forgot Password
    document.getElementById("toggle-login-pass")?.addEventListener("click", () => {
      const p = document.getElementById("login-password");
      if (p) p.type = (p.type === "password") ? "text" : "password";
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
  }

  // ==========================================
  // SCREEN 2: SPORTS
  // ==========================================
  async renderSports() {
    const container = document.getElementById("sports-grid-container");
    if (!container) return;

    const sports = await window.api.getSports();
    container.innerHTML = sports.map(s => `
      <div class="sport-card ${s.id === this.draft.sportId ? "selected" : ""}" data-sport-id="${s.id}">
        <div class="sport-icon-box">${s.icon}</div>
        <strong style="display:block; font-size:0.85rem;">${s.name}</strong>
        <span class="wf-meta">${s.courts_count} Courts Available</span>
      </div>
    `).join("");

    container.querySelectorAll(".sport-card").forEach(card => {
      card.addEventListener("click", async () => {
        const sportId = Number(card.dataset.sportId);
        const sport = sports.find(s => s.id === sportId);
        this.draft.sportId = sportId;
        this.draft.sportName = sport ? sport.name : "Sport";
        this.navigateTo("screen-courts");
        await this.renderCourts(sportId);
      });
    });
  }

  // ==========================================
  // SCREEN 3: COURTS / TABLES
  // ==========================================
  async renderCourts(sportId) {
    const container = document.getElementById("courts-list-container");
    const sportTitle = document.getElementById("court-sport-name");
    if (sportTitle) sportTitle.textContent = this.draft.sportName;

    const courts = await window.api.getCourts(sportId);
    const unavails = await window.api.getPlaygroundUnavailabilities();

    container.innerHTML = courts.map(c => {
      // Check if this particular court or its sport has unavailabilities for the selected date
      const activeUnavails = unavails.filter(u => {
        const targetCourtId = Number(u.court_id || 0);
        const targetSportId = Number(u.sport_id || 0);
        let matchesCourt = false;
        if (targetCourtId !== 0) {
          matchesCourt = (targetCourtId === Number(c.id));
        } else if (targetSportId !== 0) {
          matchesCourt = (Number(c.sport_id) === targetSportId);
        } else {
          matchesCourt = true;
        }
        const matchesDate = (u.date === "ALL_DAYS" || u.date === this.draft.date);
        return matchesCourt && matchesDate;
      });

      let unavailBadge = "";
      if (activeUnavails.length > 0) {
        const timeBlocks = activeUnavails.map(u => `${u.start_time} - ${u.end_time}`).join(", ");
        unavailBadge = `<div style="font-size:0.7rem; color:#dc2626; font-weight:700; margin-top:2px;">&#9888; Blocked: ${timeBlocks} (${activeUnavails[0].reason})</div>`;
      }

      return `
        <div class="court-item" data-court-id="${c.id}">
          <div>
            <strong style="font-size:0.88rem; display:block;">${c.name}</strong>
            <span class="wf-meta">Surface: ${c.surface} &bull; ${c.status}</span>
            ${unavailBadge}
          </div>
          <span class="header-btn" style="pointer-events:none;">Pick &rarr;</span>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".court-item").forEach(item => {
      item.addEventListener("click", async () => {
        const courtId = Number(item.dataset.courtId);
        const court = courts.find(c => c.id === courtId);
        this.draft.courtId = courtId;
        this.draft.courtName = court ? court.name : "Court";
        this.navigateTo("screen-slots");
        await this.renderSlots(courtId, this.draft.date);
      });
    });
  }

  // ==========================================
  // SCREEN 4: SLOTS
  // ==========================================
  async renderSlots(courtId, dateStr) {
    const container = document.getElementById("slots-grid-container");
    const courtTitle = document.getElementById("slot-screen-court-title");
    const datePill = document.getElementById("slot-screen-date-pill");

    if (courtTitle) courtTitle.textContent = `${this.draft.sportName} - ${this.draft.courtName}`;
    if (datePill) datePill.textContent = dateStr;

    // Date Navigation on Screen 4
    const slotDateInput = document.getElementById("input-slot-screen-date");
    if (slotDateInput) {
      slotDateInput.value = dateStr;
      slotDateInput.min = this.getTodayDateString();
      slotDateInput.onchange = async (e) => {
        this.draft.date = e.target.value;
        const mainDate = document.getElementById("input-booking-date");
        if (mainDate) mainDate.value = this.draft.date;
        await this.renderSlots(courtId, this.draft.date);
      };
    }

    const prevDayBtn = document.getElementById("btn-slot-prev-day");
    if (prevDayBtn) {
      prevDayBtn.onclick = async () => {
        const parts = this.draft.date.split("-").map(Number);
        const curr = new Date(parts[0], parts[1] - 1, parts[2]);
        curr.setDate(curr.getDate() - 1);
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        const prevStr = `${y}-${m}-${d}`;
        if (prevStr >= this.getTodayDateString()) {
          this.draft.date = prevStr;
          const mainDate = document.getElementById("input-booking-date");
          if (mainDate) mainDate.value = this.draft.date;
          await this.renderSlots(courtId, this.draft.date);
        } else {
          this.showToast("Cannot select a date in the past.");
        }
      };
    }

    const nextDayBtn = document.getElementById("btn-slot-next-day");
    if (nextDayBtn) {
      nextDayBtn.onclick = async () => {
        const parts = this.draft.date.split("-").map(Number);
        const curr = new Date(parts[0], parts[1] - 1, parts[2]);
        curr.setDate(curr.getDate() + 1);
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        this.draft.date = `${y}-${m}-${d}`;
        const mainDate = document.getElementById("input-booking-date");
        if (mainDate) mainDate.value = this.draft.date;
        await this.renderSlots(courtId, this.draft.date);
      };
    }

    const dateAvail = await this.checkDateAvailability(dateStr);
    if (!dateAvail.isAvailable) {
      container.innerHTML = `
        <div class="wf-card" style="grid-column: 1 / -1; text-align: center; padding: 20px 10px; border-style: dashed;">
          <strong style="text-transform: uppercase;">Closed on ${dateStr}</strong>
          <p class="wf-meta" style="margin-top: 4px;">Reason: ${dateAvail.reason}</p>
          <small>Admin marked this date as unavailable. Please pick another date.</small>
        </div>
      `;
      return;
    }

    const slots = await window.api.getSlots(courtId, dateStr);

    container.innerHTML = slots.map(s => {
      if (s.is_past) {
        return `
          <div class="slot-box unavailable past-slot" data-reason="Time slot has already passed for today." title="Time slot has already passed" style="background:#f3f4f6; border:1px dashed #bbb; color:#9ca3af; cursor:not-allowed; opacity:0.65;">
            <span class="slot-time" style="text-decoration:line-through;">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price" style="font-size:0.65rem; color:#6b7280; font-weight:600;">[Past Time]</span>
            <small style="display:block; font-size:0.6rem; color:#9ca3af; line-height:1.2; margin-top:2px;">Already passed</small>
          </div>
        `;
      }
      if (s.is_unavailable) {
        return `
          <div class="slot-box unavailable" data-reason="${s.unavailability_reason || 'Playground / Academy Unavailable'}" title="${s.unavailability_reason || 'Playground / Academy Unavailable'}" style="background:#f5f5f5; border:1.5px dashed #888; color:#777; cursor:not-allowed; opacity:0.85;">
            <span class="slot-time" style="text-decoration:line-through;">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price" style="font-size:0.68rem; color:#c00; font-weight:700;">[Unavailable]</span>
            <small style="display:block; font-size:0.62rem; color:#444; line-height:1.2; margin-top:2px;">${s.unavailability_reason || 'Blocked (10 AM - 5 PM)'}</small>
          </div>
        `;
      }
      if (s.is_booked) {
        return `
          <div class="slot-box booked" title="Already booked by another player">
            <span class="slot-time">${s.start_time} - ${s.end_time}</span>
            <span class="slot-price">[Booked]</span>
          </div>
        `;
      }
      const dayLabel = s.day_type === "WEEKEND" ? `<span style="font-size:0.65rem; color:#000; font-weight:700;">(W/E)</span>` : "";
      return `
        <div class="slot-box" data-slot-id="${s.id}" data-time="${s.start_time} - ${s.end_time}" data-price="${s.price}">
          <span class="slot-time">${s.start_time} - ${s.end_time}</span>
          <span class="slot-price">$${s.price.toFixed(2)} ${dayLabel}</span>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".slot-box.unavailable").forEach(box => {
      box.addEventListener("click", () => {
        const reason = box.dataset.reason || "Slot unavailable per academy rules.";
        this.showToast(`🚫 ${reason}`);
      });
    });

    container.querySelectorAll(".slot-box:not(.booked):not(.unavailable)").forEach(box => {
      box.addEventListener("click", async () => {
        this.draft.slotId = Number(box.dataset.slotId);
        this.draft.slotTime = box.dataset.time;
        this.draft.price = Number(box.dataset.price);
        this.navigateTo("screen-checkout");
        await this.renderCheckout();
      });
    });
  }

  // ==========================================
  // SCREEN 5: CHECKOUT & DYNAMIC REWARD CALCULATION
  // ==========================================
  async renderCheckout() {
    document.getElementById("chk-sport").textContent = this.draft.sportName;
    document.getElementById("chk-court").textContent = this.draft.courtName;
    document.getElementById("chk-date").textContent = this.draft.date;
    document.getElementById("chk-time").textContent = this.draft.slotTime;
    document.getElementById("chk-price").textContent = `$${this.draft.price.toFixed(2)}`;

    // Refresh user's live wallet balance
    if (this.currentUser) {
      const liveUser = await window.api.getUser(this.currentUser.id);
      if (liveUser) this.currentUser = liveUser;
    }
    const walletBalance = Number(this.currentUser?.wallet_balance || 0);
    const walletAvailPill = document.getElementById("chk-wallet-avail");
    if (walletAvailPill) walletAvailPill.textContent = `$${walletBalance.toFixed(2)}`;

    // Fetch Admin Configured Maximum Discount / Rewards Redemption Cap from DB (e.g. 30%)
    const maxDiscountCap = await window.api.getMaxDiscountPercent();
    const capBadge = document.getElementById("badge-checkout-discount-cap");
    if (capBadge) capBadge.textContent = `Max Cap: ${maxDiscountCap}%`;

    const chkUseWallet = document.getElementById("chk-use-wallet");
    const updatePaymentMath = () => {
      const isChecked = chkUseWallet ? chkUseWallet.checked : false;
      const slotPrice = Number(this.draft.price || 0);

      // Maximum discount/redemption allowed by Admin rule (e.g. 30% of fee)
      const maxAllowedFromPoints = Number(((slotPrice * maxDiscountCap) / 100).toFixed(2));
      const applied = (isChecked && walletBalance > 0)
        ? Math.min(walletBalance, maxAllowedFromPoints, slotPrice)
        : 0;
      const netPayable = Math.max(0, slotPrice - applied);

      this.draft.walletApplied = applied;

      const deductElem = document.getElementById("chk-wallet-deduction");
      const netElem = document.getElementById("chk-net-payable");
      if (deductElem) deductElem.textContent = applied > 0 ? `-$${applied.toFixed(2)}` : "$0.00";
      if (netElem) netElem.textContent = `$${netPayable.toFixed(2)}`;
    };

    if (chkUseWallet) {
      chkUseWallet.disabled = walletBalance <= 0;
      chkUseWallet.checked = walletBalance > 0;
      chkUseWallet.onchange = () => updatePaymentMath();
    }
    updatePaymentMath();

    // Read Admin Configured Reward Rate from IndexedDB
    const rewardRate = await window.api.getRewardRate();
    const rewardAmount = Number(((this.draft.price * rewardRate) / 100).toFixed(2));

    document.getElementById("chk-reward-badge").textContent = `${rewardRate}% Active`;
    document.getElementById("chk-reward-rate").textContent = `${rewardRate}%`;
    document.getElementById("chk-reward-amount").textContent = `+$${rewardAmount.toFixed(2)}`;

    // Check Facility & Date Availability
    const dateAvail = await this.checkDateAvailability(this.draft.date);
    const btnConfirm = document.getElementById("btn-confirm-checkout");
    if (!dateAvail.isAvailable) {
      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = `Closed on ${this.draft.date} - Booking Disabled`;
      }
    } else {
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Confirm & Book Slot";
      }
    }
  }

  // Handle Checkout Confirmation
  async handleCheckout() {
    if (!this.currentUser) {
      alert("Please sign in first to book a slot.");
      this.navigateTo("screen-auth");
      return;
    }

    const useWallet = document.getElementById("chk-use-wallet")?.checked || false;

    try {
      const result = await window.api.createBooking({
        userId: this.currentUser.id,
        sportId: this.draft.sportId,
        courtId: this.draft.courtId,
        slotId: this.draft.slotId,
        date: this.draft.date,
        useWallet: useWallet
      });

      this.currentUser.wallet_balance = result.updatedWallet;
      this.updateUserHeaderPill();

      // Render Success Pass
      document.getElementById("pass-id").textContent = `#${result.booking.id}`;
      const walletPaidElem = document.getElementById("pass-wallet-paid");
      if (walletPaidElem) {
        walletPaidElem.textContent = result.booking.wallet_applied > 0 ? 
          `-$${result.booking.wallet_applied.toFixed(2)}` : "$0.00";
      }
      document.getElementById("pass-reward").textContent = `+$${result.booking.reward_amount.toFixed(2)} (${result.booking.reward_percent}%)`;
      document.getElementById("pass-wallet").textContent = `$${result.updatedWallet.toFixed(2)}`;

      const payNote = result.booking.wallet_applied > 0 ? 
        ` Paid $${result.booking.wallet_applied.toFixed(2)} with wallet credits!` : "";
      this.showToast(`Slot booked!${payNote} +$${result.booking.reward_amount.toFixed(2)} rewards credited.`);
      this.navigateTo("screen-success");

    } catch (err) {
      alert(err.message);
    }
  }

  // ==========================================
  // SCREEN 7: MY BOOKINGS (LIST, EDIT & CANCEL)
  // ==========================================
  async renderBookingsList() {
    const container = document.getElementById("bookings-list-container");
    if (!container) return;

    if (!this.currentUser) {
      container.innerHTML = `<div class="wf-card"><p>Please sign in to view your bookings.</p></div>`;
      return;
    }

    const bookings = await window.api.getUserBookings(this.currentUser.id);

    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="wf-card" style="text-align: center; padding: 24px 12px;">
          <p class="wf-meta">No reservations found.</p>
          <button class="wf-btn wf-btn-sm" id="btn-empty-book-now" style="margin-top: 8px;">Book Table Tennis &rarr;</button>
        </div>
      `;
      document.getElementById("btn-empty-book-now")?.addEventListener("click", () => {
        this.navigateTo("screen-sports");
      });
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    container.innerHTML = bookings.map(b => {
      const isConfirmed = b.status === "CONFIRMED";
      const isPastGame = isConfirmed && ((b.date < todayStr) || (b.date === todayStr && (b.end_time || b.start_time) <= currentHourMin));

      let statusBadge = `<span class="wf-pill ${isConfirmed ? "" : "cancelled"}">${b.status}</span>`;
      if (isPastGame) {
        statusBadge = `<span class="wf-pill" style="background:#374151; color:#fff; border-color:#374151;">COMPLETED</span>`;
      }

      return `
        <div class="wf-card ${isConfirmed ? "" : "highlight"}" data-booking-id="${b.id}">
          <div class="wf-card-header">
            <div>
              <strong style="font-size:0.88rem;">${b.sport_name}</strong>
              <small class="wf-meta" style="display:block;">Booking #${b.id} &bull; ${b.date}</small>
            </div>
            ${statusBadge}
          </div>

          <div style="font-size:0.8rem; margin-bottom: 8px;">
            <div>Facility: <strong>${b.court_name}</strong></div>
            <div>Time Slot: <strong>${b.start_time} - ${b.end_time}</strong> ($${b.price.toFixed(2)})</div>
            ${b.wallet_applied > 0 ? `<div>Paid with Wallet: <strong>-$${b.wallet_applied.toFixed(2)}</strong> (Net Paid: $${b.net_paid.toFixed(2)})</div>` : ''}
            <div style="margin-top: 4px;">
              Reward: <strong>${isConfirmed ? `+` : `[Reversed] `}$${b.reward_amount.toFixed(2)} (${b.reward_percent}%)</strong>
            </div>
          </div>

          ${isConfirmed ? (isPastGame ? `
            <div style="margin-top:8px; padding:6px 10px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:4px; font-size:0.75rem; color:#4b5563; text-align:center;">
              &#10003; <strong>Game Completed</strong> &bull; Past reservations cannot be edited or cancelled.
            </div>
          ` : `
            <div style="display:flex; gap:6px; margin-top:8px;">
              <button class="wf-btn wf-btn-secondary wf-btn-sm btn-edit-booking" data-id="${b.id}" style="flex:1;">
                Edit / Reschedule
              </button>
              <button class="wf-btn wf-btn-danger wf-btn-sm btn-cancel-booking" data-id="${b.id}" style="flex:1;">
                Cancel Slot
              </button>
            </div>
          `) : `
            <div style="margin-top: 6px; padding: 8px; border: 1px dashed var(--bw-border); border-radius: 4px; background: var(--bw-gray-100); font-size: 0.78rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong>Refund Status:</strong>
                ${b.refund_status === 'REFUNDED' 
                  ? `<span class="wf-pill" style="background:#000; color:#fff;">Refunded $${Number(b.refund_amount || 0).toFixed(2)}</span>` 
                  : `<span class="wf-pill" style="border-style:dashed;">Pending Admin Review</span>`}
              </div>
              ${b.refund_status === 'REFUNDED' 
                ? `<div style="color:var(--bw-gray-700);">${b.admin_refund_note ? `Admin Note: "${b.admin_refund_note}"` : 'Refund credited to your wallet balance.'}</div>` 
                : `<div style="color:var(--bw-gray-700);">Slot cancelled ${b.hours_before_slot != null ? `(${b.hours_before_slot}h before slot)` : ''}. Admin will manually review & disburse refund.</div>`}
            </div>
          `}
        </div>
      `;
    }).join("");

    // Bind Edit & Cancel Buttons
    container.querySelectorAll(".btn-edit-booking").forEach(btn => {
      btn.addEventListener("click", () => this.openEditModal(Number(btn.dataset.id)));
    });

    container.querySelectorAll(".btn-cancel-booking").forEach(btn => {
      btn.addEventListener("click", () => this.openCancelModal(Number(btn.dataset.id)));
    });
  }

  // ==========================================
  // EDIT MODAL ACTIONS (ENFORCES ADMIN X-HOUR CUTOFF RULE)
  // ==========================================
  async openEditModal(bookingId) {
    this.activeEditBookingId = bookingId;
    const booking = await window.api.getBookingById(bookingId);
    if (!booking) return;

    // Check slot change cutoff window (X hours before slot)
    const check = await window.api.checkRescheduleEligibility(booking);

    document.getElementById("edit-modal-meta").textContent = 
      `Booking #${booking.id} (${booking.sport_name} - ${booking.court_name} on ${booking.date} at ${booking.start_time})`;

    const dateInput = document.getElementById("edit-date-input");
    dateInput.value = booking.date;
    dateInput.min = this.getTodayDateString();

    const rulePill = document.getElementById("reschedule-modal-rule-pill");
    const timingMeta = document.getElementById("reschedule-modal-timing-meta");
    const submitBtn = document.getElementById("btn-submit-edit");
    const noticeBox = document.getElementById("reschedule-cutoff-notice");

    if (rulePill) rulePill.textContent = `${check.cutoffHours}h Policy`;

    if (check.isEligible) {
      if (noticeBox) noticeBox.style.borderColor = "var(--bw-black)";
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:green; font-weight:700;">&#10003; Slot Change Allowed:</span> ${check.diffHours} hrs remaining before slot start (Cutoff rule: &ge; ${check.cutoffHours} hrs).`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Rescheduled Slot";
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
      }
    } else {
      if (noticeBox) noticeBox.style.borderColor = "#c00";
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:#c00; font-weight:700;">&#9888; Slot Change Window Expired:</span> Only ${check.diffHours > 0 ? check.diffHours + ' hrs' : '0 hrs (past)'} remaining. Facility policy requires at least <strong>${check.cutoffHours} hours</strong> notice before slot to reschedule.<br><small style="color:#555; display:block; margin-top:3px;">You can still browse dates/slots below. To allow reschedule, adjust cutoff in Admin Rules Engine.</small>`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Locked (< ${check.cutoffHours}h Rule)`;
        submitBtn.style.opacity = "0.4";
        submitBtn.style.cursor = "not-allowed";
      }
    }
    dateInput.disabled = false; // Always allow user to browse and select other dates

    const adminRatio = await window.api.getWalletUpgradeRatio();
    const adminRewardRate = await window.api.getRewardRate();

    const updatePriceBreakdown = (selectedSlot) => {
      const breakdownBox = document.getElementById("edit-price-breakdown");
      if (!breakdownBox || !selectedSlot) return;

      const currPrice = Number(booking.price);
      const newPrice = Number(selectedSlot.price);
      const diff = Number((newPrice - currPrice).toFixed(2));

      document.getElementById("edit-curr-price").textContent = `$${currPrice.toFixed(2)}`;
      document.getElementById("edit-new-price").textContent = `$${newPrice.toFixed(2)}`;
      document.getElementById("edit-admin-ratio").textContent = `${adminRatio}%`;

      if (diff === 0) {
        breakdownBox.style.display = "none";
        submitBtn.textContent = "Save Rescheduled Slot (No Fee Change)";
        return;
      }

      breakdownBox.style.display = "block";
      const userBal = Number(this.currentUser?.wallet_balance || 0);

      if (diff > 0) {
        // Price increased (e.g. from $20 to $35 => +$15)
        const maxWalletCut = Number(((diff * adminRatio) / 100).toFixed(2));
        const walletCut = Math.min(userBal, maxWalletCut);
        const netPayable = Number((diff - walletCut).toFixed(2));

        const oldReward = Number(booking.reward_amount || 0);
        const newReward = Number(((newPrice * adminRewardRate) / 100).toFixed(2));
        const rewardDelta = Number((newReward - oldReward).toFixed(2));

        document.getElementById("edit-price-diff").textContent = `+$${diff.toFixed(2)} (Upgrade)`;
        document.getElementById("edit-wallet-cut").textContent = `-$${walletCut.toFixed(2)} (Wallet Bal: $${userBal.toFixed(2)})`;
        document.getElementById("edit-net-payable").textContent = `$${netPayable.toFixed(2)}`;
        document.getElementById("edit-reward-delta").textContent = `+$${rewardDelta.toFixed(2)} (${adminRewardRate}% reward)`;

        if (walletCut >= diff) {
          submitBtn.textContent = `Confirm Upgrade (-$${walletCut.toFixed(2)} from Wallet)`;
        } else if (walletCut > 0) {
          submitBtn.textContent = `Confirm (-$${walletCut.toFixed(2)} Wallet + $${netPayable.toFixed(2)} Pay)`;
        } else {
          submitBtn.textContent = `Confirm Upgrade (Pay $${diff.toFixed(2)})`;
        }
      } else {
        // Cheaper slot (e.g. $35 down to $20 => -$15)
        const refundAmt = Math.abs(diff);
        document.getElementById("edit-price-diff").textContent = `-$${refundAmt.toFixed(2)} (Downgrade)`;
        document.getElementById("edit-wallet-cut").textContent = `+$${refundAmt.toFixed(2)} (Refund to Wallet)`;
        document.getElementById("edit-net-payable").textContent = `$0.00`;
        document.getElementById("edit-reward-delta").textContent = `Adjusted`;
        submitBtn.textContent = `Confirm Reschedule (Refund +$${refundAmt.toFixed(2)} to Wallet)`;
      }
    };

    const loadSlots = async () => {
      const slotsContainer = document.getElementById("edit-slots-container");
      const slots = await window.api.getSlots(booking.court_id, dateInput.value);
      
      slotsContainer.innerHTML = slots.map(s => {
        if (s.is_past) {
          return `
            <div class="slot-box unavailable" title="Time slot has already passed" style="background:#f3f4f6; border:1px dashed #bbb; color:#9ca3af; cursor:not-allowed; opacity:0.65;">
              <span class="slot-time" style="text-decoration:line-through;">${s.start_time}</span>
              <span class="slot-price" style="font-size:0.62rem; color:#6b7280;">[Past]</span>
            </div>
          `;
        }
        if (s.is_unavailable) {
          return `
            <div class="slot-box unavailable" title="${s.unavailability_reason || 'Court/Academy Unavailable'}" style="background:#f5f5f5; border:1px dashed #aaa; color:#888; cursor:not-allowed; opacity:0.8;">
              <span class="slot-time" style="text-decoration:line-through;">${s.start_time}</span>
              <span class="slot-price" style="font-size:0.65rem; color:#c00;">[Blocked]</span>
            </div>
          `;
        }
        if (s.is_booked && s.id !== booking.slot_id) {
          return `<div class="slot-box booked"><span class="slot-time">${s.start_time}</span><span class="slot-price">[Booked]</span></div>`;
        }
        const isSelected = s.id === booking.slot_id;
        return `
          <div class="slot-box ${isSelected ? "selected" : ""}" data-slot-id="${s.id}">
            <span class="slot-time">${s.start_time}</span>
            <span class="slot-price">$${s.price.toFixed(2)}</span>
          </div>
        `;
      }).join("");

      // Trigger initial breakdown calculation
      const initialSlot = slots.find(s => s.id === this.activeEditSlotId);
      if (initialSlot && !initialSlot.is_unavailable) updatePriceBreakdown(initialSlot);

      slotsContainer.querySelectorAll(".slot-box:not(.booked):not(.unavailable)").forEach(box => {
        box.addEventListener("click", () => {
          slotsContainer.querySelectorAll(".slot-box").forEach(b => b.classList.remove("selected"));
          box.classList.add("selected");
          this.activeEditSlotId = Number(box.dataset.slotId);
          const picked = slots.find(s => s.id === this.activeEditSlotId);
          if (picked) updatePriceBreakdown(picked);
        });
      });
    };

    this.activeEditSlotId = booking.slot_id;
    await loadSlots();

    dateInput.onchange = async () => await loadSlots();

    document.getElementById("modal-edit-booking")?.classList.add("active");
  }

  closeEditModal() {
    document.getElementById("modal-edit-booking")?.classList.remove("active");
    this.activeEditBookingId = null;
  }

  async handleSaveEditedBooking() {
    if (!this.activeEditBookingId || !this.activeEditSlotId) {
      alert("Please select a slot.");
      return;
    }
    const newDate = document.getElementById("edit-date-input").value;
    try {
      const res = await window.api.updateBooking(this.activeEditBookingId, newDate, this.activeEditSlotId);
      this.currentUser.wallet_balance = res.updatedWallet;
      this.updateUserHeaderPill();
      this.closeEditModal();

      let toastMsg = `Booking #${res.booking.id} rescheduled!`;
      if (res.walletCut > 0) {
        toastMsg += ` Cut $${res.walletCut.toFixed(2)} from wallet.`;
      }
      if (res.netPayable > 0) {
        toastMsg += ` Net paid: $${res.netPayable.toFixed(2)}.`;
      }
      if (res.priceDelta < 0) {
        toastMsg += ` Refunded $${Math.abs(res.priceDelta).toFixed(2)} to wallet.`;
      }
      this.showToast(toastMsg);
      await this.renderBookingsList();
    } catch (err) {
      alert(err.message);
    }
  }

  // ==========================================
  // CANCEL MODAL ACTIONS
  // ==========================================
  async openCancelModal(bookingId) {
    this.activeCancelBookingId = bookingId;
    const booking = await window.api.getBookingById(bookingId);
    if (!booking) return;

    // Check cancellation cutoff window
    const check = await window.api.checkCancellationEligibility(booking);

    document.getElementById("cancel-modal-title").textContent = 
      `Booking #${booking.id} (${booking.sport_name} - ${booking.court_name} on ${booking.date} at ${booking.start_time})`;
    document.getElementById("cancel-modal-reward").textContent = 
      `-$${booking.reward_amount.toFixed(2)} (${booking.reward_percent}%)`;

    const rulePill = document.getElementById("cancel-modal-rule-pill");
    const timingMeta = document.getElementById("cancel-modal-timing-meta");
    const submitBtn = document.getElementById("btn-submit-cancel");
    const noticeBox = document.getElementById("cancel-cutoff-notice");

    if (rulePill) rulePill.textContent = `${check.cutoffHours}h Policy`;

    if (check.isEligible) {
      if (noticeBox) noticeBox.style.borderColor = "var(--bw-black)";
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:green; font-weight:700;">&#10003; Cancellation Allowed:</span> ${check.diffHours} hrs remaining before slot start (Policy: &ge; ${check.cutoffHours} hrs).<br><span style="display:inline-block; margin-top:3px;"><strong>Policy Refund Rate:</strong> ${check.defaultRefundPct}% ($${check.estimatedRefund.toFixed(2)} refund to wallet).</span>`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `Confirm Cancellation (Refund: $${check.estimatedRefund.toFixed(2)})`;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
      }
    } else {
      if (noticeBox) noticeBox.style.borderColor = "#c00";
      if (timingMeta) {
        timingMeta.innerHTML = `<span style="color:#c00; font-weight:700;">&#9888; Cancellation Window Expired:</span> Only ${check.diffHours > 0 ? check.diffHours + ' hrs' : '0 hrs (past)'} remaining. Facility policy requires at least <strong>${check.cutoffHours} hours</strong> notice before slot.`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Locked (< ${check.cutoffHours}h Rule)`;
        submitBtn.style.opacity = "0.4";
        submitBtn.style.cursor = "not-allowed";
      }
    }

    document.getElementById("modal-cancel-booking")?.classList.add("active");
  }

  closeCancelModal() {
    document.getElementById("modal-cancel-booking")?.classList.remove("active");
    this.activeCancelBookingId = null;
  }

  async handleConfirmCancellation() {
    if (!this.activeCancelBookingId) return;
    try {
      const res = await window.api.cancelBooking(this.activeCancelBookingId);
      this.currentUser.wallet_balance = res.updatedWallet;
      this.updateUserHeaderPill();
      this.closeCancelModal();
      this.showToast(`Booking #${res.booking.id} cancelled. Reward reversed.`);
      await this.renderBookingsList();
    } catch (err) {
      alert(err.message);
    }
  }

  // ==========================================
  // SCREEN 8: WALLET & REWARDS LEDGER
  // ==========================================
  async renderWallet() {
    const balDisplay = document.getElementById("wallet-balance-display");
    const container = document.getElementById("wallet-history-container");
    if (!balDisplay || !container) return;

    if (!this.currentUser) {
      balDisplay.textContent = "$0.00";
      container.innerHTML = `<p class="wf-meta">Please sign in to view rewards.</p>`;
      return;
    }

    // Refresh user balance from IndexedDB
    const user = await window.api.getUser(this.currentUser.id);
    this.currentUser = user;
    this.updateUserHeaderPill();

    balDisplay.textContent = `$${user.wallet_balance.toFixed(2)}`;

    // Load Wallet Expiry Summary
    const summary = await window.api.getUserWalletSummary(user.id);
    const pill = document.getElementById("wallet-validity-pill");
    const expiryText = document.getElementById("wallet-expiry-text");
    if (pill && summary) pill.textContent = `${summary.expiryDays} Days Policy`;
    if (expiryText && summary) {
      if (summary.earliestExpiry) {
        expiryText.innerHTML = `<span>&#9200; <strong>$${summary.earliestExpiringAmount.toFixed(2)}</strong> expires on <strong>${new Date(summary.earliestExpiry).toLocaleDateString()}</strong> (${summary.daysLeft} days remaining).</span>`;
      } else {
        expiryText.innerHTML = `<span>All cashback rewards are valid for <strong>${summary.expiryDays} days</strong> from date of credit.</span>`;
      }
    }

    const ledger = await window.api.getWalletLedger(user.id);
    if (ledger.length === 0) {
      container.innerHTML = `<p class="wf-meta" style="padding:10px 0;">No reward transactions yet.</p>`;
      return;
    }

    container.innerHTML = ledger.map(l => {
      const isPositive = l.amount >= 0;
      let expiryLabel = "";
      if (l.amount > 0 && l.expires_at) {
        const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000);
        expiryLabel = `<small style="color:var(--bw-gray-700); display:block;">Expires: ${new Date(l.expires_at).toLocaleDateString()} (${daysLeft > 0 ? `${daysLeft}d left` : 'Expired'})</small>`;
      }

      return `
        <div class="ledger-row">
          <div>
            <strong style="display:block;">${l.description}</strong>
            <small class="wf-meta">${new Date(l.created_at).toLocaleDateString()} &bull; ${l.type}</small>
            ${expiryLabel}
          </div>
          <span class="ledger-amount" style="color: #000;">
            ${isPositive ? `+` : ``}$${l.amount.toFixed(2)}
          </span>
        </div>
      `;
    }).join("");
  }
}

// Bootstrap Application on DOM Ready
window.addEventListener("DOMContentLoaded", () => {
  window.app = new MobileWireframeApp();
  window.app.init();
});
