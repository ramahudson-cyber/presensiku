import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabase";
import { getShiftReminderInfo, getShiftEndReminderInfo } from "../lib/notificationReminder";
import { getWitaDateKey, getWitaParts, getMondayFirstDayOfWeek } from "../lib/shiftTime";

const CHANNEL_ID = "shift-reminders";
const ANNOUNCEMENT_CHANNEL_ID = "announcements";

const isNative = () => Capacitor.isNativePlatform();

/**
 * Buat channel notifikasi jika belum ada (Android 8+ memerlukan channel).
 */
async function ensureChannels() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Pengingat Shift",
      description: "Notifikasi pengingat absen masuk dan pulang",
      sound: "default",
      vibration: true,
      importance: "high",
    });
    await LocalNotifications.createChannel({
      id: ANNOUNCEMENT_CHANNEL_ID,
      name: "Pengumuman",
      description: "Pengumuman dari instansi",
      sound: "default",
      vibration: true,
      importance: "default",
    });
  } catch (e) {
    console.warn("⚠️ Gagal buat notification channel:", e);
  }
}

/**
 * Minta izin notifikasi dari user (native Android).
 * Web: no-op.
 */
export async function requestNotificationPermission() {
  if (!isNative()) return false;
  try {
    await ensureChannels();
    const { permissions } = await LocalNotifications.requestPermissions();
    const granted =
      permissions?.receive === "granted" ||
      permissions?.localNotifications === "granted";
    if (!granted) {
      console.warn("⚠️ Izin notifikasi ditolak");
    }
    return granted;
  } catch (e) {
    console.warn("⚠️ Gagal minta permission notifikasi:", e);
    return false;
  }
}

/** Hash string menjadi integer positif stabil untuk id notifikasi lokal. */
function hashId(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return (h % 2000000000) + 1;
}

/**
 * Jadwalkan notifikasi lokal 15 menit sebelum shift start dan shift end.
 * Gunakan localStorage untuk memastikan hanya dijadwalkan sekali per hari.
 * @param {Date} serverNow
 * @param {object|null} employeeSchedule - jadwal hari ini { shift_code }
 * @param {object[]} shiftDefinitions - shift_schedules rows
 * @param {object|null} attendance - attendance hari ini; pengingat masuk tidak
 *   dijadwalkan bila sudah absen masuk, pengingat pulang hanya bila sudah
 *   absen masuk dan belum absen pulang
 */
export async function scheduleShiftReminders(serverNow, employeeSchedule, shiftDefinitions, attendance = null) {
  if (!isNative()) return;
  if (!employeeSchedule?.shift_code || !shiftDefinitions?.length) return;

  const today = getWitaDateKey(serverNow);
  const shiftCode = employeeSchedule.shift_code;
  // Definisi shift HARI INI — shift_code sama bisa punya jam berbeda per hari
  const nowParts = getWitaParts(serverNow);
  const dayOfWeek = nowParts ? getMondayFirstDayOfWeek(nowParts.dateKey) : null;
  const def = shiftDefinitions.find(
    (d) => d.shift_code === shiftCode
      && (dayOfWeek === null || Number(d.day_of_week) === dayOfWeek)
  ) || shiftDefinitions.find((d) => d.shift_code === shiftCode);

  // Check-in reminder: 15 menit sebelum mulai shift
  const startMatch = String(def?.start_time || "").match(/^(\d{1,2}):(\d{2})/);
  if (startMatch && !attendance?.clock_in_time) {
    const schedKey = `scheduled_notif_in_${today}_${shiftCode}`;
    if (!localStorage.getItem(schedKey)) {
      try {
        const targetDate = new Date(serverNow);
        const remindMin = Number(startMatch[1]) * 60 + Number(startMatch[2]) - 15;
        targetDate.setHours(Math.floor(remindMin / 60), remindMin % 60, 0, 0);

        if (targetDate > new Date()) {
          const info = getShiftReminderInfo(serverNow, employeeSchedule, shiftDefinitions, attendance);
          await LocalNotifications.schedule({
            notifications: [
              {
                id: hashId(`in_${today}_${shiftCode}`),
                title: "⏰ Pengingat Absen Masuk",
                body: info.show
                  ? info.message
                  : `Shift Anda dimulai 15 menit lagi. Jangan lupa absen masuk!`,
                schedule: { at: targetDate },
                channelId: CHANNEL_ID,
                sound: "default",
                vibration: true,
                actions: [],
              },
            ],
          });
          localStorage.setItem(schedKey, "1");
          console.log("✅ Notifikasi absen masuk dijadwalkan:", targetDate.toLocaleTimeString());
        }
      } catch (e) {
        console.warn("⚠️ Gagal schedule reminder masuk:", e);
      }
    }
  }

  // Check-out reminder: 15 menit sebelum akhir shift — hanya relevan bila
  // sudah absen masuk dan belum absen pulang
  const endMatch = String(def?.end_time || "").match(/^(\d{1,2}):(\d{2})/);
  if (endMatch && attendance?.clock_in_time && !attendance?.clock_out_time) {
    const schedKey = `scheduled_notif_out_${today}_${shiftCode}`;
    if (!localStorage.getItem(schedKey)) {
      try {
        const targetDate = new Date(serverNow);
        // Shift lintas tengah malam (ML): akhir shift ada di hari berikutnya
        if (def.crosses_midnight) targetDate.setDate(targetDate.getDate() + 1);
        const remindMin = Number(endMatch[1]) * 60 + Number(endMatch[2]) - 15;
        targetDate.setHours(Math.floor(remindMin / 60), remindMin % 60, 0, 0);

        if (targetDate > new Date()) {
          const info = getShiftEndReminderInfo(serverNow, employeeSchedule, shiftDefinitions, attendance);
          await LocalNotifications.schedule({
            notifications: [
              {
                id: hashId(`out_${today}_${shiftCode}`),
                title: "🔔 Pengingat Absen Pulang",
                body: info.show
                  ? info.message
                  : `Shift Anda berakhir 15 menit lagi. Jangan lupa absen pulang!`,
                schedule: { at: targetDate },
                channelId: CHANNEL_ID,
                sound: "default",
                vibration: true,
                actions: [],
              },
            ],
          });
          localStorage.setItem(schedKey, "1");
          console.log("✅ Notifikasi absen pulang dijadwalkan:", targetDate.toLocaleTimeString());
        }
      } catch (e) {
        console.warn("⚠️ Gagal schedule reminder pulang:", e);
      }
    }
  }
}

