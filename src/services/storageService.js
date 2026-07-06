const KEYS = {
  CREDENTIALS: "siap_saved_credentials",
  BIOMETRIC_ENABLED: "siap_biometric_enabled",
};

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
  try {
    return localStorage.getItem(KEYS.BIOMETRIC_ENABLED) === "true";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled) {
  localStorage.setItem(KEYS.BIOMETRIC_ENABLED, String(enabled));
}

export async function hasSavedAccount() {
  const creds = await getCredentials();
  return !!creds?.username;
}

export async function authenticateBiometric() {
  return true;
}
