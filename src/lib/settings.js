import { supabase } from './supabase';

export async function getSetting(key, fallback = '') {
  // Baca via RPC: nilai selalu dari instansi aktif (ikut switch super_admin) —
  // memperbaiki nilai "acak" saat platform admin melihat settings semua org.
  try {
    const { data: viaRpc, error: rpcError } = await supabase
      .rpc('get_org_setting', { p_key: key });
    if (!rpcError) return viaRpc ?? fallback;
  } catch { /* fallback ke query langsung */ }
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

// Simpan setting instansi aktif (org dihitung server via current_org_id —
// ikut instansi target saat super_admin switch). RPC menolak non-admin.
export async function setSettingValue(key, value, category = 'general') {
  const { data, error } = await supabase.rpc('set_system_setting', {
    p_setting_key: key,
    p_value: value,
    p_category: category,
  });
  if (error) throw error;
  return data;
}