/**
 * Batalkan semua notifikasi shift terjadwal (logout / reset).
 */
export async function cancelShiftReminders() {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancelAll();
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("scheduled_notif_")) localStorage.removeItem(k);
    });
    console.log("✅ Semua notifikasi shift dibatalkan");
  } catch (e) {
    console.warn("⚠️ Gagal batalkan notifikasi:", e);
  }
}

/**
 * Registrasi push notification FCM dan simpan token perangkat.
 * Notifikasi FCM tetap masuk ke HP meskipun aplikasi ditutup total.
 */
export async function registerPushNotifications(userId) {
  if (!isNative() || !userId) return false;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("⚠️ Izin push notification ditolak");
      return false;
    }

    PushNotifications.addListener("registration", async ({ value }) => {
      try {
        await supabase.from("device_tokens").upsert(
          { user_id: userId, token: value, platform: "android" },
          { onConflict: "user_id,token" }
        );
        console.log("✅ FCM token terdaftar");
      } catch (e) {
        console.warn("⚠️ Gagal simpan FCM token:", e);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("⚠️ Registrasi push gagal (cek google-services.json):", err);
    });

    await PushNotifications.register();
    return true;
  } catch (e) {
    console.warn("⚠️ Push notification tidak tersedia:", e);
    return false;
  }
}

/**
 * Subscribe realtime ke pengumuman baru (Supabase Realtime).
 * Callback dipanggil detik itu juga saat admin mem-publish pengumuman.
 * Return fungsi unsubscribe.
 */
export function subscribeAnnouncementRealtime(onNewAnnouncement) {
  const channel = supabase
    .channel("announcements-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "announcements" },
      (payload) => onNewAnnouncement?.(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Tampilkan notifikasi lokal langsung untuk pengumuman baru (app foreground/background).
 */
export async function notifyNewAnnouncement(announcement) {
  if (!announcement?.title) return;
  if (!isNative()) {
    toast.info(`📢 ${announcement.title}`);
    return;
  }
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashId(`ann_${announcement.id}`),
          title: "📢 Pengumuman",
          body: announcement.title
            ? `${announcement.title}: ${String(announcement.content || "").slice(0, 90)}`
            : String(announcement.content || "").slice(0, 100),
          schedule: { at: new Date() },
          channelId: ANNOUNCEMENT_CHANNEL_ID,
          sound: "default",
          vibration: true,
          actions: [],
        },
      ],
    });
  } catch (e) {
    console.warn("⚠️ Gagal tampilkan notifikasi pengumuman:", e);
  }
}

/**
 * Panggil Edge Function untuk mengirim push pengumuman ke semua pegawai instansi.
 * Dipanggil oleh halaman admin setelah berhasil publish pengumuman.
 */
