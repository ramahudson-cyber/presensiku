const WITA_TIME_ZONE = "Asia/Makassar";

const WITA_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: WITA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Return an instant's calendar/time components in WITA. */
export function getWitaParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    WITA_PARTS.formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, Number(partValue)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    dateKey: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
  };
}

/** Return a YYYY-MM-DD key for an instant in WITA. */
export function getWitaDateKey(value = new Date()) {
  return getWitaParts(value)?.dateKey || null;
}

/** Return Monday=0 ... Sunday=6 for a date-only YYYY-MM-DD key. */
export function getMondayFirstDayOfWeek(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/** Add calendar days to a date-only YYYY-MM-DD key without local timezone conversion. */
export function addCalendarDays(dateKey, amount) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/**
 * Find the shift definition for an employee schedule row.
 * shift_schedules uses Monday=0 ... Sunday=6.
 */
export function getShiftDefinition(shiftDefinitions, schedule) {
  if (!schedule?.shift_code || !schedule?.date || !Array.isArray(shiftDefinitions)) return null;
  const dayOfWeek = getMondayFirstDayOfWeek(schedule.date);
  return shiftDefinitions.find(
    (definition) => definition.shift_code === schedule.shift_code
      && Number(definition.day_of_week) === dayOfWeek
  ) || null;
}

/**
 * A scheduled shift becomes eligible for Alpha only after its configured end.
 * The comparison is made in WITA wall-clock time, including overnight shifts.
 */
export function isShiftEnded(scheduleDate, shiftDefinition, now = new Date()) {
  if (!shiftDefinition?.is_working_day || !shiftDefinition.end_time) return false;
  const match = String(shiftDefinition.end_time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return false;

  const endHour = Number(match[1]);
  const endMinute = Number(match[2]);
  if (endHour > 23 || endMinute > 59) return false;

  const nowParts = getWitaParts(now);
  if (!nowParts || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate || "")) return false;

  const endDateKey = shiftDefinition.crosses_midnight
    ? addCalendarDays(scheduleDate, 1)
    : scheduleDate;

  if (nowParts.dateKey !== endDateKey) return nowParts.dateKey > endDateKey;

  const nowSeconds = nowParts.hour * 3600 + nowParts.minute * 60 + nowParts.second;
  const endSeconds = endHour * 3600 + endMinute * 60;
  return nowSeconds >= endSeconds;
}
