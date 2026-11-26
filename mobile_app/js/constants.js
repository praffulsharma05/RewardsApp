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
    WELCOME_BONUS_AMOUNT: 10,
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
    PRICING_UPDATED: (sport, count, price) => `Price: ₹${price}`,
    SLOT_PRICE_UPDATED: (sport, start, end, price) => `Price: ₹${price}`,
    FACILITY_REOPENED_TODAY: "Facility opened!",
    BLACKOUT_REOPENED: "Blackout cleared!",
    UNBLOCKED_COURT: "Court unblocked!",
    REWARD_RATE_SAVED: (rate) => `Reward: ${rate}%`,
    REWARD_EXPIRY_SAVED: (days) => `Expiry: ${days}d`,
    WELCOME_BONUS_SAVED: (amt) => `Welcome Bonus: ₹${amt}`,
    ADMIN_UPI_SAVED: (upi) => "UPI saved!",
    CUTOFF_SAVED: (hours) => `Cutoff: ${hours}h`,
    RESCHEDULE_CUTOFF_SAVED: (hours) => `Cutoff: ${hours}h`,
    UPGRADE_RATIO_SAVED: (ratio) => `Ratio: ${ratio}%`,
    REFUND_RATE_SAVED: (rate) => `Refund: ${rate}%`,
    REFUND_SENT: (amount, userTarget) => `Refund: ₹${Number(amount).toFixed(0)}`,
    SPORT_ADDED: (id, name) => `${name} added!`,
    SPORT_UPDATED: (id, name) => `${name} updated!`,
    SPORT_DELETED: (id) => "Sport deleted!",
    USER_REMOVED: (id) => "User removed!",
    ADMIN_BOOKING_CREATED: (userName) => `Slot booked for ${userName}!`,
    CLOSED_DATE_MARKED: (date, label, reason) => "Marked closed!",
    GROUND_BLOCKED: (target, start, end) => "Court blocked!",

    // User App Notifications
    BOOKING_CONFIRMED: "Slot booked!",
    BOOKING_CANCELLED: "Booking cancelled!",
    BOOKING_RESCHEDULED: "Slot rescheduled!",
    WALLET_TOPPED_UP: (amt) => `+₹${amt} to wallet!`,
    ACCOUNT_CREATED: "Account created!",
    SIGNED_IN: "Signed in!",
    SIGNED_OUT: "Signed out!"
  }
});

// Attach to window so all modules can access globally
window.APP_CONSTANTS = APP_CONSTANTS;
