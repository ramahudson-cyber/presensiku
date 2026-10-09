import { Capacitor } from '@capacitor/core';

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function isAndroidCapacitor() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isIOSCapacitor() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Classify the runtime used to access the app. Native Capacitor must be
 * checked before the browser user agent because the Android WebView also
 * contains the Android marker.
 */
export function getDeviceType() {
  if (isNativePlatform()) return 'native';

  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Only regular employees are platform-bound. Admin and supervisory roles
 * remain usable from web or native clients as required by operations.
 *
 * Kebijakan anti fake-GPS (berlapis):
 *   - Android: WAJIB lewat APK native. Chrome/PWA Android DIBLOKIR TOTAL,
 *     karena browser tidak punya API deteksi mock location — celah fake GPS
 *     paling mudah. Push notification pegawai ikut pindah ke APK.
 *   - iOS: TIDAK ada APK, jadi PWA iOS tetap DIIZINKAN untuk absen. Deteksi
 *     lokasi palsu di iOS mengandalkan validasi sisi server (radius,
 *     velocity, dan sinyal integritas lain).
 *   - Desktop web: tetap diblokir (absen dari PC = celah paling mudah).
 *
 * Catatan: iOS di WebView/PWA juga terdeteksi sebagai 'ios' (bukan 'native'
 * Capacitor), dan memang sengaja diizinkan.
 */
export function isPegawaiWebBlocked(role, deviceType = getDeviceType()) {
  if (role !== 'pegawai') return false;
  return deviceType === 'desktop' || deviceType === 'android';
}

// true hanya bila pegawai dibuka dari Android via browser/PWA (bukan APK).
export function isAndroidWebBlocked(role, deviceType = getDeviceType()) {
  return role === 'pegawai' && deviceType === 'android';
}

export function getBlockDeviceType(deviceType = getDeviceType()) {
  return deviceType === 'android' ? 'android' : 'desktop';
}
