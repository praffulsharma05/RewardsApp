/**
 * db.js - IndexedDB Mock API Layer for Mobile Slot Booking Wireframe
 * Aggregates all modular sub-services into window.api
 */

// Global API singleton instance
if (typeof MockAPI !== "undefined") {
  window.api = new MockAPI();
}
