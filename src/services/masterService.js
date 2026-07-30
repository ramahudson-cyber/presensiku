import { supabase } from '../lib/supabase';

export const MasterService = {
  // Fetch
  getPositions: async () => await supabase.from('positions').select('*').order('name'),
  getRoles: async () => await supabase.from('roles').select('*').order('name'),
  getStatuses: async () => await supabase.from('employment_statuses').select('*').order('name'),

  // CRUD Jabatan
  addPosition: async (name) => await supabase.from('positions').insert({ name }),
  deletePosition: async (id) => await supabase.from('positions').delete().eq('id', id),

  // CRUD Role
  addRole: async (name) => await supabase.from('roles').insert({ name }),
  deleteRole: async (id) => await supabase.from('roles').delete().eq('id', id),

  // CRUD Status
  addStatus: async (name) => await supabase.from('employment_statuses').insert({ name }),
  deleteStatus: async (id) => await supabase.from('employment_statuses').delete().eq('id', id),
};
