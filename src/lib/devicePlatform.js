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
 */
export function isPegawaiWebBlocked(role, deviceType = getDeviceType()) {
  return role === 'pegawai' && (deviceType === 'android' || deviceType === 'desktop');
}

export function getBlockDeviceType(deviceType = getDeviceType()) {
  return deviceType === 'android' ? 'android' : 'desktop';
}
