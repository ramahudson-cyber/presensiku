import { getWitaParts, getMondayFirstDayOfWeek } from "./shiftTime";

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
