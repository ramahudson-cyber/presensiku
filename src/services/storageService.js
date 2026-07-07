const KEYS = {
  CREDENTIALS: "siap_saved_credentials",
  BIOMETRIC_ENABLED: "siap_biometric_enabled",
};

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label ? `Timeout ${label} after ${ms}ms` : `Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export async function saveCredentials(username, password) {
  const data = { username, password, savedAt: new Date().toISOString() };
  localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(data));
}

export async function getCredentials() {
  try {
    const raw = localStorage.getItem(KEYS.CREDENTIALS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  localStorage.removeItem(KEYS.CREDENTIALS);
}

export async function isBiometricEnabled() {
  return localStorage.getItem(KEYS.BIOMETRIC_ENABLED) === "true";
}

export async function setBiometricEnabled(enabled) {
  localStorage.setItem(KEYS.BIOMETRIC_ENABLED, String(enabled));
}

export async function hasSavedAccount() {
  const creds = await getCredentials();
  return !!creds?.username;
}

export async function authenticateBiometric() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return true;
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const result = await withTimeout(BiometricAuth.authenticate({
      reason: "Login ke SIAP Puskesmas",
      cancelTitle: "Batal",
    }), 10000, "BiometricAuth.authenticate");
    return result.authenticated === true;
  } catch {
    return false;
  }
}
