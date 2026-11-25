/**
 * constants.js - Centralized Application Constants & Strings
 * All constant values, system defaults, status enums, UI labels,
 * and user-facing notifications are maintained here.
 */

const APP_CONSTANTS = Object.freeze({
  DB: {
    NAME: "SportsSlotWireframeDB",
    VERSION: 1,
    STORES: {
      SETTINGS: "settings",
      USERS: "users",
      SPORTS: "sports",
      COURTS: "courts",
      SLOTS: "slots",
      BOOKINGS: "bookings",
      PRICING_RULES: "pricing_rules",
      CLOSED_DATES: "closed_dates",
      UNAVAILABILITY_RULES: "unavailability_rules"
    }
  },

  DEFAULTS: {
    CANCELLATION_CUTOFF_HOURS: 12,
    RESCHEDULE_CUTOFF_HOURS: 6,
    MAX_DISCOUNT_PERCENT: 30,
    REWARD_RATE_PERCENT: 10,
    REWARD_EXPIRY_DAYS: 60,
    UPGRADE_RATIO_PERCENT: 100,
    REFUND_PERCENT: 100,
    CLOSE_START_TIME: "10:00",
    CLOSE_END_TIME: "14:00",
    UNAVAIL_START_TIME: "10:00",
    UNAVAIL_END_TIME: "17:00"
  },

  STATUS: {
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED",
    RESCHEDULED: "RESCHEDULED"
  },

  DAY_TYPES: {
    ALL: "ALL",
    WEEKDAY: "WEEKDAY",
    WEEKEND: "WEEKEND"
  },

  UI: {
    EXPAND_ALL: "Expand All",
    COLLAPSE_ALL: "Collapse All",
    FILTER_ALL: "ALL",
    FILTER_CONFIRMED: "CONFIRMED",
    FILTER_CANCELLED: "CANCELLED"
  },

  MESSAGES: {
    // Admin Notifications
    REFRESHED: "Refreshed",
    PRICING_UPDATED: (sport, count, price) => `${sport}: Updated ${count} slot${count === 1 ? "" : "s"} to $${price}`,
    SLOT_PRICE_UPDATED: (sport, start, end, price) => `${sport} (${start}-${end}): Set to $${price}`,
    FACILITY_REOPENED_TODAY: "Facility re-opened today!",
    BLACKOUT_REOPENED: "Blackout re-opened for bookings!",
    UNBLOCKED_COURT: "Unblocked court/academy time window!",
    REWARD_RATE_SAVED: (rate) => `Reward rate set to ${rate}%!`,
    REWARD_EXPIRY_SAVED: (days) => `Reward validity set to ${days} Days!`,
    CUTOFF_SAVED: (hours) => `Cancellation cutoff set to ${hours} Hours!`,
    RESCHEDULE_CUTOFF_SAVED: (hours) => `Slot change cutoff set to ${hours} Hours!`,
    UPGRADE_RATIO_SAVED: (ratio) => `Wallet upgrade ratio set to ${ratio}%!`,
    REFUND_RATE_SAVED: (rate) => `Default refund rate set to ${rate}%!`,
    REFUND_SENT: (amount, userTarget) => `Refund sent: $${amount.toFixed(2)} to ${typeof userTarget === 'number' ? `User #${userTarget}` : userTarget}!`,
    SPORT_ADDED: (id, name) => `New Sport #${id} (${name}) added!`,
    SPORT_UPDATED: (id, name) => `Sport #${id} (${name}) updated!`,
    SPORT_DELETED: (id) => `Sport #${id} and associated courts deleted.`,
    USER_REMOVED: (id) => `User #${id} removed successfully.`,
    CLOSED_DATE_MARKED: (date, label, reason) => `Marked ${date} [${label}] as Closed (${reason})!`,
    GROUND_BLOCKED: (target, start, end) => `Blocked ${target} [${start} - ${end}]!`,

    // User App Notifications
    BOOKING_CONFIRMED: "Booking confirmed successfully!",
    BOOKING_CANCELLED: "Booking cancelled and refunded to wallet.",
    BOOKING_RESCHEDULED: "Booking rescheduled successfully!",
    WALLET_TOPPED_UP: (amt) => `Added $${amt} to wallet!`,
    ACCOUNT_CREATED: "Player account created successfully!",
    SIGNED_IN: "Signed in successfully!",
    SIGNED_OUT: "Signed out successfully."
  }
});

// Attach to window so all modules can access globally
window.APP_CONSTANTS = APP_CONSTANTS;
