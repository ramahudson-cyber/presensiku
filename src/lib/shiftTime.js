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

/**
 * Hitung menit lebih awal pegawai checkout dibanding jam selesai shift
 * jadwalnya (WITA; shift lintas tengah malam selesai besok).
 * Return { earlyMinutes } bila checkout ≥ minEarlyMinutes lebih awal,
 * null bila data tidak lengkap atau tidak lebih awal dari ambang.
 */
export function getEarlyLeaveInfo(clockOutTime, scheduleDate, shiftDefinition, minEarlyMinutes = 15) {
  if (!clockOutTime || !shiftDefinition?.end_time || shiftDefinition.is_working_day === false) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate || "")) return null;
  const match = String(shiftDefinition.end_time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const endHour = Number(match[1]);
  const endMinute = Number(match[2]);
  if (endHour > 23 || endMinute > 59) return null;

  const outMs = new Date(clockOutTime).getTime();
  if (Number.isNaN(outMs)) return null;

  const [year, month, day] = scheduleDate.split("-").map(Number);
  // WITA = UTC+8 tetap (tanpa DST): absolut jam selesai shift dari tanggal jadwal
  let endMs = Date.UTC(year, month - 1, day, endHour, endMinute) - 8 * 60 * 60 * 1000;
  if (shiftDefinition.crosses_midnight) endMs += 24 * 60 * 60 * 1000;

  const earlyMinutes = Math.round((endMs - outMs) / 60000);
  if (earlyMinutes < minEarlyMinutes) return null;
  return { earlyMinutes };
}

/** "90" → "1j 30m"; "45" → "45m". */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h > 0 && rest > 0) return `${h}j ${rest}m`;
  if (h > 0) return `${h}j`;
  return `${rest}m`;
}

/**
 * Jendela waktu absen masuk: hanya terbuka mulai `leadMinutes` menit
 * sebelum jam mulai shift (WITA) — mirror guard_attendance_self_write.
 * Kontinuasi dini hari shift lintas malam selalu terbuka (+1440).
 * Definisi tidak lengkap / placeholder 00:00 dianggap terbuka —
 * server yang menegakkan aturan sebenarnya.
 * Return { open, minutesUntil }: minutesUntil > 0 berarti masih tertutup.
 */
export function isCheckInWindowOpen(shiftDefinition, now = new Date(), leadMinutes = 15) {
  if (!shiftDefinition?.start_time || shiftDefinition.is_working_day === false) {
    return { open: true, minutesUntil: 0 };
  }
  const match = String(shiftDefinition.start_time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { open: true, minutesUntil: 0 };
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  if (startHour > 23 || startMinute > 59) return { open: true, minutesUntil: 0 };
  if (startHour === 0 && startMinute === 0) return { open: true, minutesUntil: 0 };

  const nowParts = getWitaParts(now);
  if (!nowParts) return { open: true, minutesUntil: 0 };

  const nowTotal = nowParts.hour * 60 + nowParts.minute;
  const startTotal = startHour * 60 + startMinute;

  // Kontinuasi dini hari shift lintas malam: mirror guard (+1440)
  let adjusted = nowTotal;
  if (shiftDefinition.crosses_midnight && nowTotal < 720 && nowTotal < startTotal) {
    adjusted = nowTotal + 1440;
  }

  const minutesUntil = startTotal - leadMinutes - adjusted;
  if (minutesUntil <= 0) return { open: true, minutesUntil: 0 };
  return { open: false, minutesUntil };
}

/**
 * Label zona waktu Indonesia sesuai timezone perangkat:
 * Asia/Jakarta → WIB (UTC+7), Asia/Makassar → WITA (UTC+8),
 * Asia/Jayapura → WIT (UTC+9). Selain itu default aplikasi: WITA.
 */
export function getZonaWaktuLabel() {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch { /* Intl tidak tersedia */ }
  if (tz === "Asia/Jakarta") return "WIB";
  if (tz === "Asia/Jayapura") return "WIT";
  return "WITA";
}
