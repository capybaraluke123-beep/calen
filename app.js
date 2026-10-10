(function () {
  "use strict";

  const STORE_KEY = "gubby.calendar.v1";
  const MINUTE = 60000;
  const HOUR_H = 54;

  const el = {
    pane: document.getElementById("pane"),
    periodTitle: document.getElementById("periodTitle"),
    viewSwitch: document.getElementById("viewSwitch"),
    segThumb: document.getElementById("segThumb"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    todayBtn: document.getElementById("todayBtn"),
    addBtn: document.getElementById("addBtn"),
    themeBtn: document.getElementById("themeBtn"),
    obsToggle: document.getElementById("obsToggle"),
    nextUp: document.getElementById("nextUp"),
    sideWeekday: document.getElementById("sideWeekday"),
    sideDayNum: document.getElementById("sideDayNum"),
    sideMonth: document.getElementById("sideMonth"),
    holidaySection: document.getElementById("holidaySection"),
    holidayList: document.getElementById("holidayList"),
    eventCount: document.getElementById("eventCount"),
    agenda: document.getElementById("agenda"),
    sideAddBtn: document.getElementById("sideAddBtn"),
    upcoming: document.getElementById("upcoming"),
    dialog: document.getElementById("eventDialog"),
    form: document.getElementById("eventForm"),
    dialogTitle: document.getElementById("dialogTitle"),
    dialogClose: document.getElementById("dialogClose"),
    cancelBtn: document.getElementById("cancelBtn"),
    deleteBtn: document.getElementById("deleteBtn"),
    saveBtn: document.getElementById("saveBtn"),
    fTitle: document.getElementById("fTitle"),
    fDate: document.getElementById("fDate"),
    fTime: document.getElementById("fTime"),
    fLength: document.getElementById("fLength"),
    fAddress: document.getElementById("fAddress"),
    fDesc: document.getElementById("fDesc"),
    swatches: document.getElementById("swatches"),
    toast: document.getElementById("toast"),
    savedFlag: document.getElementById("savedFlag")
  };

  const fmt = {
    weekdayLong: new Intl.DateTimeFormat(undefined, { weekday: "long" }),
    weekdayShort: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
    monthYear: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }),
    monthShort: new Intl.DateTimeFormat(undefined, { month: "short" }),
    dayMonth: new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" })
  };

  const state = {
    view: "day",
    cursor: startOfDay(new Date()),
    selected: startOfDay(new Date()),
    events: [],
    observances: true,
    theme: "light"
  };

  let editingId = null;
  let pickedColor = 0;
  let toastTimer = null;
  let needsScroll = true;

  /* ---------- date helpers ---------- */

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function addMonths(d, n) {
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), lastDay));
    return target;
  }

  function startOfWeek(d) {
    return addDays(d, -d.getDay());
  }

  function dateKey(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function keyToDate(key) {
    const p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function minutesOf(time) {
    const p = String(time || "0:0").split(":").map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  }

  function clockLabel(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function hourLabel(h) {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h < 12 ? h + " AM" : h - 12 + " PM";
  }

  function durationLabel(mins) {
    if (mins < 60) return mins + " min";
    const h = mins / 60;
    return (h % 1 === 0 ? h : h.toFixed(1)) + (h === 1 ? " hour" : " hours");
  }

  function relativeLabel(target) {
    const diff = target - Date.now();
    const abs = Math.abs(diff);
    const dayDelta = Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000);

    if (dayDelta === 0) {
      const mins = Math.round(abs / MINUTE);
      if (mins < 1) return "now";
      if (mins < 60) return diff > 0 ? "in " + mins + "m" : mins + "m ago";
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      const txt = hrs + "h" + (rem ? " " + rem + "m" : "");
      return diff > 0 ? "in " + txt : txt + " ago";
    }

    if (dayDelta === 1 && diff > 0) return "tomorrow";
    if (dayDelta === -1 && diff < 0) return "yesterday";
    const days = Math.abs(dayDelta);
    const txt = days + (days === 1 ? " day" : " days");
    return diff > 0 ? "in " + txt : txt + " ago";
  }

  function roundToNextHalf(now) {
    const d = new Date(now);
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    d.setMinutes(m < 30 ? 30 : 60);
    if (d.getHours() > 23) return "23:00";
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ---------- persistence ---------- */

  function readStore() {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch (err) {
      return null;
    }
  }

  function load() {
    const raw = readStore();

    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data.events)) state.events = data.events.filter(validEvent);
        if (typeof data.observances === "boolean") state.observances = data.observances;
        if (data.theme === "light" || data.theme === "dark") state.theme = data.theme;
        return;
      } catch (err) {
        state.events = [];
      }
    }

    state.events = seedEvents();
  }

  function validEvent(e) {
    return e && typeof e.id === "string" && typeof e.title === "string" && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date);
  }

  function save() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ events: state.events, observances: state.observances, theme: state.theme })
      );
      setSaved(true);
      return true;
    } catch (err) {
      setSaved(false);
      return false;
    }
  }

  function setSaved(ok) {
    el.savedFlag.textContent = ok ? "Saved locally" : "Storage unavailable";
    el.savedFlag.classList.toggle("is-bad", !ok);
  }

  function seedEvents() {
    const today = startOfDay(new Date());
    const mk = (offset, time, title, description, color, address) => ({
      id: uid(),
      title: title,
      date: dateKey(addDays(today, offset)),
      time: time,
      length: 60,
      address: address || "",
      description: description,
      color: color
    });
    return [
      mk(0, "09:00", "Morning check-in", "Review the day's priorities.", 0),
      mk(0, "13:30", "Call Mom", "", 1),
      mk(1, "12:00", "Team sync", "Weekly planning and blockers.", 4),
      mk(2, "18:00", "Dinner with Sam", "Table is under Grubby.", 3, "Blue Fig Cafe, 412 Chestnut St")
    ];
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  /* ---------- queries ---------- */

  function eventsOn(key) {
    return state.events
      .filter(function (e) {
        return e.date === key;
      })
      .sort(function (a, b) {
        return minutesOf(a.time) - minutesOf(b.time) || a.title.localeCompare(b.title);
      });
  }

  function holidaysOn(key) {
    return US_Holidays.forDate(keyToDate(key), state.observances);
  }

  function eventById(id) {
    return state.events.find(function (e) {
      return e.id === id;
    });
  }

  function nextEvent() {
    const now = Date.now();
    let ongoing = null;
    let soon = null;

    state.events.forEach(function (e) {
      const start = keyToDate(e.date).getTime() + minutesOf(e.time) * MINUTE;
      const end = start + (Number(e.length) || 60) * MINUTE;
      if (now >= start && now < end) {
        if (!ongoing || start < ongoing.start) ongoing = { event: e, start: start, ongoing: true };
      } else if (start > now) {
        if (!soon || start < soon.start) soon = { event: e, start: start, ongoing: false };
      }
    });

    return ongoing || soon;
  }

  /* ---------- rendering ---------- */

  function render() {
    applyTheme();
    renderHeader();
    renderView();
    renderSidebar();
    renderNextUp();
  }

  function renderHeader() {
    const c = state.cursor;
    if (state.view === "day") {
      const isToday = isSameDay(c, new Date());
      el.periodTitle.textContent = isToday
        ? "Today · " + fmt.weekdayLong.format(c) + ", " + fmt.dayMonth.format(c)
        : fmt.weekdayLong.format(c) + ", " + fmt.dayMonth.format(c) + ", " + c.getFullYear();
    } else if (state.view === "week") {
      const ws = startOfWeek(c);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      const label = sameMonth
        ? fmt.monthShort.format(ws).toUpperCase() + " " + ws.getDate() + " – " + we.getDate() + ", " + we.getFullYear()
        : fmt.monthShort.format(ws).toUpperCase() + " " + ws.getDate() + " – " + fmt.monthShort.format(we).toUpperCase() + " " + we.getDate() + ", " + we.getFullYear();
      el.periodTitle.textContent = label;
    } else {
      el.periodTitle.textContent = fmt.monthYear.format(c);
    }

    el.viewSwitch.querySelectorAll(".seg").forEach(function (btn) {
      const on = btn.dataset.view === state.view;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      if (on) moveThumb(btn);
    });

    el.obsToggle.checked = state.observances;
  }

  function moveThumb(btn) {
    const box = btn.parentElement.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    el.segThumb.style.width = r.width + "px";
    el.segThumb.style.transform = "translateX(" + (r.left - box.left - 3) + "px)";
  }

  function renderView() {
    if (state.view === "month") renderMonth();
    else renderTimeline(state.view === "week" ? 7 : 1);
    requestAnimationFrame(function () {
      moveThumb(el.viewSwitch.querySelector(".seg[aria-selected='true']"));
    });
  }

  function visibleDates() {
    const list = [];
    if (state.view === "week") {
      const ws = startOfWeek(state.cursor);
      for (let i = 0; i < 7; i++) list.push(addDays(ws, i));
    } else if (state.view === "day") {
      list.push(new Date(state.cursor));
    } else {
      const first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
      const gridStart = startOfWeek(first);
      for (let i = 0; i < 42; i++) {
        const d = addDays(gridStart, i);
        list.push(d);
        if (i >= 34 && d.getMonth() !== first.getMonth() && d.getDay() === 6) break;
      }
    }
    return list;
  }

  function renderTimeline(cols) {
    const today = startOfDay(new Date());
    const dates = visibleDates();
    const wrap = document.createElement("div");
    wrap.className = "tl" + (cols === 7 ? " is-week" : "");
    wrap.style.setProperty("--cols", cols);

    if (cols === 7) {
      const hols = [];
      dates.forEach(function (d) {
        holidaysOn(dateKey(d)).forEach(function (h) {
          hols.push({ h: h, d: d });
        });
      });
      if (hols.length) {
        const strip = document.createElement("div");
        strip.className = "tl-holidays";
        hols.forEach(function (x) {
          const chip = document.createElement("span");
          chip.className = "chip-hol";
          const dot = document.createElement("span");
          dot.className = "chip-dot";
          chip.appendChild(dot);
          chip.appendChild(document.createTextNode(x.h.name + " · " + x.d.getDate()));
          strip.appendChild(chip);
        });
        wrap.appendChild(strip);
      }
    }

    const head = document.createElement("div");
    head.className = "tl-head";
    const headGutter = document.createElement("div");
    headGutter.className = "tl-head-gutter";
    head.appendChild(headGutter);

    const headDays = document.createElement("div");
    headDays.className = "tl-head-days";
    headDays.style.setProperty("--cols", cols);

    dates.forEach(function (d) {
      const h = document.createElement("button");
      h.type = "button";
      h.className = "tl-dayhead";
      if (isSameDay(d, today)) h.classList.add("is-today");
      if (isSameDay(d, state.selected)) h.classList.add("is-sel");
      if (d.getDay() === 0 || d.getDay() === 6) h.classList.add("is-weekend");

      const dow = document.createElement("span");
      dow.className = "dh-dow";
      dow.textContent = cols === 7 ? fmt.weekdayShort.format(d).toUpperCase() : fmt.weekdayShort.format(d) + " · " + fmt.dayMonth.format(d);
      h.appendChild(dow);

      const num = document.createElement("span");
      num.className = "dh-num";
      num.textContent = d.getDate();
      h.appendChild(num);

      const hol = holidaysOn(dateKey(d))[0];
      if (hol) {
        const hl = document.createElement("span");
        hl.className = "dh-hol";
        hl.textContent = hol.name;
        h.appendChild(hl);
      }

      h.addEventListener("click", function () {
        selectDate(d);
      });
      headDays.appendChild(h);
    });

    head.appendChild(headDays);
    wrap.appendChild(head);

    const body = document.createElement("div");
    body.className = "tl-body";

    const g = document.createElement("div");
    g.className = "tl-gutter";
    body.appendChild(g);

    const colsEl = document.createElement("div");
    colsEl.className = "tl-cols";
    colsEl.style.setProperty("--cols", cols);
    dates.forEach(function (d) {
      const col = document.createElement("div");
      col.className = "tl-col";
      col.dataset.key = dateKey(d);
      colsEl.appendChild(col);
    });
    body.appendChild(colsEl);
    wrap.appendChild(body);
    el.pane.replaceChildren(wrap);

    const hourPx = g.offsetHeight / 24 || HOUR_H;

    for (let h = 1; h < 24; h++) {
      const s = document.createElement("span");
      s.style.top = h * hourPx + "px";
      s.textContent = hourLabel(h);
      g.appendChild(s);
    }

    dates.forEach(function (d, i) {
      const key = dateKey(d);
      const col = colsEl.children[i];
      if (d.getDay() === 0 || d.getDay() === 6) col.classList.add("is-weekend");
      if (isSameDay(d, today)) col.classList.add("is-today");
      if (isSameDay(d, state.selected)) col.classList.add("is-sel");

      const items = eventsOn(key).map(function (e) {
        return { ev: e, start: minutesOf(e.time), dur: Math.max(15, Number(e.length) || 60) };
      });
      assignLanes(items);

      items.forEach(function (item) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ev ev-c" + (Number(item.ev.color) || 0);
        btn.style.top = (item.start / 60) * hourPx + "px";
        btn.style.height = Math.max(18, (item.dur / 60) * hourPx - 3) + "px";
        btn.style.left = "calc(" + (item.lane / item.lanes) * 100 + "% + 2px)";
        btn.style.width = "calc(" + (100 / item.lanes) + "% - 5px)";
        btn.style.zIndex = String(10 + item.lane);
        if (item.dur <= 30 && cols === 7) btn.classList.add("is-short");

        const t = document.createElement("span");
        t.className = "ev-title";
        t.textContent = item.ev.title;
        btn.appendChild(t);

        const tm = document.createElement("span");
        tm.className = "ev-time";
        tm.textContent = clockLabel(item.start);
        btn.appendChild(tm);

        if (item.ev.address && item.dur >= 75 && cols === 1) {
          const ad = document.createElement("span");
          ad.className = "ev-addr";
          ad.textContent = item.ev.address;
          btn.appendChild(ad);
        }

        if (item.ev.description && item.dur >= 90 && cols === 1) {
          const ds = document.createElement("span");
          ds.className = "ev-desc";
          ds.textContent = item.ev.description;
          btn.appendChild(ds);
        }

        btn.title = [clockLabel(item.start) + " · " + item.ev.title, item.ev.address, item.ev.description]
          .filter(Boolean)
          .join("\n");
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          openDialog(item.ev.id);
        });
        col.appendChild(btn);
      });

      if (isSameDay(d, today)) {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const line = document.createElement("div");
        line.className = "tl-now";
        line.style.top = (mins / 60) * hourPx + "px";
        if (cols === 1) {
          const lbl = document.createElement("span");
          lbl.className = "tl-now-label";
          lbl.textContent = clockLabel(mins);
          line.appendChild(lbl);
        }
        col.appendChild(line);
      }

      col.addEventListener("dblclick", function (ev) {
        if (ev.target === col) {
          selectDate(d);
          openDialog(null);
        }
      });
    });

    if (needsScroll) {
      needsScroll = false;
      const focusHour = isSameDay(state.cursor, today) ? Math.max(0, new Date().getHours() - 1) : 7;
      wrap.scrollTop = Math.max(0, (focusHour - 0.4) * hourPx);
    }
  }

  /* Groups overlapping events into clusters, assigns each a column, and
     records how many columns the cluster needs so blocks can be sized. */
  function assignLanes(items) {
    items.sort(function (a, b) {
      return a.start - b.start || b.dur - a.dur;
    });

    let cluster = [];
    let clusterEnd = -1;

    function flush() {
      if (!cluster.length) return;
      const laneEnds = [];
      cluster.forEach(function (it) {
        let lane = 0;
        while (lane < laneEnds.length && laneEnds[lane] > it.start) lane++;
        laneEnds[lane] = it.start + it.dur;
        it.lane = lane;
      });
      const total = Math.max(1, laneEnds.length);
      cluster.forEach(function (it) {
        it.lanes = total;
      });
      cluster = [];
      clusterEnd = -1;
    }

    items.forEach(function (it) {
      if (cluster.length && it.start >= clusterEnd) flush();
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.start + it.dur);
    });
    flush();
  }

  function renderMonth() {
    const today = startOfDay(new Date());
    const dates = visibleDates();
    const wrap = document.createElement("div");
    wrap.className = "mo";

    const dow = document.createElement("div");
    dow.className = "mo-dow";
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (label) {
      const c = document.createElement("div");
      c.textContent = label;
      dow.appendChild(c);
    });
    wrap.appendChild(dow);

    const grid = document.createElement("div");
    grid.className = "mo-grid";
    if (dates.length === 42) grid.style.gridTemplateRows = "repeat(6, minmax(0, 1fr))";

    dates.forEach(function (d) {
      const key = dateKey(d);
      const cell = document.createElement("div");
      cell.className = "mo-cell";
      cell.dataset.key = key;
      if (d.getMonth() !== state.cursor.getMonth()) cell.classList.add("is-out");
      if (isSameDay(d, today)) cell.classList.add("is-today");
      if (isSameDay(d, state.selected)) cell.classList.add("is-sel");
      if (d.getDay() === 0 || d.getDay() === 6) cell.classList.add("is-weekend");

      const row1 = document.createElement("div");
      row1.className = "mo-row1";

      const num = document.createElement("span");
      num.className = "mo-num";
      num.textContent = d.getDate();
      row1.appendChild(num);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "mo-plus";
      plus.title = "Add event on " + fmt.dayMonth.format(d);
      plus.setAttribute("aria-label", "Add event on " + fmt.dayMonth.format(d));
      plus.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>';
      plus.addEventListener("click", function (ev) {
        ev.stopPropagation();
        selectDate(d);
        openDialog(null);
      });
      row1.appendChild(plus);
      cell.appendChild(row1);

      const hols = holidaysOn(key);
      hols.slice(0, 2).forEach(function (h) {
        const chip = document.createElement("div");
        chip.className = "mo-hol" + (h.type === "observance" ? " is-obs" : "");
        chip.textContent = h.name;
        chip.title = h.name;
        cell.appendChild(chip);
      });

      const evs = eventsOn(key);
      const items = document.createElement("div");
      items.className = "mo-items";
      evs.slice(0, 3).forEach(function (e) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mo-item ev-c" + (Number(e.color) || 0);
        const tt = document.createElement("span");
        tt.className = "mi-t";
        tt.textContent = clockLabel(minutesOf(e.time)).replace(" ", "").toLowerCase();
        const nn = document.createElement("span");
        nn.className = "mi-n";
        nn.textContent = e.title;
        b.appendChild(tt);
        b.appendChild(nn);
        b.title = clockLabel(minutesOf(e.time)) + " · " + e.title;
        b.addEventListener("click", function (ev) {
          ev.stopPropagation();
          selectDate(d);
          openDialog(e.id);
        });
        items.appendChild(b);
      });
      if (evs.length > 3) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "mo-more";
        more.textContent = "+" + (evs.length - 3) + " more";
        more.addEventListener("click", function (ev) {
          ev.stopPropagation();
          selectDate(d);
          setView("day");
        });
        items.appendChild(more);
      }
      cell.appendChild(items);

      const dots = document.createElement("div");
      dots.className = "mo-dots";
      evs.slice(0, 8).forEach(function (e) {
        const dot = document.createElement("span");
        dot.className = "mo-dot ev-c" + (Number(e.color) || 0);
        dots.appendChild(dot);
      });
      cell.appendChild(dots);

      cell.addEventListener("click", function () {
        selectDate(d);
      });
      cell.addEventListener("dblclick", function () {
        openDialog(null);
      });

      grid.appendChild(cell);
    });

    wrap.appendChild(grid);
    el.pane.replaceChildren(wrap);
  }

  function renderSidebar() {
    const key = dateKey(state.selected);
    el.sideWeekday.textContent = fmt.weekdayLong.format(state.selected);
    el.sideDayNum.textContent = state.selected.getDate();
    el.sideMonth.textContent = fmt.monthYear.format(state.selected);

    const hols = holidaysOn(key);
    el.holidaySection.hidden = hols.length === 0;
    el.holidayList.replaceChildren();
    hols.forEach(function (h) {
      const li = document.createElement("li");
      li.className = "hol-item";

      const ico = document.createElement("span");
      ico.className = "hi-ico";
      ico.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8z"></path></svg>';

      const main = document.createElement("div");
      const name = document.createElement("div");
      name.className = "hi-name";
      name.textContent = h.name;
      const note = document.createElement("div");
      note.className = "hi-note";
      if (h.type === "observance") note.textContent = "Observance";
      else if (h.isObserved) note.textContent = "Observed · actual " + fmt.dayMonth.format(h.actualDate);
      else note.textContent = "US federal holiday";
      main.appendChild(name);
      main.appendChild(note);

      li.appendChild(ico);
      li.appendChild(main);
      el.holidayList.appendChild(li);
    });

    const evs = eventsOn(key);
    el.eventCount.textContent = evs.length ? String(evs.length) : "";
    el.agenda.replaceChildren();

    if (!evs.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg>' +
        "Nothing scheduled yet.";
      el.agenda.appendChild(li);
    } else {
      evs.forEach(function (e) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ag-item ev-c" + (Number(e.color) || 0);

        const time = document.createElement("div");
        time.className = "ag-time";
        time.textContent = clockLabel(minutesOf(e.time));
        const dur = document.createElement("span");
        dur.className = "ag-dur";
        dur.textContent = durationLabel(Number(e.length) || 60);
        time.appendChild(dur);

        const main = document.createElement("div");
        const title = document.createElement("div");
        title.className = "ag-title";
        title.textContent = e.title;
        main.appendChild(title);
        if (e.address) {
          const addr = document.createElement("div");
          addr.className = "ag-addr";
          addr.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
          addr.appendChild(document.createTextNode(e.address));
          main.appendChild(addr);
        }
        if (e.description) {
          const desc = document.createElement("div");
          desc.className = "ag-desc";
          desc.textContent = e.description;
          main.appendChild(desc);
        }

        btn.appendChild(time);
        btn.appendChild(main);
        btn.addEventListener("click", function () {
          openDialog(e.id);
        });
        li.appendChild(btn);
        el.agenda.appendChild(li);
      });
    }

    const up = US_Holidays.upcoming(startOfDay(new Date()), 4, state.observances);
    el.upcoming.replaceChildren();
    up.forEach(function (h) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "up-item";

      const when = document.createElement("span");
      when.className = "up-when";
      const top = document.createElement("span");
      top.className = "uw-top";
      top.textContent = fmt.monthShort.format(h.date).toUpperCase();
      const bot = document.createElement("span");
      bot.className = "uw-bot";
      bot.textContent = h.date.getDate();
      when.appendChild(top);
      when.appendChild(bot);

      const name = document.createElement("span");
      name.className = "up-name";
      name.textContent = h.name;

      const inLbl = document.createElement("span");
      inLbl.className = "up-in";
      const rel = relativeLabel(new Date(h.date.getFullYear(), h.date.getMonth(), h.date.getDate(), 0, 0));
      inLbl.textContent = rel;
      if (rel.indexOf("in 1") === 0 || rel === "now") inLbl.classList.add("is-soon");

      btn.appendChild(when);
      btn.appendChild(name);
      btn.appendChild(inLbl);
      btn.addEventListener("click", function () {
        state.selected = new Date(h.date);
        state.cursor = new Date(h.date);
        if (state.view === "month") state.cursor = new Date(h.date.getFullYear(), h.date.getMonth(), 1);
        render();
      });
      li.appendChild(btn);
      el.upcoming.appendChild(li);
    });
  }

  function renderNextUp() {
    el.nextUp.replaceChildren();
    const info = nextEvent();

    if (!info) {
      const dot = document.createElement("span");
      dot.className = "nu-dot";
      el.nextUp.appendChild(dot);
      el.nextUp.appendChild(document.createTextNode("No upcoming events — you are clear."));
      return;
    }

    const e = info.event;
    const dotEl = document.createElement("span");
    dotEl.className = "nu-dot ev-c" + (Number(e.color) || 0);
    el.nextUp.appendChild(dotEl);

    const label = document.createElement("span");
    label.className = "nu-title";
    label.textContent = e.title;
    el.nextUp.appendChild(label);

    const when = document.createElement("span");
    when.className = "nu-strong";
    when.textContent =
      (e.date === dateKey(new Date()) ? "today " : fmt.dayMonth.format(keyToDate(e.date)) + " ") +
      clockLabel(minutesOf(e.time));
    el.nextUp.appendChild(when);

    const rel = document.createElement("span");
    rel.textContent = "· " + (info.ongoing ? "happening now" : relativeLabel(new Date(info.start)));
    el.nextUp.appendChild(rel);
  }

  /* ---------- interactions ---------- */

  function selectDate(d) {
    state.selected = startOfDay(d);
    if (state.view === "month") {
      if (d.getMonth() !== state.cursor.getMonth() || d.getFullYear() !== state.cursor.getFullYear()) {
        state.cursor = new Date(d.getFullYear(), d.getMonth(), 1);
      }
    } else {
      state.cursor = new Date(d);
    }
    render();
  }

  function setView(view) {
    if (state.view === view) return;
    if (view === "month") state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
    else state.cursor = new Date(state.selected);
    state.view = view;
    needsScroll = true;
    render();
  }

  function step(dir) {
    if (state.view === "day") state.cursor = addDays(state.cursor, dir);
    else if (state.view === "week") state.cursor = addDays(state.cursor, dir * 7);
    else state.cursor = addMonths(state.cursor, dir);
    if (state.view !== "month") needsScroll = true;
    if (state.view !== "month") state.selected = startOfDay(state.cursor);
    render();
  }

  function goToday() {
    state.cursor = startOfDay(new Date());
    state.selected = startOfDay(new Date());
    needsScroll = true;
    render();
  }

  function openDialog(id) {
    editingId = id || null;
    const existing = id ? eventById(id) : null;

    el.dialogTitle.textContent = existing ? "Edit event" : "New event";
    el.deleteBtn.hidden = !existing;
    el.saveBtn.textContent = existing ? "Save changes" : "Save event";

    if (existing) {
      el.fTitle.value = existing.title;
      el.fDate.value = existing.date;
      el.fTime.value = existing.time;
      el.fLength.value = String(Number(existing.length) || 60);
      el.fAddress.value = existing.address || "";
      el.fDesc.value = existing.description || "";
      pickedColor = Number(existing.color) || 0;
    } else {
      el.form.reset();
      el.fDate.value = dateKey(state.selected);
      el.fTime.value = roundToNextHalf(new Date());
      el.fLength.value = "60";
      el.fAddress.value = "";
      el.fDesc.value = "";
      pickedColor = Math.floor(Math.random() * 8);
    }

    renderSwatches();
    openModal();
    el.fTitle.focus();
  }

  function renderSwatches() {
    el.swatches.replaceChildren();
    for (let i = 0; i < 8; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch ev-c" + i;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", i === pickedColor ? "true" : "false");
      b.setAttribute("aria-label", "Color " + (i + 1));
      b.addEventListener("click", function () {
        pickedColor = i;
        renderSwatches();
      });
      el.swatches.appendChild(b);
    }
  }

  function openModal() {
    if (typeof el.dialog.showModal === "function") el.dialog.showModal();
    else el.dialog.setAttribute("open", "");
  }

  function closeDialog() {
    if (typeof el.dialog.close === "function") el.dialog.close();
    else el.dialog.removeAttribute("open");
    editingId = null;
  }

  function submitDialog(ev) {
    ev.preventDefault();
    const title = el.fTitle.value.trim();
    if (!title) {
      el.fTitle.focus();
      return;
    }

    const payload = {
      title: title,
      date: el.fDate.value || dateKey(state.selected),
      time: el.fTime.value || "09:00",
      length: Number(el.fLength.value) || 60,
      address: el.fAddress.value.trim(),
      description: el.fDesc.value.trim(),
      color: pickedColor
    };

    if (editingId) {
      const e = eventById(editingId);
      if (e) Object.assign(e, payload);
      showToast("Event updated");
    } else {
      state.events.push(Object.assign({ id: uid() }, payload));
      showToast("Event added · " + payload.time);
    }

    state.selected = keyToDate(payload.date);
    if (state.view === "month") state.cursor = keyToDate(payload.date);
    save();
    closeDialog();
    render();
  }

  function deleteEvent() {
    if (!editingId) return;
    const e = eventById(editingId);
    if (!e) return;
    const snapshot = Object.assign({}, e);
    state.events = state.events.filter(function (x) {
      return x.id !== editingId;
    });
    save();
    closeDialog();
    render();
    showToast('Deleted "' + snapshot.title + '"', function () {
      state.events.push(snapshot);
      save();
      render();
    });
  }

  function showToast(message, action) {
    el.toast.replaceChildren();
    el.toast.appendChild(document.createTextNode(message));
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Undo";
      b.addEventListener("click", function () {
        action();
        hideToast();
      });
      el.toast.appendChild(b);
    }
    el.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 2400);
  }

  function hideToast() {
    el.toast.classList.remove("is-on");
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    save();
  }

  /* ---------- events ---------- */

  el.prevBtn.addEventListener("click", function () {
    step(-1);
  });
  el.nextBtn.addEventListener("click", function () {
    step(1);
  });
  el.todayBtn.addEventListener("click", goToday);
  el.addBtn.addEventListener("click", function () {
    openDialog(null);
  });
  el.sideAddBtn.addEventListener("click", function () {
    openDialog(null);
  });
  el.themeBtn.addEventListener("click", toggleTheme);

  el.obsToggle.addEventListener("change", function () {
    state.observances = el.obsToggle.checked;
    save();
    render();
  });

  el.viewSwitch.addEventListener("click", function (ev) {
    const btn = ev.target.closest(".seg");
    if (btn) setView(btn.dataset.view);
  });

  el.dialogClose.addEventListener("click", closeDialog);
  el.cancelBtn.addEventListener("click", closeDialog);
  el.deleteBtn.addEventListener("click", deleteEvent);
  el.form.addEventListener("submit", submitDialog);

  el.dialog.addEventListener("click", function (ev) {
    if (ev.target === el.dialog) closeDialog();
  });

  el.dialog.addEventListener("cancel", function () {
    editingId = null;
  });

  document.addEventListener("keydown", function (ev) {
    const tag = (ev.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select";

    if (ev.key === "Escape") {
      if (el.dialog.open) closeDialog();
      else hideToast();
      return;
    }

    if (typing || el.dialog.open || ev.metaKey || ev.ctrlKey || ev.altKey) return;

    switch (ev.key.toLowerCase()) {
      case "t":
        goToday();
        break;
      case "m":
        setView("month");
        break;
      case "w":
        setView("week");
        break;
      case "d":
        setView("day");
        break;
      case "n":
        ev.preventDefault();
        openDialog(null);
        break;
      case "arrowleft":
        ev.preventDefault();
        step(-1);
        break;
      case "arrowright":
        ev.preventDefault();
        step(1);
        break;
      default:
        return;
    }
  });

  window.addEventListener("resize", function () {
    const active = el.viewSwitch.querySelector(".seg[aria-selected='true']");
    if (active) moveThumb(active);
  });

  /* ---------- boot ---------- */

  load();

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (prefersDark && !readStore()) state.theme = "dark";

  el.obsToggle.checked = state.observances;
  setSaved(!!readStore());
  render();

  setInterval(function () {
    renderNextUp();
    renderView();
  }, 60000);
})();