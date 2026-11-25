/**
 * admin_games.js - Game Categories, Courts Management, and Modals
 */
Object.assign(MobileAdminApp.prototype, {
  // ==========================================
  // SCREEN 2: GAMES (ADD, UPDATE, DELETE)
  // ==========================================
  async renderGamesList() {
    const container = document.getElementById("admin-games-list-container");
    if (!container) return;

    const sports = await window.api.getSports();

    if (sports.length === 0) {
      container.innerHTML = `<div class="wf-card"><p class="wf-meta">No sports in database. Click '+ Add Sport' above.</p></div>`;
      return;
    }

    container.innerHTML = sports.map(s => `
      <div class="game-admin-card" data-sport-id="${s.id}">
        <div class="game-admin-card-header">
          <div style="display:flex; align-items:center; gap: 8px;">
            <span class="game-icon-tag">${(s.icon || 'SP').replace(/[\[\]]/g, '')}</span>
            <div>
              <strong style="font-size:0.9rem;">${s.name}</strong>
              <small class="wf-meta" style="display:block;">${s.category} &bull; ${s.courts_count} Courts</small>
            </div>
          </div>
          <span class="wf-meta" style="font-family:var(--font-mono); font-size:0.75rem;">ID: #${s.id}</span>
        </div>

        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="wf-btn wf-btn-secondary wf-btn-sm btn-edit-sport" data-id="${s.id}" style="flex:1;">
            Edit Sport
          </button>
          <button class="wf-btn wf-btn-danger wf-btn-sm btn-delete-sport" data-id="${s.id}" style="flex:1;">
            Delete Sport
          </button>
        </div>
      </div>
    `).join("");

    // Bind Edit and Delete Buttons
    container.querySelectorAll(".btn-edit-sport").forEach(btn => {
      btn.addEventListener("click", () => this.openEditGameModal(Number(btn.dataset.id)));
    });

    container.querySelectorAll(".btn-delete-sport").forEach(btn => {
      btn.addEventListener("click", () => this.openDeleteGameModal(Number(btn.dataset.id)));
    });
  },

  // Open Modal to Add Game
  openAddGameModal() {
    document.getElementById("modal-game-form-title").textContent = "Add New Game / Sport";
    document.getElementById("game-edit-id").value = "";
    document.getElementById("game-input-name").value = "";
    document.getElementById("game-input-category").value = "Indoor";
    document.getElementById("game-input-courts").value = 2;
    document.getElementById("game-input-icon").value = "SP";
    document.getElementById("btn-save-game-submit").textContent = "Create Sport in Database";
    document.getElementById("modal-game-form")?.classList.add("active");
  },

  // Open Modal to Edit Game
  async openEditGameModal(sportId) {
    const sport = await window.api.getSportById(sportId);
    if (!sport) return;

    document.getElementById("modal-game-form-title").textContent = `Edit Sport #${sport.id}`;
    document.getElementById("game-edit-id").value = sport.id;
    document.getElementById("game-input-name").value = sport.name;
    document.getElementById("game-input-category").value = sport.category || "Indoor";
    document.getElementById("game-input-courts").value = sport.courts_count || 2;
    document.getElementById("game-input-icon").value = (sport.icon || "SP").replace(/[\[\]]/g, "");
    document.getElementById("btn-save-game-submit").textContent = "Save Changes";
    document.getElementById("modal-game-form")?.classList.add("active");
  },

  closeGameModal() {
    document.getElementById("modal-game-form")?.classList.remove("active");
  },

  // Save Game (Add or Update)
  async handleSaveGame() {
    const editId = document.getElementById("game-edit-id").value;
    const name = document.getElementById("game-input-name").value.trim();
    const category = document.getElementById("game-input-category").value;
    const courts_count = Number(document.getElementById("game-input-courts").value);
    const icon = document.getElementById("game-input-icon").value.trim().replace(/[\[\]]/g, "") || "SP";

    if (!name) {
      alert("Please provide a sport name.");
      return;
    }

    try {
      if (editId) {
        // Update existing game
        await window.api.updateSport(editId, { name, category, courts_count, icon });
        this.showToast(APP_CONSTANTS.MESSAGES.SPORT_UPDATED(editId, name));
      } else {
        // Add new game
        const created = await window.api.addSport({ name, category, courts_count, icon });
        this.showToast(APP_CONSTANTS.MESSAGES.SPORT_ADDED(created.id, name));
      }

      this.closeGameModal();
      await this.renderGamesList();
      await this.populateUnavailabilityCourts();
      await this.refreshOverview();
    } catch (err) {
      alert(err.message);
    }
  },

  // Open Delete Confirmation Modal
  async openDeleteGameModal(sportId) {
    this.pendingDeleteSportId = sportId;
    const sport = await window.api.getSportById(sportId);
    if (!sport) return;

    document.getElementById("delete-game-name").textContent = `${sport.name} (ID #${sport.id})`;
    document.getElementById("modal-delete-game")?.classList.add("active");
  },

  closeDeleteModal() {
    document.getElementById("modal-delete-game")?.classList.remove("active");
    this.pendingDeleteSportId = null;
  },

  // Confirm Delete Game
  async handleConfirmDeleteSport() {
    if (!this.pendingDeleteSportId) return;

    try {
      await window.api.deleteSport(this.pendingDeleteSportId);
      this.showToast(APP_CONSTANTS.MESSAGES.SPORT_DELETED(this.pendingDeleteSportId));
      this.closeDeleteModal();
      await this.renderGamesList();
      await this.populateUnavailabilityCourts();
      await this.refreshOverview();
    } catch (err) {
      alert(err.message);
    }
  }

});
