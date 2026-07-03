import { Capacitor } from "@capacitor/core";

let CapacitorUpdater = null;

async function getPlugin() {
  if (!CapacitorUpdater) {
    try {
      const mod = await import("@capgo/capacitor-updater");
      CapacitorUpdater = mod.CapacitorUpdater;
    } catch {
      return null;
    }
  }
  return CapacitorUpdater;
}

export async function getCurrentBundle() {
  const plugin = await getPlugin();
  if (!plugin) return null;
  try {
    return await plugin.current();
  } catch {
    return null;
  }
}

export async function applyOtaUpdate(zipUrl, version) {
  const plugin = await getPlugin();
  if (!plugin) {
    return { success: false, error: "CapacitorUpdater tidak tersedia" };
  }
  try {
    const bundle = await plugin.download({ url: zipUrl, version });
    await plugin.set({ id: bundle.id });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || "Gagal update OTA" };
  }
}

export async function notifyAppReady() {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.notifyAppReady();
  } catch {}
}
