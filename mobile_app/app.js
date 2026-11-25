/**
 * app.js - Sports Slot Mobile App Entry Point
 * Orchestrates and bootstraps the MobileWireframeApp instance
 */

const bootstrapApp = async () => {
  if (typeof MobileWireframeApp !== "undefined") {
    window.app = new MobileWireframeApp();
    await window.app.init();
  }
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootstrapApp);
} else {
  bootstrapApp();
}

