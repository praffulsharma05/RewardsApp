/**
 * admin.js - Sports Slot Mobile Admin App Entry Point
 * Orchestrates and bootstraps the MobileAdminApp instance
 */

const bootstrapAdmin = async () => {
  if (typeof MobileAdminApp !== "undefined") {
    window.adminApp = new MobileAdminApp();
    await window.adminApp.init();
  }
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootstrapAdmin);
} else {
  bootstrapAdmin();
}

