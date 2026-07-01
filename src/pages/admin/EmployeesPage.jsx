import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // ✅ FIX: path yang benar
import { toast } from 'react-toastify';
import {
  UserPlus, Pencil, Trash2, X, Search, Users, Mail,
  Briefcase, User, IdCard,
} from 'lucide-react';
import ConfirmSheet from '../../components/ConfirmSheet';

const cardBase =
  'bg-[#c190ff]/15 border border-white/10 rounded-2xl transition-all';

const inputBase =
  'w-full px-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all';

const labelBase =
  'block text-xs font-medium text-violet-100/70 mb-1.5 uppercase tracking-wider';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    full_name: '',
    email: '',
    role: '',
    employee_status: '',
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.error('❌ Fetch error:', error);
        toast.error('Gagal memuat data pegawai: ' + error.message);
      } else {
        console.log('✅ Employees fetched:', data);
        setEmployees(data || []);
      }
    } catch (err) {
      console.error('❌ Error:', err);
      toast.error('Gagal memuat data pegawai');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const resetForm = () => {
    setFormData({
      id: '', username: '', full_name: '', email: '',
      role: '', employee_status: '',
    });
    setShowForm(false);
  };

  const handleEdit = (employee) => {
    setFormData(employee);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus pegawai');
    } else {
      toast.success('Pegawai berhasil dihapus');
      fetchEmployees();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.id) {
        // UPDATE
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            email: formData.email,
            role: formData.role,
            employee_status: formData.employee_status,
          })
          .eq('id', formData.id);

        if (error) throw error;
        toast.success('Pegawai berhasil diperbarui');
      } else {
        // CREATE via RPC
        const { error } = await supabase.rpc('create_employee_with_auth', {
          p_username: formData.username,
          p_full_name: formData.full_name,
          p_email: formData.email,
          p_password: 'Puskesmas@123',
          p_role: formData.role,
          p_employee_status: formData.employee_status,
          p_department: null,
          p_position: null,
        });

        if (error) throw error;
        toast.success('Pegawai berhasil ditambahkan');
      }

      resetForm();
      fetchEmployees();
    } catch (err) {
      console.error('❌ Submit error:', err);
      toast.error('Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const filtered = employees.filter(emp =>
    (emp.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (emp.username || '').toLowerCase().includes(search.toLowerCase()) ||

  );

  const roleBadge = (role) => {
    const map = {
      super_admin: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
      admin_puskesmas: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
      kepala_unit: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
      pegawai: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    };
    return map[role] || 'bg-white/5 text-slate-200 ring-white/10';
  };

  const statusBadge = (status) => {
    const map = {
      asn: 'bg-emerald-500/15 text-emerald-300',
      pppk_penuh_waktu: 'bg-sky-500/15 text-sky-300',
      pppk_paruh_waktu: 'bg-sky-500/15 text-sky-300',
      tpk: 'bg-amber-500/15 text-amber-300',
    };
    return map[status] || 'bg-white/5 text-slate-200';
  };

  // Avatar initials
  const initials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const avatarGradient = (name = '') => {
    const grads = [
      'from-violet-500 to-purple-700',
      'from-sky-500 to-blue-700',
      'from-emerald-500 to-teal-700',
      'from-amber-500 to-orange-700',
      'from-rose-500 to-pink-700',
      'from-fuchsia-500 to-purple-700',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return grads[sum % grads.length];
  };

  return (
    <>
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Manajemen Pegawai
          </h1>
          <p className="text-slate-200 text-sm mt-1 flex items-center gap-1.5">
            <Users size={13} />
            Total: <span className="font-semibold text-violet-100">{employees.length}</span> pegawai
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-4 py-3 border-gradient bg-transparent text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 active:scale-95 transition-all w-full sm:w-auto"
        >
          <UserPlus size={16} />
          Tambah Pegawai
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all backdrop-blur-sm"
        />
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1a0a35] border border-white/10 rounded-2xl shadow-2xl shadow-violet-900/40 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 sticky top-0 bg-[#1a0a35]/95 backdrop-blur-md z-10">
              <h2 className="text-lg font-bold text-white">
                {formData.id ? 'Edit Pegawai' : 'Tambah Pegawai Baru'}
              </h2>
              <button
                onClick={resetForm}
                className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
              {!formData.id && (
                <div>
                  <label className={labelBase}>
                    <IdCard size={11} className="inline mr-1" />
                    Username *
                  </label>
                  <input
                    type="text" name="username" value={formData.username}
                    onChange={handleInputChange} required
                    placeholder="Contoh: AMP0001"
                    className={inputBase}
                  />
                </div>
              )}

              <div>
                <label className={labelBase}>
                  <User size={11} className="inline mr-1" />
                  Nama Lengkap *
                </label>
                <input
                  type="text" name="full_name" value={formData.full_name}
                  onChange={handleInputChange} required
                  placeholder="Nama lengkap pegawai"
                  className={inputBase}
                />
              </div>

              <div>
                <label className={labelBase}>
                  <Mail size={11} className="inline mr-1" />
                  Email *
                </label>
                <input
                  type="email" name="email" value={formData.email}
                  onChange={handleInputChange} required
                  placeholder="email@puskesmas.local"
                  className={inputBase}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelBase}>
                    <Briefcase size={11} className="inline mr-1" />
                    Role *
                  </label>
                  <select name="role" value={formData.role} onChange={handleInputChange} required
                    className={inputBase}>
                    <option value="" className="bg-[#1a0a35]">Pilih Role</option>
                    <option value="super_admin" className="bg-[#1a0a35]">Super Admin</option>
                    <option value="admin_puskesmas" className="bg-[#1a0a35]">Admin Puskesmas</option>
                    <option value="kepala_unit" className="bg-[#1a0a35]">Kepala Unit</option>
                    <option value="pegawai" className="bg-[#1a0a35]">Pegawai</option>
                  </select>
                </div>

                <div>
                  <label className={labelBase}>
                    <IdCard size={11} className="inline mr-1" />
                    Status *
                  </label>
                  <select name="employee_status" value={formData.employee_status} onChange={handleInputChange} required
                    className={inputBase}>
                    <option value="" className="bg-[#1a0a35]">Pilih Status</option>
                    <option value="asn" className="bg-[#1a0a35]">ASN</option>
                    <option value="pppk_penuh_waktu" className="bg-[#1a0a35]">PPPK Penuh Waktu</option>
                    <option value="pppk_paruh_waktu" className="bg-[#1a0a35]">PPPK Paruh Waktu</option>
                    <option value="tpk" className="bg-[#1a0a35]">TPK</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2 sticky bottom-0 bg-[#1a0a35]/95 backdrop-blur-md -mx-5 md:-mx-6 px-5 md:px-6 pb-2 -mb-2">
                <button type="button" onClick={resetForm}
                  className="flex-1 py-2.5 border-gradient bg-transparent text-white rounded-xl text-sm font-medium hover:bg-white/5 transition-all">
                  Batal
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 border-gradient bg-transparent text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading && <RefreshCwIconSpinning />}
                  {loading ? 'Menyimpan...' : formData.id ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Table + Mobile Cards */}
      <div className={`${cardBase} overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500/30 border-t-violet-400"></div>
            <span className="text-slate-200 text-sm">Memuat data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="p-4 rounded-2xl bg-white/5">
              <Users size={32} className="text-slate-400" />
            </div>
            <div>
              <p className="text-violet-200/60 font-medium">Tidak ada data pegawai</p>
              <p className="text-slate-400 text-xs mt-1">
                Klik "Tambah Pegawai" untuk menambahkan
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider">Nama</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider hidden xl:table-cell">Username</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider hidden lg:table-cell">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-200 text-xs uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white/5 transition-all">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(emp.full_name)} flex items-center justify-center text-white text-xs font-bold shadow-lg shrink-0`}>
                            {initials(emp.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white">{emp.full_name || '-'}</p>
                            <p className="text-xs text-slate-400 xl:hidden font-mono mt-0.5">{emp.username || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-violet-200/60 font-mono text-xs hidden xl:table-cell">{emp.username || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${roleBadge(emp.role)}`}>
                          {emp.role || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(emp.employee_status)}`}>
                          {emp.employee_status || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(emp)}
                            className="p-1.5 text-sky-300 hover:bg-sky-500/15 rounded-lg transition-all hover:scale-110"
                            title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => handleDelete(emp.id)}
                            className="p-1.5 text-rose-300 hover:bg-rose-500/15 rounded-lg transition-all hover:scale-110"
                            title="Hapus">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              {filtered.map((emp) => (
                <div key={emp.id} className="p-4 hover:bg-white/5 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient(emp.full_name)} flex items-center justify-center text-white text-sm font-bold shadow-lg shrink-0`}>
                      {initials(emp.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{emp.full_name || '-'}</p>
                          <p className="text-xs text-slate-400 font-mono">@{emp.username || '-'}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleEdit(emp)}
                            className="p-1.5 text-sky-300 bg-sky-500/10 rounded-lg active:scale-95 transition-all"
                            aria-label="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(emp.id)}
                            className="p-1.5 text-rose-300 bg-rose-500/10 rounded-lg active:scale-95 transition-all"
                            aria-label="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${roleBadge(emp.role)}`}>
                          {emp.role || '-'}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(emp.employee_status)}`}>
                          {emp.employee_status || '-'}
                        </span>
                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    <ConfirmSheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
      title="Hapus Pegawai" message="Yakin hapus pegawai ini?"
      confirmText="Ya, Hapus" onConfirm={confirmDeleteAction} />
    </>
  );
};

// tiny inline spinner used by submit button (avoid extra imports)
function RefreshCwIconSpinning() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export default EmployeesPage;

