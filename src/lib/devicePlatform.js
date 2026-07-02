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
