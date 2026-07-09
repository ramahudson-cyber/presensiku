import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export async function getCurrentPosition(options = {}) {
  if (isNativePlatform()) {
    const permResult = await Geolocation.requestPermissions();
    if (!permResult.location || permResult.location === 'denied') {
      throw new Error('Izin lokasi tidak diberikan');
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
    };
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
        });
      },
      (err) => {
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options }
    );
  });
}

export async function requestPermissions() {
  if (isNativePlatform()) {
    return Geolocation.requestPermissions();
  }
  return { granted: true };
}
