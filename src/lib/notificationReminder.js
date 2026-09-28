import { getWitaParts, getMondayFirstDayOfWeek, addCalendarDays } from "./shiftTime";

const SHIFT_NAMES = { PG: "Pagi", SR: "Sore", SI: "Siang", ML: "Malam" };

/**
 * Compute shift reminder info based on current time.
 * @param {Date} serverNow - server time
 * @param {object|null} employeeSchedule - today's employee_schedule row { shift_code }
 * @param {object[]} shiftDefinitions - shift_schedules rows [{ shift_code, day_of_week, start_time, is_working_day }]
 * @returns {{ show: boolean, message?: string, minutesUntil?: number, shiftStartFormatted?: string, shiftLabel?: string }}
 */
export function getShiftReminderInfo(serverNow, employeeSchedule, shiftDefinitions) {
  if (!employeeSchedule?.shift_code) return { show: false };

  const nowParts = getWitaParts(serverNow);
  if (!nowParts) return { show: false };

  const dayOfWeek = getMondayFirstDayOfWeek(nowParts.dateKey);
  const def = shiftDefinitions?.find(
    (d) => d.shift_code === employeeSchedule.shift_code
      && Number(d.day_of_week) === dayOfWeek
  );

  if (!def?.start_time || !def?.is_working_day) return { show: false };

  const match = String(def.start_time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { show: false };

  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const startTotal = startHour * 60 + startMinute;
  const nowTotal = nowParts.hour * 60 + nowParts.minute;
  const diff = startTotal - nowTotal;

  // Within 15 minutes before shift start up to 5 minutes after
  if (diff > 15 || diff < -5) return { show: false };

  const shiftLabel = SHIFT_NAMES[employeeSchedule.shift_code] || employeeSchedule.shift_code;
  const shiftStartFormatted = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;

  let message;
  if (diff > 0) {
    message = `Shift ${shiftLabel} Anda dimulai pukul ${shiftStartFormatted} WITA (${diff} menit lagi). Jangan lupa absen!`;
  } else {
    message = `Shift ${shiftLabel} Anda sudah mulai! Segera absen masuk.`;
  }

  return { show: true, message, minutesUntil: diff, shiftStartFormatted, shiftLabel };
}

/**
 * Hitung jumlah announcement yang belum dibaca oleh user.
 * @param {object[]} announcements - array announcement rows
 * @param {Set<string>} ackedIds - Set of announcement ids yang sudah di-ack
 * @returns {number}
 */
export function getUnreadCount(announcements, ackedIds) {
  return announcements.filter((a) => !ackedIds.has(a.id)).length;
}

/** Key localStorage untuk flag toast reminder — unik per shift per tanggal */
export function reminderToastKey(today, shiftCode) {
  return `reminder_toast_${today}_${shiftCode || "none"}`;
}

/** Key localStorage untuk flag toast reminder akhir shift */
export function reminderToastEndKey(today, shiftCode) {
  return `reminder_toast_end_${today}_${shiftCode || "none"}`;
}

/**
 * Compute shift end reminder: 15 menit sebelum jam selesai shift.
 * @param {Date} serverNow
 * @param {object|null} employeeSchedule
 * @param {object[]} shiftDefinitions
 * @returns {{ show: boolean, message?: string, minutesUntil?: number, shiftEndFormatted?: string, shiftLabel?: string }}
 */
export function getShiftEndReminderInfo(serverNow, employeeSchedule, shiftDefinitions) {
  if (!employeeSchedule?.shift_code) return { show: false };

  const nowParts = getWitaParts(serverNow);
  if (!nowParts) return { show: false };

  const dayOfWeek = getMondayFirstDayOfWeek(nowParts.dateKey);
  const def = shiftDefinitions?.find(
    (d) => d.shift_code === employeeSchedule.shift_code
      && Number(d.day_of_week) === dayOfWeek
  );

  if (!def?.end_time || !def?.is_working_day) return { show: false };

  const match = String(def.end_time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { show: false };

  const endHour = Number(match[1]);
  const endMinute = Number(match[2]);
  const endTotal = endHour * 60 + endMinute;

  // Untuk shift lintas tengah malam, end time ada di +1 hari.
  const targetDateKey = def.crosses_midnight
    ? addCalendarDays(nowParts.dateKey, 1)
    : nowParts.dateKey;

  // Hanya tampilkan jika tanggal target end = tanggal hari ini (atau +1 untuk overnight).
  if (targetDateKey !== nowParts.dateKey) return { show: false };

  const nowTotal = nowParts.hour * 60 + nowParts.minute;
  const diff = endTotal - nowTotal;

  // Within 15 minutes before shift end (up to exactly end time, no after)
  if (diff <= 0 || diff > 15) return { show: false };

  const shiftLabel = SHIFT_NAMES[employeeSchedule.shift_code] || employeeSchedule.shift_code;
  const shiftEndFormatted = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  const message = `Shift ${shiftLabel} Anda berakhir pukul ${shiftEndFormatted} WITA (${diff} menit lagi). Jangan lupa absen pulang!`;

  return { show: true, message, minutesUntil: diff, shiftEndFormatted, shiftLabel };
}
