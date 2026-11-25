/**
 * admin.js - Sports Slot Mobile Admin App Entry Point
 * Orchestrates and bootstraps the MobileAdminApp instance
 */

// Initialize and bootstrap admin application on DOM ready
window.addEventListener("DOMContentLoaded", () => {
  if (typeof MobileAdminApp !== "undefined") {
    window.adminApp = new MobileAdminApp();
  }
});
