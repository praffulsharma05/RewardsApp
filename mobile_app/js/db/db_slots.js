/**
 * db_slots.js - Slot Availability and Dynamic Day-Wise Schedule Query
 */
Object.assign(MockAPI.prototype, {
  _getDateRange(startDateStr, daysCount = 30) {
    const parts = startDateStr.split("-").map(Number);
    const dates = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
    return dates;
  },

  _isBookingActiveOnDate(booking, dateStr, slotId = null) {
    if (!booking || booking.status !== "CONFIRMED") return false;
    if (booking.booking_type !== "MONTHLY") {
      return booking.date === dateStr && (slotId == null || Number(booking.slot_id) === Number(slotId));
    }
    if (Array.isArray(booking.added_dates)) {
      const addedMatch = booking.added_dates.some(a =>
        a.date === dateStr && (slotId == null || Number(a.slot_id) === Number(slotId))
      );
      if (addedMatch) return true;
    }
    if (Array.isArray(booking.skipped_dates) && booking.skipped_dates.includes(dateStr)) {
      return false;
    }
    if (booking.end_date && dateStr >= booking.date && dateStr <= booking.end_date) {
      return slotId == null || Number(booking.slot_id) === Number(slotId);
    }
    return false;
  },

  getMonthlyActiveDates(booking) {
    if (!booking || booking.booking_type !== "MONTHLY") return [];
    const baseDates = this._getDateRange(booking.date, Number(booking.duration_days || 30));
    const skipped = new Set(Array.isArray(booking.skipped_dates) ? booking.skipped_dates : []);
    const active = [];
    for (const d of baseDates) {
      if (!skipped.has(d)) {
        active.push({
          date: d,
          slot_id: booking.slot_id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          is_rescheduled: false
        });
      }
    }
    if (Array.isArray(booking.added_dates)) {
      for (const a of booking.added_dates) {
        active.push({
          date: a.date,
          slot_id: a.slot_id,
          start_time: a.start_time,
          end_time: a.end_time,
          original_date: a.original_date,
          is_rescheduled: true
        });
      }
    }
    return active.sort((a, b) => a.date.localeCompare(b.date));
  },

  _resolveSlotDailyPrice(slot, dateStr) {
    const parts = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const price = isWeekend
      ? (slot.weekend_price != null ? Number(slot.weekend_price) : Math.round(Number(slot.price) * 1.3))
      : (slot.weekday_price != null ? Number(slot.weekday_price) : Number(slot.price));
    return { price, isWeekend };
  },

  _calculateMonthlySlotPricing(slot, startDateStr, monthlyConfig) {
    const daysCount = Number(monthlyConfig?.daysCount || 30);
    const defaultDiscountPct = Number(monthlyConfig?.discountPercent ?? 15);
    const dates = this._getDateRange(startDateStr, daysCount);
    const endDate = dates[dates.length - 1];

    let regularPrice = 0;
    for (const d of dates) {
      regularPrice += this._resolveSlotDailyPrice(slot, d).price;
    }
    regularPrice = Number(regularPrice.toFixed(2));

    let discountedPrice = 0;
    let discountPercent = defaultDiscountPct;
    let isCustomMonthlyPrice = false;

    if (slot.monthly_price != null && Number(slot.monthly_price) > 0) {
      discountedPrice = Number(Number(slot.monthly_price).toFixed(2));
      isCustomMonthlyPrice = true;
      discountPercent = regularPrice > 0
        ? Math.max(0, Math.round(((regularPrice - discountedPrice) / regularPrice) * 100))
        : 0;
    } else {
      discountedPrice = Number((regularPrice * (1 - defaultDiscountPct / 100)).toFixed(2));
    }

    const discountAmount = Number(Math.max(0, regularPrice - discountedPrice).toFixed(2));

    return {
      dates,
      startDate: startDateStr,
      endDate,
      daysCount,
      regularPrice,
      discountedPrice,
      discountPercent,
      discountAmount,
      isCustomMonthlyPrice
    };
  },

  // Slots & Availability API (Resolves Day-Wise Pricing, blocks Past Slots, and checks Playground & Academy Unavailability)
  async getSlots(courtId, dateStr) {
    await this._simulateDelay(60);
    const allSlots = await this._getAll("slots");
    const courtSlots = allSlots.filter(s => s.court_id === Number(courtId));

    const allBookings = await this._getAll("bookings");
    const courtBookings = allBookings.filter(b =>
      b.court_id === Number(courtId) && b.status === "CONFIRMED"
    );

    const bookedSlotIds = new Set();
    for (const s of courtSlots) {
      if (courtBookings.some(b => this._isBookingActiveOnDate(b, dateStr, s.id))) {
        bookedSlotIds.add(s.id);
      }
    }

    // Current Date and Time in local timezone for past slot checks
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const results = [];
    for (const s of courtSlots) {
      const { price: resolvedPrice, isWeekend } = this._resolveSlotDailyPrice(s, dateStr);

      // Check if slot has already passed
      const isPast = (dateStr < todayStr) || (dateStr === todayStr && s.start_time <= currentHourMin);

      const unavail = await this.checkSlotUnavailability(courtId, dateStr, s.start_time, s.end_time);
      const closedCheck = await this.isDateClosed(dateStr, s.start_time, s.end_time);

      const isUnavailable = isPast || unavail.isUnavailable || closedCheck.isClosed;
      let unavailReason = "";
      if (isPast) {
        unavailReason = "Time slot has already passed";
      } else if (unavail.isUnavailable) {
        unavailReason = unavail.reason;
      } else if (closedCheck.isClosed) {
        unavailReason = `Facility Closed (${closedCheck.reason})`;
      }

      results.push({
        ...s,
        price: resolvedPrice,
        day_type: isWeekend ? "WEEKEND" : "WEEKDAY",
        is_past: isPast,
        is_booked: bookedSlotIds.has(s.id),
        is_unavailable: isUnavailable,
        unavailability_reason: unavailReason
      });
    }

    return results;
  },

  // Monthly Pass Slots & Availability API (Checks all N days in the month window)
  async getMonthlySlots(courtId, startDateStr) {
    await this._simulateDelay(70);
    const monthlyConfig = await this.getMonthlyBookingConfig();
    const allSlots = await this._getAll("slots");
    const courtSlots = allSlots.filter(s => s.court_id === Number(courtId));

    const allBookings = await this._getAll("bookings");
    const courtBookings = allBookings.filter(b => b.court_id === Number(courtId) && b.status === "CONFIRMED");

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const results = [];
    for (const s of courtSlots) {
      const pricing = this._calculateMonthlySlotPricing(s, startDateStr, monthlyConfig);
      const isPast = (startDateStr < todayStr) || (startDateStr === todayStr && s.start_time <= currentHourMin);

      let conflictDays = 0;
      let unavailReason = "";
      if (isPast) {
        unavailReason = "Start time has already passed";
      } else {
        for (const d of pricing.dates) {
          const hasBooking = courtBookings.some(b => this._isBookingActiveOnDate(b, d, s.id));
          if (hasBooking) {
            conflictDays++;
            continue;
          }
          const unavail = await this.checkSlotUnavailability(courtId, d, s.start_time, s.end_time);
          if (unavail.isUnavailable && !unavailReason) {
            unavailReason = unavail.reason;
          }
        }
      }

      results.push({
        ...s,
        regular_price: pricing.regularPrice,
        price: pricing.discountedPrice,
        discount_percent: pricing.discountPercent,
        discount_amount: pricing.discountAmount,
        is_custom_monthly_price: pricing.isCustomMonthlyPrice,
        start_date: pricing.startDate,
        end_date: pricing.endDate,
        days_count: pricing.daysCount,
        is_past: isPast,
        is_booked: conflictDays > 0,
        conflict_days: conflictDays,
        is_unavailable: isPast || Boolean(unavailReason),
        unavailability_reason: unavailReason
      });
    }

    return results;
  }

});
