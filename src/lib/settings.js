import { supabase } from './supabase';

export async function getSetting(key, fallback = '') {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('setting_key', key)
      .maybeSingle();
    return data?.value ?? fallback;
  } catch {
    return fallback;
  }
}
