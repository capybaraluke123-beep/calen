/* US federal holidays + common observances. No libraries. */
(function (global) {
  "use strict";

  function nthWeekday(year, month, weekday, n) {
    const first = new Date(year, month, 1);
    const shift = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + shift + (n - 1) * 7);
  }

  function lastWeekday(year, month, weekday) {
    const last = new Date(year, month + 1, 0);
    const shift = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - shift);
  }

  function dayAfter(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  }

  /* Saturday holidays are observed the Friday before, Sunday ones the Monday after. */
  function observedShift(date) {
    const dow = date.getDay();
    if (dow === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
    if (dow === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return date;
  }

  const FEDERAL = [
    { name: "New Year's Day", month: 0, day: 1 },
    { name: "Martin Luther King Jr. Day", rule: (y) => nthWeekday(y, 0, 1, 3) },
    { name: "Presidents' Day", rule: (y) => nthWeekday(y, 1, 1, 3) },
    { name: "Memorial Day", rule: (y) => lastWeekday(y, 4, 1) },
    { name: "Juneteenth National Independence Day", month: 5, day: 19, since: 2021 },
    { name: "Independence Day", month: 6, day: 4 },
    { name: "Labor Day", rule: (y) => nthWeekday(y, 8, 1, 1) },
    { name: "Columbus Day", rule: (y) => nthWeekday(y, 9, 1, 2) },
    { name: "Veterans Day", month: 10, day: 11 },
    { name: "Thanksgiving Day", rule: (y) => nthWeekday(y, 10, 4, 4) },
    { name: "Christmas Day", month: 11, day: 25 }
  ];

  const OBSERVANCES = [
    { name: "Valentine's Day", month: 1, day: 14 },
    { name: "St. Patrick's Day", month: 2, day: 17 },
    { name: "April Fools' Day", month: 3, day: 1 },
    { name: "Earth Day", month: 3, day: 22 },
    { name: "Mother's Day", rule: (y) => nthWeekday(y, 4, 0, 2) },
    { name: "Flag Day", month: 5, day: 14 },
    { name: "Father's Day", rule: (y) => nthWeekday(y, 5, 0, 3) },
    { name: "Independence Eve", month: 6, day: 3 },
    { name: "Halloween", month: 9, day: 31 },
    { name: "Black Friday", rule: (y) => dayAfter(nthWeekday(y, 10, 4, 4)) },
    { name: "Christmas Eve", month: 11, day: 24 },
    { name: "New Year's Eve", month: 11, day: 31 }
  ];

  function keyOf(date) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  }

  /* Each federal holiday yields an entry on its real date plus, when it lands
     on a weekend, a second entry on the weekday it is observed. */
  function collect(defs, year, applyShift) {
    const out = [];
    defs.forEach(function (d) {
      if (d.since && year < d.since) return;
      const actual = d.rule ? d.rule(year) : new Date(year, d.month, d.day);
      out.push({ name: d.name, date: actual, shifted: false });
      if (!applyShift) return;
      const obs = observedShift(actual);
      if (keyOf(obs) !== keyOf(actual)) out.push({ name: d.name, date: obs, shifted: true, actualDate: actual });
    });
    return out;
  }

  const cache = {};

  function yearIndex(year) {
    if (!cache[year]) {
      cache[year] = { federal: collect(FEDERAL, year, true), observance: collect(OBSERVANCES, year, false) };
    }
    return cache[year];
  }

  /* Holidays falling on `date`. Neighbouring years are scanned too, because a
     New Year's Day landing on a Saturday is observed on the previous Dec 31. */
  function forDate(date, includeObservances) {
    const year = date.getFullYear();
    const key = keyOf(date);
    const out = [];

    [year - 1, year, year + 1].forEach(function (y) {
      yearIndex(y).federal.forEach(function (h) {
        if (keyOf(h.date) !== key) return;
        out.push({
          name: h.name,
          type: "federal",
          isObserved: h.shifted,
          actualDate: h.shifted ? h.actualDate : h.date
        });
      });
    });

    if (includeObservances) {
      [year - 1, year, year + 1].forEach(function (y) {
        yearIndex(y).observance.forEach(function (h) {
          if (keyOf(h.date) !== key) return;
          out.push({ name: h.name, type: "observance", isObserved: false, actualDate: h.date });
        });
      });
    }

    return out;
  }

  /* Next holidays on or after `from`, in date order. */
  function upcoming(from, count, includeObservances) {
    const out = [];
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

    for (let i = 0; i < 400 && out.length < count; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const found = forDate(d, includeObservances);
      for (let j = 0; j < found.length && out.length < count; j++) {
        out.push({ name: found[j].name, date: d, type: found[j].type, isObserved: found[j].isObserved });
      }
    }

    return out;
  }

  global.US_Holidays = {
    forDate: forDate,
    upcoming: upcoming
  };
})(typeof window !== "undefined" ? window : globalThis);