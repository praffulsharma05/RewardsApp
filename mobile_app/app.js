/**
 * app.js - Sports Slot Mobile App Entry Point
 * Orchestrates and bootstraps the MobileWireframeApp instance
 */

// Initialize and bootstrap application on DOM ready
window.addEventListener("DOMContentLoaded", () => {
  if (typeof MobileWireframeApp !== "undefined") {
    window.app = new MobileWireframeApp();
  }
});
