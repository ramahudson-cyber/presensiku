import { supabase } from './supabase';

const cache = {};

export async function getSetting(key, fallback = '') {
  if (cache[key] !== undefined) return cache[key];
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();
    const val = data?.value ?? fallback;
    cache[key] = val;
    return val;
  } catch {
    return fallback;
  }
}

export function clearSettingsCache() {
  Object.keys(cache).forEach(k => delete cache[k]);
}
