/**
 * db_slots.js - Slot Availability and Dynamic Day-Wise Schedule Query
 */
Object.assign(MockAPI.prototype, {
  // Slots & Availability API (Resolves Day-Wise Pricing, blocks Past Slots, and checks Playground & Academy Unavailability)
  async getSlots(courtId, dateStr) {
    await this._simulateDelay(60);
    const allSlots = await this._getAll("slots");
    const courtSlots = allSlots.filter(s => s.court_id === Number(courtId));

    const allBookings = await this._getAll("bookings");
    const activeBookings = allBookings.filter(b => 
      b.court_id === Number(courtId) && 
      b.date === dateStr && 
      b.status === "CONFIRMED"
    );

    const bookedSlotIds = new Set(activeBookings.map(b => b.slot_id));

    // Current Date and Time in local timezone for past slot checks
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Day-Wise Pricing (Weekday vs Weekend)
    const dayOfWeek = new Date(dateStr).getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const results = [];
    for (const s of courtSlots) {
      const resolvedPrice = isWeekend 
        ? (s.weekend_price != null ? Number(s.weekend_price) : Math.round(Number(s.price) * 1.3))
        : (s.weekday_price != null ? Number(s.weekday_price) : Number(s.price));

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
  }

});
