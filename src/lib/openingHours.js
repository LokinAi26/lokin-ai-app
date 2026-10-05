// OSM opening_hours parsing + "open now" status for the GPS ETA card.
// Supports the common specs: "24/7", day lists/ranges ("Mo-Fr", "Sa,Su"),
// interval lists ("06:00-22:00,23:00-01:00"), overnight ends (end <= start
// rolls into the next day), and "off"/"closed" rules. Anything unparseable
// returns raw:true so the UI shows the raw spec instead of a wrong status.

const DAY_INDEX = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clockMinutes(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function expandDaySpec(daySpec) {
  const out = [];
  for (const part of daySpec.split(",")) {
    const range = part.split("-");
    const a = DAY_INDEX[range[0]];
    if (a == null) return null;
    if (range.length === 1) {
      out.push(a);
      continue;
    }
    const b = DAY_INDEX[range[1]];
    if (b == null) return null;
    for (let d = a, i = 0; i < 7; d = (d + 1) % 7, i++) {
      out.push(d);
      if (d === b) break;
    }
  }
  return out;
}

export function parseOpeningHours(spec) {
  const t = String(spec || "").trim().toLowerCase().replace(/–/g, "-");
  if (!t) return null;
  if (t === "24/7") return { always: true };
  const days = {};
  for (const seg of t.split(";")) {
    const rule = seg.trim();
    if (!rule) continue;
    const m = /^([a-z,-\s]+?)\s+(.+)$/.exec(rule);
    if (!m) return null;
    const dayList = expandDaySpec(m[1].replace(/\s+/g, ""));
    if (!dayList || !dayList.length) return null;
    if (/^(off|closed)$/.test(m[2].trim())) {
      for (const d of dayList) days[d] = [];
      continue;
    }
    const intervals = [];
    for (const iv of m[2].split(",")) {
      const mm = /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(iv);
      if (!mm) return null;
      const start = clockMinutes(mm[1]);
      const end = clockMinutes(mm[2]);
      if (start == null || end == null || start > 1440 || end > 1440 || start === end) return null;
      intervals.push({ start, end: end <= start ? end + 1440 : end });
    }
    for (const d of dayList) days[d] = (days[d] || []).concat(intervals);
  }
  return { always: false, days };
}

export function hoursStatus(parsed, now = new Date()) {
  if (!parsed) return null;
  if (parsed.always) return { open: true, untilMin: null };
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  // Overnight interval from yesterday may still be running.
  for (const iv of parsed.days[(day + 6) % 7] || []) {
    if (iv.end > 1440 && minutes < iv.end - 1440) return { open: true, untilMin: iv.end - 1440 };
  }
  for (const iv of parsed.days[day] || []) {
    if (minutes >= iv.start && minutes < iv.end) return { open: true, untilMin: iv.end % 1440 };
  }
  // Next opening within the following week.
  for (let offset = 0; offset <= 7; offset++) {
    for (const iv of parsed.days[(day + offset) % 7] || []) {
      if (offset === 0 && iv.start <= minutes) continue;
      return { open: false, daysAhead: offset, opensMin: iv.start };
    }
  }
  return { open: false, daysAhead: null, opensMin: null };
}

function fmtTime(min) {
  return new Date(2000, 0, 1, Math.floor(min / 60) % 24, min % 60).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Returns { text, raw } — raw:true when the computed status isn't trustworthy.
export function describeHours(spec, now = new Date()) {
  const rawText = String(spec || "").trim();
  const parsed = parseOpeningHours(rawText);
  if (!parsed) return { text: rawText, raw: true };
  if (parsed.always) return { text: "Open 24/7" };
  const status = hoursStatus(parsed, now);
  if (!status) return { text: rawText, raw: true };
  if (status.open) {
    return { text: status.untilMin != null ? `Open until ${fmtTime(status.untilMin)}` : "Open now" };
  }
  if (status.opensMin == null) return { text: rawText, raw: true };
  const when = status.daysAhead === 0 ? "today" : status.daysAhead === 1 ? "tomorrow" : DAY_NAMES[(now.getDay() + status.daysAhead) % 7];
  return { text: `Closed · opens ${fmtTime(status.opensMin)} ${when}` };
}