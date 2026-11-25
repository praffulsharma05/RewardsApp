/**
 * db_facility.js - Facility Operating Status, Closed Dates, and Playground Unavailability
 */
Object.assign(MockAPI.prototype, {
  // Admin Settings: Playground & Academy Time-Window Unavailability (e.g. 10:00 to 17:00)
  async getPlaygroundUnavailabilities() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "playground_unavailabilities");
    return (item && Array.isArray(item.list)) ? item.list : [];
  },

  async addPlaygroundUnavailability({ court_id, courtId, sport_id, sportId, court_name, courtName, start_time, startTime, end_time, endTime, date, reason }) {
    await this._simulateDelay(60);
    const item = await this._get("settings", "playground_unavailabilities") || { key: "playground_unavailabilities", list: [] };
    const list = Array.isArray(item.list) ? item.list : [];
    const nextId = list.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;

    const resolvedCourtId = Number(courtId != null ? courtId : (court_id != null ? court_id : 0));
    const resolvedSportId = Number(sportId != null ? sportId : (sport_id != null ? sport_id : 0));
    const resolvedStartTime = startTime || start_time || "10:00";
    const resolvedEndTime = endTime || end_time || "17:00";
    let resolvedCourtName = courtName || court_name;
    if (!resolvedCourtName) {
      if (resolvedCourtId === 0 && resolvedSportId > 0) resolvedCourtName = `All Sport #${resolvedSportId} Grounds`;
      else if (resolvedCourtId === 0) resolvedCourtName = "All Academy Grounds (Entire Facility)";
      else resolvedCourtName = `Court #${resolvedCourtId}`;
    }

    const newRecord = {
      id: nextId,
      court_id: resolvedCourtId,
      sport_id: resolvedSportId,
      court_name: resolvedCourtName,
      start_time: resolvedStartTime,
      end_time: resolvedEndTime,
      date: date || "ALL_DAYS",
      reason: (reason || "Academy Training (10 AM - 5 PM)").trim(),
      created_at: new Date().toISOString()
    };

    list.push(newRecord);
    await this._put("settings", { key: "playground_unavailabilities", list });
    return newRecord;
  },

  async deletePlaygroundUnavailability(id) {
    await this._simulateDelay(50);
    const item = await this._get("settings", "playground_unavailabilities") || { key: "playground_unavailabilities", list: [] };
    const list = Array.isArray(item.list) ? item.list.filter(u => u.id !== Number(id)) : [];
    await this._put("settings", { key: "playground_unavailabilities", list });
    return list;
  },

  // Check if slot falls in a blocked playground or academy unavailability window (e.g. 10:00 - 17:00)
  async checkSlotUnavailability(courtId, dateStr, startTime, endTime) {
    const list = await this.getPlaygroundUnavailabilities();
    if (list.length === 0) return { isUnavailable: false, reason: "" };

    const court = await this._get("courts", Number(courtId));
    const courtSportId = court ? court.sport_id : null;

    for (const u of list) {
      // 1. Check court match:
      let matchesCourt = false;
      const targetCourtId = Number(u.court_id || 0);
      const targetSportId = Number(u.sport_id || 0);

      if (targetCourtId !== 0) {
        // Particular playground / specific court block: MUST match exact courtId
        matchesCourt = (targetCourtId === Number(courtId));
      } else if (targetSportId !== 0) {
        // Sport-wide block: matches all grounds in this sport
        matchesCourt = (courtSportId != null && courtSportId === targetSportId);
      } else {
        // Entire facility block (All Academy Grounds)
        matchesCourt = true;
      }

      if (!matchesCourt) continue;

      // 2. Check date match (ALL_DAYS or specific date)
      const dateMatches = (u.date === "ALL_DAYS" || u.date === dateStr);
      if (!dateMatches) continue;

      // 3. Check time window overlap (e.g. 10:00 to 17:00)
      if (startTime >= u.start_time && startTime < u.end_time) {
        return {
          isUnavailable: true,
          reason: u.reason || `Academy / Ground Blocked (${u.start_time} - ${u.end_time})`
        };
      }
    }
    return { isUnavailable: false, reason: "" };
  },

  // Admin Settings: Facility Operating Status (OPEN / CLOSED)
  async getFacilityStatus() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "facility_status");
    if (!item) return { isOpen: true, reason: "Normal Operations" };
    return { isOpen: item.isOpen !== false, reason: item.reason || "Shop is closed today" };
  },

  async setFacilityStatus(isOpen, reason = "Shop is closed today") {
    await this._simulateDelay(60);
    const data = { key: "facility_status", isOpen: Boolean(isOpen), reason: reason.trim() };
    await this._put("settings", data);
    return data;
  },

  // Admin Settings: Date-Specific Blackouts (Full-day or Time-window based e.g. 14/11/2026 from 10:00 to 14:00)
  async getClosedDates() {
    await this._simulateDelay(30);
    const item = await this._get("settings", "closed_dates");
    return (item && Array.isArray(item.dates)) ? item.dates : [];
  },

  async addClosedDate(dateStr, reason = "Facility Closed", startTime = "00:00", endTime = "24:00", isFullDay = true) {
    await this._simulateDelay(50);
    const item = await this._get("settings", "closed_dates") || { key: "closed_dates", dates: [] };
    const dates = Array.isArray(item.dates) ? [...item.dates] : [];
    const entryId = Date.now() + Math.floor(Math.random() * 1000);
    dates.push({
      id: entryId,
      date: dateStr,
      reason: (reason || "Facility Closed").trim(),
      is_full_day: Boolean(isFullDay),
      start_time: isFullDay ? "00:00" : (startTime || "10:00"),
      end_time: isFullDay ? "24:00" : (endTime || "14:00")
    });
    dates.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    await this._put("settings", { key: "closed_dates", dates });
    return dates;
  },

  async removeClosedDate(idOrDate) {
    await this._simulateDelay(50);
    const item = await this._get("settings", "closed_dates") || { key: "closed_dates", dates: [] };
    const dates = Array.isArray(item.dates) 
      ? item.dates.filter(d => d.id !== Number(idOrDate) && String(d.id) !== String(idOrDate) && d.date !== idOrDate)
      : [];
    await this._put("settings", { key: "closed_dates", dates });
    return dates;
  },

  async isDateClosed(dateStr, slotStartTime = null, slotEndTime = null) {
    const closedList = await this.getClosedDates();
    const dateEntries = closedList.filter(d => d.date === dateStr);
    if (dateEntries.length === 0) {
      return { isClosed: false, isFullDay: false, reason: "" };
    }

    // 1. If slot start time is supplied, check whether this specific slot overlaps with any closure
    if (slotStartTime != null) {
      for (const d of dateEntries) {
        if (d.is_full_day !== false) {
          return { isClosed: true, isFullDay: true, start_time: "00:00", end_time: "24:00", reason: d.reason };
        }
        const sStart = d.start_time || "00:00";
        const sEnd = d.end_time || "24:00";
        // Check overlap
        if (slotStartTime >= sStart && slotStartTime < sEnd) {
          return {
            isClosed: true,
            isFullDay: false,
            start_time: sStart,
            end_time: sEnd,
            reason: d.reason || `Facility Closed (${sStart} - ${sEnd})`
          };
        }
      }
      return { isClosed: false, isFullDay: false, reason: "" };
    }

    // 2. If slot start time is NOT supplied (general date check):
    const fullMatch = dateEntries.find(d => d.is_full_day !== false);
    if (fullMatch) {
      return { isClosed: true, isFullDay: true, reason: fullMatch.reason };
    }

    // Only partial-day time closures exist on this date
    return {
      isClosed: false,
      isFullDay: false,
      hasPartialClosure: true,
      partials: dateEntries,
      reason: dateEntries.map(d => `${d.start_time || '10:00'} - ${d.end_time || '14:00'} (${d.reason})`).join(", ")
    };
  }

});
