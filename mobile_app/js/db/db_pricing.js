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
        const monthlyPrice = s.monthly_price != null ? Number(s.monthly_price) : null;

        if (!map.has(key)) {
          map.set(key, { 
            start: s.start_time, 
            end: s.end_time, 
            price: s.price, 
            weekday_price: weekday, 
            weekend_price: weekend,
            monthly_price: monthlyPrice,
            count: 1 
          });
        } else {
          map.get(key).count++;
          map.get(key).price = s.price;
          map.get(key).weekday_price = weekday;
          map.get(key).weekend_price = weekend;
          map.get(key).monthly_price = monthlyPrice;
        }
      }
    }


    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
  },

  // Admin Pricing: Update Day-Wise Slot Price (ALL, WEEKDAY, WEEKEND) & Optional Monthly Rate
  async updateSlotDayWisePrice(sportId, slotVal, dayType = "ALL", newPrice, monthlyPrice = null) {
    await this._simulateDelay(60);
    const price = Number(newPrice);
    const hasCustomMonthly = monthlyPrice !== null && monthlyPrice !== "" && !isNaN(Number(monthlyPrice)) && Number(monthlyPrice) > 0;
    const parsedMonthly = hasCustomMonthly ? Number(monthlyPrice) : null;

    const allCourts = await this._getAll("courts");
    const targetCourts = (sportId && sportId !== "all")
      ? allCourts.filter(c => c.sport_id === Number(sportId))
      : allCourts;
    const targetCourtIds = new Set(targetCourts.map(c => c.id));

    const allSlots = await this._getAll("slots");
    let count = 0;

    const applyRates = (slotObj) => {
      if (dayType === "WEEKDAY") {
        slotObj.weekday_price = price;
        slotObj.price = price;
        if (slotObj.weekend_price == null) slotObj.weekend_price = Math.round(price * 1.3);
      } else if (dayType === "WEEKEND") {
        slotObj.weekend_price = price;
        if (slotObj.price == null) slotObj.price = price;
        if (slotObj.weekday_price == null) slotObj.weekday_price = price;
      } else {
        slotObj.price = price;
        slotObj.weekday_price = price;
        slotObj.weekend_price = price;
      }
      if (monthlyPrice === null || monthlyPrice === "") {
        delete slotObj.monthly_price;
      } else if (parsedMonthly != null) {
        slotObj.monthly_price = parsedMonthly;
      }
    };

    const isBulkPreset = slotVal === "all-slots" || slotVal === "peak" || slotVal === "day";
    const matchedCourtIds = new Set();

    for (const s of allSlots) {
      if (!targetCourtIds.has(s.court_id)) continue;

      let match = false;
      if (slotVal === "all-slots") {
        match = true;
      } else if (slotVal === "peak") {
        match = s.start_time >= "18:00" && s.start_time < "23:00";
      } else if (slotVal === "day") {
        match = s.start_time >= "08:00" && s.start_time < "18:00";
      } else {
        const [st, et] = slotVal.split("-");
        match = et ? (s.start_time === st && s.end_time === et) : (s.start_time === st);
      }

      if (match) {
        applyRates(s);
        await this._put("slots", s);
        matchedCourtIds.add(s.court_id);
        count++;
      }
    }

    // Create missing slots on target courts if they don't exist yet (e.g. after deletion or adding new time)
    let nextId = allSlots.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
    const bulkWindows = slotVal === "peak"
      ? [
          { start: "18:00", end: "19:00" }, { start: "19:00", end: "20:00" },
          { start: "20:00", end: "21:00" }, { start: "21:00", end: "22:00" },
          { start: "22:00", end: "23:00" }
        ]
      : slotVal === "day"
        ? [
            { start: "08:00", end: "09:00" }, { start: "09:00", end: "10:00" },
            { start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" },
            { start: "14:00", end: "15:00" }, { start: "16:00", end: "17:00" },
            { start: "17:00", end: "18:00" }
          ]
        : [
            { start: "08:00", end: "09:00" }, { start: "09:00", end: "10:00" },
            { start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" },
            { start: "14:00", end: "15:00" }, { start: "16:00", end: "17:00" },
            { start: "17:00", end: "18:00" }, { start: "18:00", end: "19:00" },
            { start: "19:00", end: "20:00" }, { start: "20:00", end: "21:00" },
            { start: "21:00", end: "22:00" }, { start: "22:00", end: "23:00" }
          ];

    if (!isBulkPreset) {
      const [st, et] = slotVal.split("-");
      if (st && et) {
        for (const c of targetCourts) {
          if (!matchedCourtIds.has(c.id)) {
            const newSlot = { id: nextId++, court_id: c.id, start_time: st, end_time: et, price };
            applyRates(newSlot);
            await this._put("slots", newSlot);
            count++;
          }
        }
      }
    } else {
      for (const c of targetCourts) {
        if (!matchedCourtIds.has(c.id)) {
          for (const w of bulkWindows) {
            const newSlot = { id: nextId++, court_id: c.id, start_time: w.start, end_time: w.end, price };
            applyRates(newSlot);
            await this._put("slots", newSlot);
            count++;
          }
        }
      }
    }

    return count;
  },

  // Admin Pricing: Update Exact Slot Price for a Specific Game / Sport
  async updateSlotPriceForSport(sportId, startTime, endTime, newPrice, monthlyPrice = undefined, weekdayPrice = null, weekendPrice = null) {
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
          s.weekday_price = weekdayPrice != null ? Number(weekdayPrice) : price;
          s.weekend_price = weekendPrice != null ? Number(weekendPrice) : price;
          if (monthlyPrice !== undefined) {
            if (monthlyPrice === null || monthlyPrice === "" || Number(monthlyPrice) <= 0) {
              delete s.monthly_price;
            } else {
              s.monthly_price = Number(monthlyPrice);
            }
          }
          await this._put("slots", s);
          count++;
        }
      }
    }


    return count;
  },

  // Admin Pricing: Delete Slot Tier for a Specific Time Slot
  async deleteSlotPricing(sportId, startTime, endTime) {
    await this._simulateDelay(60);
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
          await this._delete("slots", s.id);
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