export async function sendPushForAnnouncement(announcementId) {
  try {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { announcement_id: announcementId },
    });
    if (error) {
      console.warn("⚠️ Kirim push gagal:", error);
      return false;
    }
    console.log("✅ Push pengumuman terkirim:", data);
    return true;
  } catch (e) {
    console.warn("⚠️ Kirim push error:", e);
    return false;
  }
}

/**
 * Registrasi web push (PWA di browser/laptop) via Firebase Cloud Messaging.
 * Token browser disimpan ke device_tokens dengan platform "web".
 * APK native memakai jalur FCM langsung (registerPushNotifications).
 *
 * PENTING Chrome Android: Notification.requestPermission() HARUS berjalan
 * dalam user gesture (sentuhan) — kalau dipanggil otomatis dari useEffect,
 * prompt tidak muncul dan permission ditolak diam-diam. Karena itu izin
 * diminta SEBELUM await import() apa pun, dan AuthContext memanggil fungsi
 * ini lewat listener gesture pertama (attachWebPushGestureListener).
 */
/**
 * Deteksi PWA Home Screen di iPhone/iPad (bukan Safari tab biasa).
 * Web push iOS hanya tersedia dalam mode standalone ini (iOS 16.4+).
 */
export function isIOSStandalone() {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return isIOS && standalone;
}

export async function registerWebPush(userId) {
  if (isNative() || !userId) return false;
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (typeof Notification === "undefined") {
    // iOS Safari tab biasa / iOS < 16.4: API hanya ada di PWA Home Screen.
    // UX dijelaskan lewat banner di dashboard, bukan prompt yang mustahil muncul.
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      console.info("ℹ️ Notifikasi web iOS hanya tersedia di PWA Home Screen (iOS 16.4+)");
    }
    return false;
  }
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return false;

  // Izin dulu — sebelum await apa pun — agar masih dalam transient
  // activation dari gesture user yang memicu pemanggilan ini.
  if (Notification.permission === "denied") {
    console.warn("⚠️ Izin notifikasi web sudah ditolak (atur manual di Settings browser)");
    return false;
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("⚠️ Izin notifikasi web ditolak");
      return false;
    }
  }

  try {
    const { FIREBASE_VAPID_KEY, getFirebaseApp } = await import("../lib/firebase");
    if (!FIREBASE_VAPID_KEY) {
      console.warn("⚠️ Web push dilewati: VAPID key belum diisi di src/lib/firebase.js");
      return false;
    }

    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (isSupported && !(await isSupported())) {
      console.warn("⚠️ Browser tidak mendukung Firebase Messaging");
      return false;
    }

    // Scope terpisah "/fcm-push/" agar SW ini TIDAK tertimpa registrasi sw.js
    // (workbox PWA, scope "/") di setiap load — sebelumnya push jatuh ke sw.js
    // yang tidak punya handler push saat PWA tertutup.
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/fcm-push/",
    });
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (!token) {
      console.warn("⚠️ Token web push kosong");
      return false;
    }

    await supabase.from("device_tokens").upsert(
      { user_id: userId, token, platform: "web" },
      { onConflict: "user_id,token" }
    );
    console.log("✅ Web push token terdaftar");
    return true;
  } catch (e) {
    console.warn("⚠️ Registrasi web push gagal:", e);
    return false;
  }
}

/**
 * Pasang listener gesture pertama (sentuhan/keyboard) setelah login, lalu
 * jalankan registerWebPush dari dalam gesture itu — satu-satunya cara
 * prompt izin notifikasi bisa muncul di Chrome Android.
 * Return fungsi cleanup.
 */
export function attachWebPushGestureListener(userId) {
  if (isNative() || !userId || typeof window === "undefined") return () => {};
  let busy = false;
  const onGesture = async () => {
    if (busy) return;
    busy = true;
    try {
      await registerWebPush(userId);
    } catch { /* diabaikan — banner di dashboard yang memandu user */ }
    busy = false;
    // Hanya berhenti memicu bila izin sudah jelas (granted/denied).
    // Masih 'default' (mis. iOS menutup prompt tanpa jawaban) → tetap
    // mendengarkan gesture berikutnya, jangan sia-siakan kesempatan.
    if (typeof Notification !== "undefined" && Notification.permission !== "default") {
      detach();
    }
  };
  const detach = () => {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("click", onGesture);
    window.removeEventListener("touchend", onGesture);
    window.removeEventListener("keydown", onGesture);
  };
  // 'click'/'touchend' adalah gesture yang diakui WebKit/iOS untuk
  // Notification.requestPermission(); 'pointerdown' cukup untuk Chrome.
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("click", onGesture);
  window.addEventListener("touchend", onGesture);
  window.addEventListener("keydown", onGesture);
  return detach;
}
