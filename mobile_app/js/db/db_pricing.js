/**
 * db_pricing.js - Slot Pricing Tiers, Day-Wise Rates, and Peak Hour Updates
 */
Object.assign(MockAPI.prototype, {
  // Admin Pricing: Get Unique Slot Time Tiers with Current Prices (Filtered by Sport if specified)
  async getSlotPricingOverview(sportId = null) {
    await this._simulateDelay(40);
    const allCourts = await this._getAll("courts");
    let targetCourtIds = null;
    if (sportId && sportId !== "all") {
      const courts = allCourts.filter(c => c.sport_id === Number(sportId));
      targetCourtIds = new Set(courts.map(c => c.id));
    }

    const allSlots = await this._getAll("slots");
    const map = new Map();
    for (const s of allSlots) {
      if (!targetCourtIds || targetCourtIds.has(s.court_id)) {
        const key = `${s.start_time} - ${s.end_time}`;
        const weekday = s.weekday_price != null ? Number(s.weekday_price) : Number(s.price);
        const weekend = s.weekend_price != null ? Number(s.weekend_price) : Math.round(Number(s.price) * 1.3);

        if (!map.has(key)) {
          map.set(key, { 
            start: s.start_time, 
            end: s.end_time, 
            price: s.price, 
            weekday_price: weekday, 
            weekend_price: weekend, 
            count: 1 
          });
        } else {
          map.get(key).count++;
          map.get(key).price = s.price;
          map.get(key).weekday_price = weekday;
          map.get(key).weekend_price = weekend;
        }
      }
    }


    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
  },

  // Admin Pricing: Update Day-Wise Slot Price (ALL, WEEKDAY, WEEKEND)
  async updateSlotDayWisePrice(sportId, slotVal, dayType = "ALL", newPrice) {
    await this._simulateDelay(60);
    const price = Number(newPrice);
    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;

    for (const s of allSlots) {
      if (!targetCourtIds.has(s.court_id)) continue;

      let match = false;
      if (slotVal === "all-slots") {
        match = true;
      } else {
        const [st, et] = slotVal.split("-");
        match = et ? (s.start_time === st && s.end_time === et) : (s.start_time === st);
      }

      if (match) {
        if (dayType === "WEEKDAY") {
          s.weekday_price = price;
          s.price = price;
        } else if (dayType === "WEEKEND") {
          s.weekend_price = price;
        } else {
          // ALL DAYS
          s.price = price;
          s.weekday_price = price;
          s.weekend_price = price;
        }
        await this._put("slots", s);
        count++;
      }
    }


    return count;
  },

  // Admin Pricing: Update Exact Slot Price for a Specific Game / Sport
  async updateSlotPriceForSport(sportId, startTime, endTime, newPrice) {
    await this._simulateDelay(60);
    const price = Number(newPrice);
    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;
    for (const s of allSlots) {
      if (targetCourtIds.has(s.court_id)) {
        const match = endTime 
          ? (s.start_time === startTime && s.end_time === endTime)
          : (s.start_time === startTime);
        if (match) {
          s.price = price;
          await this._put("slots", s);
          count++;
        }
      }
    }


    return count;
  },

  // Admin Pricing: Bulk Update Prices in Time Window (e.g. 18:00 to 23:00 peak hours)
  async updateSlotPriceByTimeRange(startTime, endTime, newPrice, sportId = null) {
    await this._simulateDelay(80);
    const price = Number(newPrice);
    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;
    for (const s of allSlots) {
      if (targetCourtIds.has(s.court_id) && s.start_time >= startTime && s.start_time < endTime) {
        s.price = price;
        await this._put("slots", s);
        count++;
      }
    }


    return count;
  },

  // Admin Pricing: Update Exact Slot Time Price (e.g. 18:00 - 19:00)
  async updateSpecificSlotTimePrice(startTime, endTime, newPrice, sportId = null) {
    return this.updateSlotPriceForSport(sportId, startTime, endTime, newPrice);
  }

});
