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

// Watch GPS kontinu (native Capacitor + web). Return fungsi stop.
// onPosition menerima payload identik dengan getCurrentPosition.
export async function watchPosition(options = {}, onPosition, onError) {
  const normalize = (pos) => ({
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
  });

  if (isNativePlatform()) {
    try {
      const permResult = await Geolocation.requestPermissions();
      if (!permResult.location || permResult.location === 'denied') {
        throw new Error('Izin lokasi tidak diberikan');
      }
    } catch (err) {
      onError?.(err);
      return () => {};
    }
    const id = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options },
      (position, err) => {
        if (err) { onError?.(err); return; }
        if (position) onPosition?.(normalize(position));
      }
    );
    return () => { Geolocation.clearWatch({ id }); };
  }

  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation not supported'));
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPosition?.(normalize(pos)),
    (err) => onError?.(err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
