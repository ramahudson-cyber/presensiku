import { getWitaParts, getMondayFirstDayOfWeek, addCalendarDays } from "./shiftTime";

const SHIFT_NAMES = { PG: "Pagi", SR: "Sore", SI: "Siang", ML: "Malam" };

/**
 * Compute shift reminder info based on current time.
 * @param {Date} serverNow - server time
 * @param {object|null} employeeSchedule - today's employee_schedule row { shift_code }
 * @param {object[]} shiftDefinitions - shift_schedules rows [{ shift_code, day_of_week, start_time, is_working_day }]
 * @param {object|null} [attendance] - attendance hari ini; pengingat masuk
 *   disembunyikan bila sudah absen masuk (clock_in_time terisi)
 * @returns {{ show: boolean, message?: string, minutesUntil?: number, shiftStartFormatted?: string, shiftLabel?: string }}
 */
export function getShiftReminderInfo(serverNow, employeeSchedule, shiftDefinitions, attendance = null) {
  if (!employeeSchedule?.shift_code) return { show: false };
  if (attendance?.clock_in_time) return { show: false };

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
  // Placeholder hari non-kerja mulai 00:00 — konsisten dengan guard server.
  if (startTotal === 0) return { show: false };
  const nowTotal = nowParts.hour * 60 + nowParts.minute;
  const diff = startTotal - nowTotal;

  // Dari 15 menit sebelum shift mulai HINGGA shift berakhir: selama belum
  // absen masuk, pegawai terus diingatkan (dulu hanya −15..+5 menit sehingga
  // pengingat masuk nyaris tidak pernah terlihat).
  if (diff > 15) return { show: false };

  // Sudah lewat jam selesai shift → tidak ada gunanya lagi mengingatkan masuk.
  const endMatch = def.end_time ? String(def.end_time).match(/^(\d{1,2}):(\d{2})/) : null;
  if (endMatch && !def.crosses_midnight) {
    const endTotal = Number(endMatch[1]) * 60 + Number(endMatch[2]);
    if (nowTotal >= endTotal) return { show: false };
  }

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
 * Hanya relevan bila pegawai SUDAH absen masuk dan BELUM absen pulang —
 * tanpa guard ini banner "absen pulang" muncul padahal pegawai belum
 * melakukan absen masuk.
 * Shift lintas malam hari ini (berakhir besok pagi): banner in-app tidak
 * dapat ditentukan dari jadwal hari ini — didorong notifikasi native
 * terjadwal. Kontinuasi dini hari (shift malam KEMARIN berakhir pagi ini)
 * ditangani bila `yesterdaySchedule` diberikan pemanggil.
 * @param {Date} serverNow
 * @param {object|null} employeeSchedule
 * @param {object[]} shiftDefinitions
 * @param {object|null} [attendance] - attendance hari ini { clock_in_time, clock_out_time }
 * @param {object|null} [yesterdaySchedule] - jadwal kemarin { shift_code, date }
 * @returns {{ show: boolean, message?: string, minutesUntil?: number, shiftEndFormatted?: string, shiftLabel?: string }}
 */
export function getShiftEndReminderInfo(serverNow, employeeSchedule, shiftDefinitions, attendance = null, yesterdaySchedule = null) {
  if (!employeeSchedule?.shift_code) return { show: false };
  // Belum absen masuk → pengingat pulang tidak relevan. Sudah absen pulang → tidak perlu diingatkan lagi.
  if (!attendance?.clock_in_time || attendance?.clock_out_time) return { show: false };

  const nowParts = getWitaParts(serverNow);
  if (!nowParts) return { show: false };

  const nowTotal = nowParts.hour * 60 + nowParts.minute;
  const parseEnd = (end) => {
    const match = String(end).match(/^(\d{1,2}):(\d{2})/);
    return match ? { h: Number(match[1]), m: Number(match[2]) } : null;
  };
  const findDef = (sched, dateKey) => {
    const dow = getMondayFirstDayOfWeek(dateKey);
    return shiftDefinitions?.find(
      (d) => d.shift_code === sched?.shift_code && Number(d.day_of_week) === dow
    ) || null;
  };
  const build = (def, diff, endH, endM) => {
    const shiftLabel = SHIFT_NAMES[employeeSchedule.shift_code] || employeeSchedule.shift_code;
    const shiftEndFormatted = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    return {
      show: true,
      message: `Shift ${shiftLabel} Anda berakhir pukul ${shiftEndFormatted} WITA (${diff} menit lagi). Jangan lupa absen pulang!`,
      minutesUntil: diff,
      shiftEndFormatted,
      shiftLabel,
    };
  };

  // 1) Shift hari ini berakhir HARI INI (bukan lintas malam)
  const def = findDef(employeeSchedule, nowParts.dateKey);
  if (def?.end_time && def?.is_working_day && !def.crosses_midnight) {
    const end = parseEnd(def.end_time);
    if (!end) return { show: false };
    const diff = end.h * 60 + end.m - nowTotal;
    if (diff <= 0 || diff > 15) return { show: false };
    return build(def, diff, end.h, end.m);
  }

  // 2) Kontinuasi dini hari: shift malam KEMARIN berakhir pagi ini
  if (yesterdaySchedule?.shift_code) {
    const yDef = findDef(yesterdaySchedule, addCalendarDays(nowParts.dateKey, -1));
    if (yDef?.end_time && yDef?.is_working_day && yDef?.crosses_midnight) {
      const end = parseEnd(yDef.end_time);
      if (!end) return { show: false };
      const diff = end.h * 60 + end.m - nowTotal;
      if (diff <= 0 || diff > 15) return { show: false };
      return build(yDef, diff, end.h, end.m);
    }
  }

  return { show: false };
}
