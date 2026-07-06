import { isNativePlatform } from "../lib/devicePlatform";

const KEYS = {
  CREDENTIALS: "siap_saved_credentials",
  BIOMETRIC_ENABLED: "siap_biometric_enabled",
};

export async function saveCredentials(username, password) {
  const data = { username, password, savedAt: new Date().toISOString() };
  if (isNativePlatform()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: KEYS.CREDENTIALS, value: JSON.stringify(data) });
  } else {
    localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(data));
  }
}

export async function getCredentials() {
  try {
    if (isNativePlatform()) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: KEYS.CREDENTIALS });
      return value ? JSON.parse(value) : null;
    } else {
      const raw = localStorage.getItem(KEYS.CREDENTIALS);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  if (isNativePlatform()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: KEYS.CREDENTIALS });
  } else {
    localStorage.removeItem(KEYS.CREDENTIALS);
  }
}

export async function isBiometricEnabled() {
  try {
    if (isNativePlatform()) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: KEYS.BIOMETRIC_ENABLED });
      return value === "true";
    }
    return localStorage.getItem(KEYS.BIOMETRIC_ENABLED) === "true";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled) {
  if (isNativePlatform()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: KEYS.BIOMETRIC_ENABLED, value: String(enabled) });
  } else {
    localStorage.setItem(KEYS.BIOMETRIC_ENABLED, String(enabled));
  }
}

export async function hasSavedAccount() {
  const creds = await getCredentials();
  return !!creds?.username;
}

export async function authenticateBiometric() {
  const { BiometricAuthNative } = await import(
    "@aparajita/capacitor-biometric-auth"
  );
  const result = await BiometricAuthNative.authenticate({
    reason: "Login cepat ke SIAP Puskesmas",
    cancelButtonTitle: "Batal",
    allowDeviceCredential: true,
  });
  return result;
}
