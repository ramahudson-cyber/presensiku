const KEYS = {
  CREDENTIALS: "siap_saved_credentials",
  BIOMETRIC_ENABLED: "siap_biometric_enabled",
};

async function getPreferences() {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  } catch {
    return null;
  }
}

async function getBiometricAuth() {
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    return BiometricAuth;
  } catch {
    return null;
  }
}

export async function saveCredentials(username, password) {
  const data = { username, password, savedAt: new Date().toISOString() };
  const json = JSON.stringify(data);
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key: KEYS.CREDENTIALS, value: json });
  } else {
    localStorage.setItem(KEYS.CREDENTIALS, json);
  }
}

export async function getCredentials() {
  try {
    const prefs = await getPreferences();
    let raw;
    if (prefs) {
      const result = await prefs.get({ key: KEYS.CREDENTIALS });
      raw = result.value;
    } else {
      raw = localStorage.getItem(KEYS.CREDENTIALS);
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.remove({ key: KEYS.CREDENTIALS });
  }
  localStorage.removeItem(KEYS.CREDENTIALS);
}

export async function isBiometricEnabled() {
  try {
    const prefs = await getPreferences();
    if (prefs) {
      const result = await prefs.get({ key: KEYS.BIOMETRIC_ENABLED });
      return result.value === "true";
    }
    return localStorage.getItem(KEYS.BIOMETRIC_ENABLED) === "true";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled) {
  const val = String(enabled);
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key: KEYS.BIOMETRIC_ENABLED, value: val });
  }
  localStorage.setItem(KEYS.BIOMETRIC_ENABLED, val);
}

export async function hasSavedAccount() {
  const creds = await getCredentials();
  return !!creds?.username;
}

export async function authenticateBiometric() {
  const BiometricAuth = await getBiometricAuth();
  if (!BiometricAuth) return true;
  try {
    const result = await BiometricAuth.authenticate({
      reason: "Login ke SIAP Puskesmas",
      cancelTitle: "Batal",
    });
    return result.authenticated === true;
  } catch {
    return false;
  }
}
