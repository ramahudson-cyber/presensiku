import React, { useState, useEffect, useMemo } from 'react';

// === DATA MOCK SYSTEM ===
const INITIAL_EMPLOYEES = [
  { id: '1', nip: '198804122015031002', name: 'dr. H. Ahmad Fauzi', role: 'Dokter Umum / Kepala Puskesmas', unit: 'Pimpinan', status: 'Hadir', image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&q=80' },
  { id: '2', nip: '199012052018012003', name: 'Ns. Baiq Elma, S.Kep', role: 'Perawat Penyelia', unit: 'UGD & Rawat Inap', status: 'Hadir', image: 'https://images.unsplash.com/photo-1594824813573-246434e33963?auto=format&fit=crop&w=150&q=80' },
  { id: '3', nip: '199408222020122001', name: 'Apt. Riza Lestari, S.Farm', role: 'Apoteker', unit: 'Farmasi / Apotek', status: 'Izin', image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&q=80' },
  { id: '4', nip: '199201152019031005', name: 'drg. Nyoman Triadi', role: 'Dokter Gigi', unit: 'Poli Gigi', status: 'Hadir', image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=150&q=80' },
  { id: '5', nip: '198905302015032001', name: 'Siti Rahmawati, Amd.Keb', role: 'Bidan Koordinator', unit: 'KIA / KB', status: 'Cuti', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80' },
  { id: '6', nip: '199511112022031002', name: 'Dedy Kurniawan, S.Gz', role: 'Nutrisionis', unit: 'Poli Gizi', status: 'Hadir', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80' },
  { id: '7', nip: '199103032017042004', name: 'Luh Putu Swasti, A.Md.AK', role: 'Pranata Lab', unit: 'Laboratorium', status: 'Terlambat', image: 'https://images.unsplash.com/photo-1582750433449-649352e3ff4a?auto=format&fit=crop&w=150&q=80' },
  { id: '8', nip: '199307252020011003', name: 'Zulkipli, A.Md.Kep', role: 'Perawat Pelaksana', unit: 'Poli Umum', status: 'Alpha', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80' },
];

const INITIAL_LEAVE_REQUESTS = [
  { id: 1, type: 'Cuti Tahunan', startDate: '2026-06-15', endDate: '2026-06-18', reason: 'Acara pernikahan keluarga', status: 'Menunggu', dateFiled: '2026-06-10' },
  { id: 2, type: 'Izin Sakit', startDate: '2026-06-08', endDate: '2026-06-09', reason: 'Demam tinggi dan flu (Surat Dokter Terlampir)', status: 'Disetujui', dateFiled: '2026-06-07' },
  { id: 3, type: 'Cuti Melahirkan', startDate: '2026-07-01', endDate: '2026-09-30', reason: 'Persalinan anak pertama', status: 'Disetujui', dateFiled: '2026-06-05' },
  { id: 4, type: 'Izin Alasan Penting', startDate: '2026-06-01', endDate: '2026-06-02', reason: 'Mengurus administrasi waris luar kota', status: 'Ditolak', dateFiled: '2026-05-28' },
];

export default function App() {
  // === STATE MANAGEMENT ===
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [username, setUsername] = useState('199012052018012003');
  const [password, setPassword] = useState('********');
  const [rememberMe, setRememberMe] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Simulated User Data (Ners Elma)
  const [userProfile, setUserProfile] = useState({
    name: 'Ns. Baiq Elma, S.Kep',
    nip: '199012052018012003',
    role: 'Perawat Penyelia',
    unit: 'UGD & Rawat Inap',
    email: 'baiq.elma@puskesmasampenan.go.id',
    phone: '0819-0744-1234',
    photo: 'https://images.unsplash.com/photo-1594824813573-246434e33963?auto=format&fit=crop&w=250&q=80'
  });

  // Time & Realtime Clock State
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toast State
  type Toast = {
  id: number;
  message: string;
  type: string;
};

const [toasts, setToasts] = useState<Toast[]>([]);
 const showToast = (
  message: string,
  type: 'success' | 'error' | 'warning' = 'success'
) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Employee Management State
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeFilterUnit, setEmployeeFilterUnit] = useState('Semua');
  const [employeeFilterStatus, setEmployeeFilterStatus] = useState('Semua');
 
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', nip: '', role: '', unit: '', status: 'Hadir' });

  // Camera Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState<{
  in: string | null;
  out: string | null;
}>({
  in: null,
  out: null
});
  const [isCapturing, setIsCapturing] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState({ lat: '-8.574221', lng: '116.082731', accuracy: '8m', radiusValid: true });

  // Leave & Permit State
  const [leaveRequests, setLeaveRequests] = useState(INITIAL_LEAVE_REQUESTS);
  const [newLeave, setNewLeave] = useState({ type: 'Cuti Tahunan', startDate: '', endDate: '', reason: '', file: null });

  // System Settings State
  const [settings, setSettings] = useState({
    gpsRadius: 50,
    startTime: '07:30',
    endTime: '14:30',
    autoApproveLeave: false,
    strictGps: true,
    strictSelfie: true,
  });

  // Laporan Filter State
  const [reportFilter, setReportFilter] = useState({ start: '2026-06-01', end: '2026-06-11', unit: 'Semua' });

  // Filter & Search Logic for Employee Table
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch = emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                          emp.nip.includes(employeeSearch) || 
                          emp.role.toLowerCase().includes(employeeSearch.toLowerCase());
      const matchUnit = employeeFilterUnit === 'Semua' || emp.unit === employeeFilterUnit;
      const matchStatus = employeeFilterStatus === 'Semua' || emp.status === employeeFilterStatus;
      return matchSearch && matchUnit && matchStatus;
    });
  }, [employees, employeeSearch, employeeFilterUnit, employeeFilterStatus]);

  // Handle Login Simulation
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === '' || password.trim() === '') {
      showToast('NIP/Username dan Password wajib diisi', 'error');
      return;
    }
    showToast('Login berhasil! Selamat datang di SIAP AMPENAN.', 'success');
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
  };

  // Handle Add Employee
 const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.nip || !newEmployee.role || !newEmployee.unit) {
      showToast('Mohon lengkapi semua field data pegawai', 'error');
      return;
    }
    const newEmp = {
      id: Date.now().toString(),
      nip: newEmployee.nip,
      name: newEmployee.name,
      role: newEmployee.role,
      unit: newEmployee.unit,
      status: newEmployee.status,
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    };
    setEmployees([newEmp, ...employees]);
    showToast(`Pegawai ${newEmployee.name} berhasil ditambahkan!`, 'success');
    setShowAddEmployeeModal(false);
    setNewEmployee({ name: '', nip: '', role: '', unit: '', status: 'Hadir' });
  };

  // Handle Selfie Capture simulation
  const startCameraCapture = () => {
    setIsCapturing(true);
    showToast('Mengaktifkan kamera depan...', 'warning');
    setTimeout(() => {
      setSelfieImage(userProfile.photo);
      setIsCapturing(false);
      showToast('Pengenalan wajah (Face Match 98.4%) Sukses!', 'success');
    }, 2000);
  };

  // Handle Submit Attendance
  const handleAbsenMasuk = () => {
    if (!selfieImage) {
      showToast('Wajib mengambil foto selfie deteksi wajah terlebih dahulu', 'error');
      return;
    }
    const timeString = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setAttendanceStatus({ ...attendanceStatus, in: timeString });
    showToast('Absen MASUK Berhasil dicatat! Selamat bekerja.', 'success');
  };

  const handleAbsenPulang = () => {
    if (!attendanceStatus.in) {
      showToast('Anda belum melakukan absen masuk hari ini', 'error');
      return;
    }
    const timeString = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setAttendanceStatus({ ...attendanceStatus, out: timeString });
    showToast('Absen PULANG Berhasil dicatat! Hati-hati di jalan.', 'success');
  };

  // Handle Submit Leave Request
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) {
      showToast('Harap isi rentang tanggal dan alasan pengajuan', 'error');
      return;
    }
    const req = {
      id: Date.now(),
      type: newLeave.type,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      reason: newLeave.reason,
      status: 'Menunggu',
      dateFiled: new Date().toISOString().split('T')[0]
    };
    setLeaveRequests([req, ...leaveRequests]);
    showToast('Pengajuan cuti/izin berhasil dikirim ke Admin & Kepala Puskesmas', 'success');
    setNewLeave({ type: 'Cuti Tahunan', startDate: '', endDate: '', reason: '', file: null });
  };

  // Refresh GPS Simulation
  const handleRefreshGPS = () => {
    setGpsLoading(true);
    setTimeout(() => {
      setGpsLoading(false);
      setGpsData({
        lat: (-8.574221 + (Math.random() - 0.5) * 0.0001).toFixed(6),
        lng: (116.082731 + (Math.random() - 0.5) * 0.0001).toFixed(6),
        accuracy: `${Math.floor(Math.random() * 5) + 3}m`,
        radiusValid: true
      });
      showToast('GPS diperbarui! Lokasi di dalam radius valid Puskesmas Ampenan (15 meter)', 'success');
    }, 1200);
  };

  // Quick Stats computation
  const stats = useMemo(() => {
    const total = employees.length;
    const hadir = employees.filter(e => e.status === 'Hadir').length;
    const terlambat = employees.filter(e => e.status === 'Terlambat').length;
    const izin = employees.filter(e => e.status === 'Izin').length;
    const cuti = employees.filter(e => e.status === 'Cuti').length;
    const alpha = employees.filter(e => e.status === 'Alpha').length;

    return {
      hadir,
      terlambat,
      izin,
      cuti,
      alpha,
      persenHadir: Math.round((hadir / total) * 100)
    };
  }, [employees]);

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-gray-800 font-sans flex flex-col antialiased selection:bg-purple-200">
      
      {/* === TOAST NOTIFICATIONS CONTAINER === */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full px-4 md:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border transform transition-all duration-300 animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === 'warning' && (
              <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.type === 'success' ? 'Sukses' : toast.type === 'error' ? 'Kesalahan' : 'Sistem'}</p>
              <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>

      {/* ======================================================================= */}
      {/* 1. LOGIN SCREEN                                                         */}
      {/* ======================================================================= */}
      {!isLoggedIn ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-gradient-to-tr from-purple-900 via-purple-800 to-indigo-900">
          <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px] transform transition-all">
            
            {/* Left Column: Branding, Medical Illustration Context */}
            <div className="lg:col-span-6 bg-gradient-to-br from-purple-800 to-purple-950 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-purple-700 opacity-20 blur-xl"></div>
              <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-indigo-600 opacity-25 blur-3xl"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-white p-2 rounded-xl text-purple-900 shadow-md">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wider">SIAP AMPENAN</h1>
                  <p className="text-xs text-purple-200 uppercase font-semibold">Absensi Digital Puskesmas</p>
                </div>
              </div>

              <div className="my-10 relative z-10 max-w-sm">
                <span className="bg-purple-700/60 text-purple-200 text-xs px-3 py-1.5 rounded-full font-semibold inline-block mb-4 border border-purple-500/30">
                  ⚡ Government Digital Standard
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight text-white">
                  Presensi Modern, Pelayanan Prima.
                </h2>
                <p className="mt-4 text-purple-200 text-sm leading-relaxed">
                  Sistem Informasi Kehadiran Pegawai Puskesmas Ampenan terintegrasi pelacakan titik radius GPS, deteksi wajah, dan manajemen cuti dalam genggaman Anda.
                </p>
              </div>

              <div className="border-t border-purple-700/50 pt-6 relative z-10 flex items-center justify-between text-xs text-purple-300">
                <span>Dinas Kesehatan Kota Mataram</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                  Server Online
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Login Form */}
            <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-center bg-white">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Masuk Aplikasi</h3>
                <p className="text-sm text-gray-500 mt-1">Gunakan NIP ASN/Non-ASN aktif Anda untuk mengakses sistem dashboard.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">NIP / Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan NIP Anda"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all outline-none text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Password</label>
                    <a href="#lupa" onClick={(e) => { e.preventDefault(); showToast('Fitur reset password dalam koordinasi Admin Puskesmas', 'warning'); }} className="text-xs font-semibold text-purple-700 hover:underline">
                      Lupa Password?
                    </a>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sandi Rahasia"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all outline-none text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm py-1">
                  <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 border-gray-300 w-4 h-4 cursor-pointer"
                    />
                    <span>Ingat perangkat ini</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full border-gradient bg-transparent text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-4"
                >
                  Masuk Aplikasi
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <span className="text-xs bg-purple-50 text-purple-800 font-medium px-3 py-1.5 rounded-lg inline-block">
                  💡 Akun demo Perawat Puskesmas sudah terisi otomatis
                </span>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* ======================================================================= */
        /* MAIN DASHBOARD SHELL                                                    */
        /* ======================================================================= */
        <div className="flex-1 flex flex-col md:flex-row relative">
          
          {/* SIDEBAR NAVIGATION - DESKTOP */}
          <aside className={`bg-gradient-to-b from-purple-950 via-purple-900 to-purple-950 text-purple-100 shrink-0 transition-all duration-300 z-30 hidden md:flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'}`}>
            
            <div className="p-5 border-b border-purple-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-white text-purple-900 p-1.5 rounded-lg shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                {sidebarOpen && (
                  <div className="truncate">
                    <span className="font-bold text-sm tracking-wider block">SIAP AMPENAN</span>
                    <span className="text-[10px] text-purple-300 uppercase block font-semibold">Puskesmas Digital</span>
                  </div>
                )}
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /> },
                { id: 'absensi', label: 'Absensi Presensi', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></> },
                { id: 'pegawai', label: 'Data Pegawai', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
                { id: 'izin_cuti', label: 'Izin & Cuti', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
                { id: 'rekap', label: 'Rekap Kehadiran', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
                { id: 'laporan', label: 'Laporan Kehadiran', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
                { id: 'profil', label: 'Profil Saya', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
                { id: 'pengaturan', label: 'Pengaturan', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    showToast(`Membuka halaman ${item.label}`, 'success');
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    currentPage === item.id
                      ? 'border-gradient bg-transparent text-white font-bold'
                      : 'hover:bg-purple-800/50 text-purple-200'
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-purple-800/40 space-y-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center justify-center p-2 rounded-lg border-gradient bg-transparent transition-all text-purple-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={sidebarOpen ? "M11 19l-7-7 7-7M21 19l-7-7 7-7" : "M13 5l7 7-7 7M3 5l7 7-7 7"} />
                </svg>
              </button>

              <button
                onClick={() => {
                  setIsLoggedIn(false);
                  showToast('Anda telah keluar dari sistem secara aman.', 'warning');
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium text-red-300 hover:bg-red-950/40 hover:text-red-200 transition-all"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {sidebarOpen && <span>Keluar</span>}
              </button>
            </div>
          </aside>

          {/* MAIN PAGE PORT - RIGHT COLUMN */}
          <div className="flex-1 flex flex-col min-w-0">
            
            {/* TOP GLOBAL HEADER */}
            <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-20">
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 md:hidden"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="md:hidden flex items-center gap-2">
                  <div className="bg-purple-800 text-white p-1 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <span className="font-extrabold text-sm text-gray-900 tracking-wider">SIAP</span>
                </div>
                
                <div className="hidden md:block">
                  <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Puskesmas Ampenan</span>
                  <h2 className="text-lg font-bold text-gray-900 capitalize flex items-center gap-2">
                    {currentPage.replace('_', ' ')}
                    {currentPage === 'absensi' && <span className="bg-green-100 text-green-800 text-[10px] px-2.5 py-1 rounded-full font-bold">Online Geofencing</span>}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4">
                
                <div className="hidden lg:flex flex-col items-end border-r pr-4 border-gray-100 text-right">
                  <span className="text-xs text-gray-400 font-medium">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-sm font-bold text-purple-900 tracking-wider">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
                  </span>
                </div>

                <div className="relative cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-all">
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>

                <div onClick={() => setCurrentPage('profil')} className="flex items-center gap-3 pl-2 cursor-pointer hover:opacity-90 transition-all">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-purple-500 bg-purple-100 shrink-0 shadow-sm">
                    <img src={userProfile.photo} alt={userProfile.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{userProfile.name}</p>
                    <span className="text-[10px] text-gray-400 font-medium tracking-wide block">{userProfile.role}</span>
                  </div>
                </div>

              </div>
            </header>

            {/* MAIN PORTAL AREA CONTROLLER */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

              {/* ======================================================================= */}
              {/* PAGE 1: DASHBOARD                                                       */}
              {/* ======================================================================= */}
              {currentPage === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Welcome Card */}
                  <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-purple-100">
                    <div className="absolute top-0 right-0 w-80 h-full opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <span className="bg-purple-600/60 text-purple-100 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider mb-3 inline-block">
                          🏥 UPT Puskesmas Ampenan
                        </span>
                        <h3 className="text-2xl md:text-3xl font-extrabold">Selamat Datang Kembali, {userProfile.name}!</h3>
                        <p className="text-sm text-purple-200 mt-2 max-w-xl leading-relaxed">
                          Anda masuk sebagai <strong className="text-white">{userProfile.role}</strong> di unit kerja <strong className="text-white">{userProfile.unit}</strong>. Ambil absensi hari ini tepat waktu untuk mempertahankan indeks disiplin medis.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setCurrentPage('absensi'); showToast('Membuka Kamera Selfie Presensi...', 'warning'); }}
                          className="border-gradient bg-transparent text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md transition-all active:scale-[0.98] inline-flex items-center gap-2"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                          Presensi Sekarang
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Modern Metric Statistics Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                      { label: 'Hadir Hari Ini', value: stats.hadir, percent: '+12%', color: 'border-l-4 border-green-500', bg: 'bg-green-50/40', textColor: 'text-green-700', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                      { label: 'Terlambat', value: stats.terlambat, percent: '-3%', color: 'border-l-4 border-red-500', bg: 'bg-red-50/40', textColor: 'text-red-700', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                      { label: 'Izin Pegawai', value: stats.izin, percent: 'Normal', color: 'border-l-4 border-amber-500', bg: 'bg-amber-50/40', textColor: 'text-amber-700', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                      { label: 'Cuti Pegawai', value: stats.cuti, percent: '1 Pegawai', color: 'border-l-4 border-blue-500', bg: 'bg-blue-50/40', textColor: 'text-blue-700', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                      { label: 'Alpha', value: stats.alpha, percent: '0%', color: 'border-l-4 border-gray-400', bg: 'bg-gray-50/60', textColor: 'text-gray-700', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
                    ].map((card, idx) => (
                      <div key={idx} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all ${card.color}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-400 tracking-wide block truncate">{card.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.bg} ${card.textColor}`}>{card.percent}</span>
                        </div>
                        <div className="flex items-end justify-between mt-3">
                          <span className="text-2xl font-extrabold text-gray-900 tracking-tight">{card.value}</span>
                          <div className={`p-2 rounded-xl ${card.bg} ${card.textColor}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.icon} />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Analytics Section: Custom SVG Charts & Activity */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Kehadiran Bulanan (Custom SVG Graph) */}
                    <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-base font-bold text-gray-900">Grafik Kehadiran Mingguan</h4>
                            <p className="text-xs text-gray-400">Rasio disiplin & ketepatan waktu UPT Puskesmas Ampenan</p>
                          </div>
                          <span className="text-xs bg-purple-50 text-purple-700 font-bold px-3 py-1.5 rounded-xl border border-purple-100">
                            Juni 2026
                          </span>
                        </div>

                        {/* Interactive SVG Bar & Line Chart combination */}
                        <div className="relative h-64 w-full mt-6 flex items-end">
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            {[100, 75, 50, 25, 0].map((val, idx) => (
                              <div key={idx} className="flex items-center w-full text-[10px] text-gray-400 font-semibold">
                                <span className="w-8 shrink-0">{val}%</span>
                                <div className="flex-1 border-t border-dashed border-gray-100"></div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Columns representation */}
                          <div className="w-full flex justify-around items-end h-[85%] relative z-10 px-4">
                            {[
                              { day: 'Senin', hadir: 98, terlambat: 2 },
                              { day: 'Selasa', hadir: 95, terlambat: 5 },
                              { day: 'Rabu', hadir: 88, terlambat: 12 },
                              { day: 'Kamis', hadir: 96, terlambat: 4 },
                              { day: 'Jumat', hadir: 92, terlambat: 8 },
                              { day: 'Sabtu', hadir: 90, terlambat: 10 },
                            ].map((data, index) => (
                              <div key={index} className="flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="relative flex items-end justify-center w-12 gap-1 h-36">
                                  {/* Hadir Bar */}
                                  <div 
                                    style={{ height: `${data.hadir}%` }}
                                    className="w-5 bg-gradient-to-t from-purple-700 to-purple-500 rounded-t-md hover:to-purple-400 transition-all relative"
                                  >
                                    <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-0.5 rounded shadow-sm z-20 transition-all">
                                      Hadir {data.hadir}%
                                    </span>
                                  </div>
                                  {/* Terlambat Bar */}
                                  <div 
                                    style={{ height: `${data.terlambat}%` }}
                                    className="w-2 bg-red-400 rounded-t-sm hover:bg-red-300 transition-all"
                                  ></div>
                                </div>
                                <span className="text-xs font-bold text-gray-500">{data.day}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 bg-purple-700 rounded-md"></span>
                          <span className="text-gray-500 font-medium">Hadir Tepat Waktu</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 bg-red-400 rounded-md"></span>
                          <span className="text-gray-500 font-medium">Terlambat</span>
                        </div>
                      </div>
                    </div>

                    {/* Aktivitas Terbaru (Timeline) */}
                    <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 mb-4">Aktivitas Presensi Terkini</h4>
                        <div className="space-y-4">
                          {[
                            { name: 'drg. Nyoman Triadi', time: '07:28 WITA', act: 'Absen Masuk (Wajah OK)', type: 'in', color: 'bg-green-100 text-green-700' },
                            { name: 'Apt. Riza Lestari, S.Farm', time: '07:35 WITA', act: 'Mengajukan Izin Sakit', type: 'pending', color: 'bg-amber-100 text-amber-700' },
                            { name: 'Luh Putu Swasti', time: '07:44 WITA', act: 'Absen Masuk (Terlambat)', type: 'late', color: 'bg-red-100 text-red-700' },
                            { name: 'dr. H. Ahmad Fauzi', time: '07:15 WITA', act: 'Absen Masuk (Kepala Pusk)', type: 'in', color: 'bg-green-100 text-green-700' },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-xs">
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.type === 'in' ? 'bg-green-500' : item.type === 'late' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 truncate">{item.name}</p>
                                <p className="text-[11px] text-gray-400">{item.act}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-gray-400 shrink-0">{item.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => { setCurrentPage('rekap'); showToast('Membuka rekap detail...', 'success'); }}
                        className="w-full text-center text-xs font-bold text-white border-gradient bg-transparent py-3 rounded-xl transition-all mt-4"
                      >
                        Lihat Seluruh Aktivitas
                      </button>
                    </div>

                  </div>

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 2: ABSENSI PRESENSI (KAMERA & GPS)                                 */}
              {/* ======================================================================= */}
              {currentPage === 'absensi' && (
                <div className="space-y-6 animate-fade-in">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Live Clock & Camera Preview Column */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Live camera simulator */}
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center flex flex-col justify-between min-h-[420px]">
                        <div>
                          <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1.5 rounded-full inline-block mb-3">
                            📸 Kamera Selfie Presensi (Face-Match)
                          </span>
                          <h4 className="text-sm text-gray-400">Pastikan wajah Anda berada di dalam kotak hijau deteksi</h4>
                        </div>

                        {/* Interactive Photo Viewport */}
                        <div className="my-5 w-full max-w-sm mx-auto h-64 bg-gray-900 rounded-2xl overflow-hidden relative border-4 border-gray-800 shadow-inner flex items-center justify-center">
                          
                          {/* Face Match Scanner Frame Overlay */}
                          <div className="absolute inset-4 border-2 border-dashed border-green-400/60 rounded-xl pointer-events-none flex items-center justify-center">
                            <div className="w-48 h-48 border border-green-500 rounded-full opacity-40 animate-pulse relative">
                              <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold">DETEKSI WAJAH</span>
                            </div>
                          </div>

                          {/* Grid line scanning animation */}
                          <div className="absolute left-0 right-0 h-0.5 bg-green-400 opacity-60 animate-bounce top-1/3"></div>

                          {selfieImage ? (
                            <img src={selfieImage} alt="User selfie" className="w-full h-full object-cover filter brightness-110" />
                          ) : isCapturing ? (
                            <div className="text-center text-white space-y-3">
                              <span className="block w-10 h-10 border-4 border-t-purple-600 border-r-transparent rounded-full animate-spin mx-auto"></span>
                              <span className="text-xs font-bold tracking-wide block animate-pulse">Menghubungkan ke Lensa Face ID...</span>
                            </div>
                          ) : (
                            <div className="text-center text-gray-500 p-6">
                              <svg className="w-16 h-16 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 009 11.5a10.042 10.042 0 00-4-1.957m-1.12-.321a9.774 9.774 0 011.5-.185m1.12-.321C11.587 3.44 14.724 2 18 2c.5 0 .998.026 1.488.077P18 8V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span className="text-xs text-gray-400 block font-semibold">Kamera Belum Aktif</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={startCameraCapture}
                            className="border-gradient bg-transparent text-white font-bold px-6 py-3 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 mx-auto active:scale-95"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Ambil Foto Presensi (Selfie)
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Geofencing Location & Clock Action Column */}
                    <div className="lg:col-span-5 space-y-6">
                      
                      {/* GPS Radius Check Component */}
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-bold text-gray-900">Validasi Geofencing GPS</h4>
                          <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                            Radius Aman
                          </span>
                        </div>

                        {/* Interactive coordinates fields */}
                        <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-medium">Latitude:</span>
                            <span className="font-bold text-gray-800">{gpsData.lat}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-medium">Longitude:</span>
                            <span className="font-bold text-gray-800">{gpsData.lng}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-medium">Akurasi Perangkat:</span>
                            <span className="font-bold text-green-600">{gpsData.accuracy}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-gray-400 font-medium">Status Geofence:</span>
                            <span className="bg-green-500 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                              Valid (Puskesmas Ampenan)
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={handleRefreshGPS}
                          disabled={gpsLoading}
                          className="w-full text-center text-xs font-bold text-white border-gradient bg-transparent py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {gpsLoading ? (
                            <>
                              <span className="w-4.5 h-4.5 border-2 border-t-purple-600 border-r-transparent rounded-full animate-spin"></span>
                              Menyinkronkan Satelit...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" /></svg>
                              Segarkan Koordinat GPS
                            </>
                          )}
                        </button>
                      </div>

                      {/* Absen action triggers */}
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center space-y-6">
                        <div>
                          <span className="text-xs text-gray-400 font-bold block uppercase tracking-wide">Jam Kerja Hari Ini</span>
                          <h3 className="text-3xl font-extrabold text-gray-900 mt-2">
                            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Absen Masuk Button */}
                          <div className="space-y-2">
                            <button
                              onClick={handleAbsenMasuk}
                              disabled={attendanceStatus.in !== null}
                              className={`w-full py-5 rounded-3xl font-extrabold text-sm transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-2 text-white ${
                                attendanceStatus.in
                                  ? 'bg-gray-200 text-gray-400 border border-gray-300 shadow-none cursor-not-allowed'
                                  : 'border-gradient bg-transparent hover:shadow-lg'
                              }`}
                            >
                              <span className="p-2 bg-white/20 rounded-full">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                              </span>
                              Absen Masuk
                            </button>
                            <span className="text-xs font-bold text-gray-500 block">
                              Masuk: {attendanceStatus.in ? <strong className="text-green-600">{attendanceStatus.in}</strong> : '--:--'}
                            </span>
                          </div>

                          {/* Absen Pulang Button */}
                          <div className="space-y-2">
                            <button
                              onClick={handleAbsenPulang}
                              disabled={attendanceStatus.out !== null}
                              className={`w-full py-5 rounded-3xl font-extrabold text-sm transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-2 text-white ${
                                attendanceStatus.out
                                  ? 'bg-gray-200 text-gray-400 border border-gray-300 shadow-none cursor-not-allowed'
                                  : 'border-gradient bg-transparent hover:shadow-lg'
                              }`}
                            >
                              <span className="p-2 bg-white/20 rounded-full">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                              </span>
                              Absen Pulang
                            </button>
                            <span className="text-xs font-bold text-gray-500 block">
                              Pulang: {attendanceStatus.out ? <strong className="text-red-600">{attendanceStatus.out}</strong> : '--:--'}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-purple-50 text-purple-950 text-xs rounded-2xl text-left border border-purple-100 leading-relaxed font-medium">
                          📌 <strong>Ketentuan:</strong> Pengambilan data absensi divalidasi sistem Geofence satelit. Terlambat &gt;15 menit akan dicatat oleh sub-kepegawaian Puskesmas Ampenan.
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 3: DATA PEGAWAI                                                    */}
              {/* ======================================================================= */}
              {currentPage === 'pegawai' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Table Controls (Search, Add, Export) */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Search Field & Filters */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        <input
                          type="text"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          placeholder="Cari Pegawai, NIP, atau Jabatan..."
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all outline-none text-xs text-gray-800"
                        />
                      </div>

                      {/* Filter Unit */}
                      <select
                        value={employeeFilterUnit}
                        onChange={(e) => setEmployeeFilterUnit(e.target.value)}
                        className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer"
                      >
                        <option value="Semua">Semua Unit</option>
                        <option value="Pimpinan">Pimpinan</option>
                        <option value="UGD & Rawat Inap">UGD & Rawat Inap</option>
                        <option value="Farmasi / Apotek">Farmasi / Apotek</option>
                        <option value="Poli Gigi">Poli Gigi</option>
                        <option value="KIA / KB">KIA / KB</option>
                        <option value="Poli Gizi">Poli Gizi</option>
                        <option value="Laboratorium">Laboratorium</option>
                        <option value="Poli Umum">Poli Umum</option>
                      </select>

                      {/* Filter Status Kehadiran */}
                      <select
                        value={employeeFilterStatus}
                        onChange={(e) => setEmployeeFilterStatus(e.target.value)}
                        className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer"
                      >
                        <option value="Semua">Semua Kehadiran</option>
                        <option value="Hadir">Hadir</option>
                        <option value="Terlambat">Terlambat</option>
                        <option value="Izin">Izin</option>
                        <option value="Cuti">Cuti</option>
                        <option value="Alpha">Alpha</option>
                      </select>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAddEmployeeModal(true)}
                        className="border-gradient bg-transparent text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Tambah Pegawai
                      </button>

                      <button
                        onClick={() => showToast('Ekspor data pegawai ke spreadsheet berhasil', 'success')}
                        className="border-gradient bg-transparent text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Excel
                      </button>
                    </div>

                  </div>

                  {/* Modern Employees Table Grid */}
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <th className="p-4 pl-6">Foto Pegawai</th>
                            <th className="p-4">NIP & Nama</th>
                            <th className="p-4">Jabatan</th>
                            <th className="p-4">Unit Kerja</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 pr-6 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {filteredEmployees.length > 0 ? (
                            filteredEmployees.map((emp) => (
                              <tr key={emp.id} className="hover:bg-gray-50/50 transition-all">
                                <td className="p-4 pl-6">
                                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-purple-50 shadow-sm border border-gray-100">
                                    <img src={emp.image} alt={emp.name} className="w-full h-full object-cover" />
                                  </div>
                                </td>
                                <td className="p-4">
                                  <p className="font-bold text-gray-900">{emp.name}</p>
                                  <span className="text-[10px] text-gray-400 block font-semibold mt-0.5">NIP. {emp.nip}</span>
                                </td>
                                <td className="p-4 text-gray-600 font-medium">{emp.role}</td>
                                <td className="p-4">
                                  <span className="bg-purple-50 text-purple-800 text-[10px] px-2.5 py-1 rounded-full font-bold">
                                    {emp.unit}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                    emp.status === 'Hadir' ? 'bg-green-100 text-green-800' :
                                    emp.status === 'Terlambat' ? 'bg-red-100 text-red-800' :
                                    emp.status === 'Izin' ? 'bg-amber-100 text-amber-800' :
                                    emp.status === 'Cuti' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {emp.status}
                                  </span>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => showToast(`Edit Pegawai: ${emp.name}`, 'warning')}
                                      className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600 border-gradient border transition-all"
                                      title="Edit Pegawai"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEmployees(employees.filter(e => e.id !== emp.id));
                                        showToast(`Pegawai ${emp.name} dinonaktifkan`, 'error');
                                      }}
                                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 border-gradient border transition-all"
                                      title="Hapus Pegawai"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-gray-400 font-semibold">
                                Tidak ada data pegawai yang sesuai filter pencarian.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination component */}
                    <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100 text-xs text-gray-500">
                      <span>Menampilkan {filteredEmployees.length} dari {employees.length} Pegawai</span>
                      <div className="flex gap-1.5">
                        <button className="px-3 py-1.5 border-gradient rounded-lg bg-transparent font-bold text-white disabled:opacity-50" disabled>Sebelumnya</button>
                        <button className="px-3 py-1.5 border-gradient rounded-lg bg-transparent text-white font-bold">1</button>
                        <button className="px-3 py-1.5 border-gradient rounded-lg bg-transparent font-bold text-white" onClick={() => showToast('Halaman berikutnya dalam demo kosong', 'warning')}>Selanjutnya</button>
                      </div>
                    </div>
                  </div>

                  {/* ADD EMPLOYEE MODAL (Dynamic State) */}
                  {showAddEmployeeModal && (
                    <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8 space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-gray-900">Tambah Pegawai Baru</h4>
                          <button onClick={() => setShowAddEmployeeModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>

                        <form onSubmit={handleAddEmployee} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
                            <input
                              type="text"
                              value={newEmployee.name}
                              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                              placeholder="Nama Lengkap & Gelar Medis"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nomor Induk Pegawai (NIP)</label>
                            <input
                              type="text"
                              value={newEmployee.nip}
                              onChange={(e) => setNewEmployee({ ...newEmployee, nip: e.target.value })}
                              placeholder="18 Digit NIP Kepegawaian"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Jabatan Fungsional</label>
                            <input
                              type="text"
                              value={newEmployee.role}
                              onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                              placeholder="Contoh: Perawat Pelaksana Utama"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Unit Kerja</label>
                              <select
                                value={newEmployee.unit}
                                onChange={(e) => setNewEmployee({ ...newEmployee, unit: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                              >
                                <option value="">Pilih Unit</option>
                                <option value="UGD & Rawat Inap">UGD & Rawat Inap</option>
                                <option value="KIA / KB">KIA / KB</option>
                                <option value="Laboratorium">Laboratorium</option>
                                <option value="Farmasi / Apotek">Farmasi / Apotek</option>
                                <option value="Poli Umum">Poli Umum</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status Masuk</label>
                              <select
                                value={newEmployee.status}
                                onChange={(e) => setNewEmployee({ ...newEmployee, status: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                              >
                                <option value="Hadir">Hadir</option>
                                <option value="Terlambat">Terlambat</option>
                                <option value="Izin">Izin</option>
                                <option value="Cuti">Cuti</option>
                              </select>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full border-gradient bg-transparent text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 mt-2"
                          >
                            Simpan Data Pegawai
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 4: IZIN & CUTI PEGAWAI                                             */}
              {/* ======================================================================= */}
              {currentPage === 'izin_cuti' && (
                <div className="space-y-6 animate-fade-in">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Column: Form submission */}
                    <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                      <div className="mb-6">
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-3 py-1.5 rounded-full inline-block mb-2">
                          📝 Pengajuan Online
                        </span>
                        <h4 className="text-base font-bold text-gray-900">Formulir Cuti & Izin Medis</h4>
                        <p className="text-xs text-gray-400 mt-1">Isi permohonan ketidakhadiran kerja dengan bukti pendukung legal.</p>
                      </div>

                      <form onSubmit={handleSubmitLeave} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Jenis Permohonan</label>
                          <select
                            value={newLeave.type}
                            onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer"
                          >
                            <option value="Cuti Tahunan">Cuti Tahunan</option>
                            <option value="Izin Sakit">Izin Sakit (Surat Dokter)</option>
                            <option value="Cuti Melahirkan">Cuti Melahirkan</option>
                            <option value="Izin Alasan Penting">Izin Alasan Penting</option>
                            <option value="Tugas Belajar / Workshop">Tugas Belajar / Workshop</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tanggal Mulai</label>
                            <input
                              type="date"
                              value={newLeave.startDate}
                              onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tanggal Selesai</label>
                            <input
                              type="date"
                              value={newLeave.endDate}
                              onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Keterangan Alasan</label>
                          <textarea
                            value={newLeave.reason}
                            onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                            rows={4}
                            placeholder="Tulis alasan pengajuan cuti secara detail dan jelas..."
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800"
                          ></textarea>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upload Dokumen Pendukung (PDF/JPG)</label>
                          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-all">
                            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span className="text-xs font-bold text-purple-700 block hover:underline">Pilih file unggahan</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">Surat Dokter, Surat Undangan, dll (Maks 2MB)</span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full border-gradient bg-transparent text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 mt-2"
                        >
                          Ajukan Permohonan Cuti
                        </button>
                      </form>

                    </div>

                    {/* Right Column: Submission History */}
                    <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 mb-4">Riwayat Pengajuan Cuti/Izin Saya</h4>
                        
                        <div className="space-y-4">
                          {leaveRequests.map((req) => (
                            <div key={req.id} className="p-4 rounded-2xl border border-gray-100 hover:border-purple-100 hover:bg-purple-50/10 transition-all space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="bg-purple-50 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                    {req.type}
                                  </span>
                                  <h5 className="text-xs font-bold text-gray-800 mt-1.5">{req.reason}</h5>
                                </div>
                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                  req.status === 'Disetujui' ? 'bg-green-100 text-green-800' :
                                  req.status === 'Ditolak' ? 'bg-red-100 text-red-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {req.status}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold pt-1 border-t border-gray-50">
                                <span>Diajukan pada: {req.dateFiled}</span>
                                <span className="text-gray-600">Durasi: {req.startDate} s/d {req.endDate}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-purple-50 text-purple-950 text-[11px] rounded-2xl border border-purple-100 font-medium leading-relaxed mt-6">
                        🛡️ Pengajuan cuti yang disetujui akan secara otomatis mengubah status kehadiran harian Anda pada sistem pencatatan sub-bagian kepegawaian Puskesmas Ampenan.
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 5: REKAP KEHADIRAN ANALYTICS                                       */}
              {/* ======================================================================= */}
              {currentPage === 'rekap' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Filter range select cards */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-bold uppercase">Skala Rekap:</span>
                      {['Harian', 'Mingguan', 'Bulanan', 'Tahunan'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => showToast(`Beralih rekap ${tab}...`, 'success')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            tab === 'Bulanan' ? 'border-gradient bg-transparent text-white' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <select className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-bold focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer">
                        <option>Tahun 2026 (Aktif)</option>
                        <option>Tahun 2025</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Disiplin Card */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 text-center flex flex-col justify-between">
                      <div>
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Persentase Kehadiran</span>
                        <div className="my-6 relative inline-flex items-center justify-center">
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle cx="64" cy="64" r="56" stroke="#F3F4F6" strokeWidth="10" fill="transparent" />
                            <circle cx="64" cy="64" r="56" stroke="#6A1B9A" strokeWidth="10" fill="transparent" strokeDasharray="351.8" strokeDashoffset="24.6" strokeLinecap="round" />
                          </svg>
                          <div className="absolute text-center">
                            <span className="text-2xl font-extrabold text-gray-900 block">93.2%</span>
                            <span className="text-[10px] text-green-600 font-bold">Kategori: Amat Baik</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 font-medium">Pegawai Puskesmas Ampenan memiliki tingkat disiplin sangat tinggi bulan ini.</p>
                    </div>

                    {/* Statistik metrics breakdown */}
                    <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 mb-4">Uraian Alasan Ketidakhadiran Pegawai</h4>
                        
                        <div className="space-y-4">
                          {[
                            { name: 'Sakit Medis', val: '43 Hari', percent: '45%', color: 'bg-red-500' },
                            { name: 'Cuti Tahunan Terpakai', val: '28 Hari', percent: '30%', color: 'bg-purple-600' },
                            { name: 'Izin Alasan Penting', val: '18 Hari', percent: '18%', color: 'bg-amber-500' },
                            { name: 'Alpha / Tanpa Keterangan', val: '7 Hari', percent: '7%', color: 'bg-gray-400' },
                          ].map((item, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-gray-700">{item.name}</span>
                                <span className="font-bold text-gray-900">{item.val} ({item.percent})</span>
                              </div>
                              <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                                <div style={{ width: item.percent }} className={`h-full ${item.color} rounded-full`}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-400 font-medium pt-4 border-t border-gray-100 mt-4">
                        💡 Data dikomparasikan dari total 2.450 transaksi presensi harian seluruh ASN &amp; Non ASN Puskesmas Ampenan.
                      </p>
                    </div>

                  </div>

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 6: EXPORT LAPORAN                                                  */}
              {/* ======================================================================= */}
              {currentPage === 'laporan' && (
                <div className="space-y-6 animate-fade-in">
                  
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto space-y-6">
                    <div className="text-center">
                      <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1.5 rounded-full inline-block mb-3">
                        📊 Pusat Pengunduhan Laporan
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">Ekspor Laporan Kehadiran Pegawai</h3>
                      <p className="text-xs text-gray-400 mt-1">Cetak rekapitulasi data absensi resmi untuk kebutuhan pelaporan Dinas Kesehatan Kota Mataram.</p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tanggal Mulai</label>
                          <input
                            type="date"
                            value={reportFilter.start}
                            onChange={(e) => setReportFilter({ ...reportFilter, start: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tanggal Selesai</label>
                          <input
                            type="date"
                            value={reportFilter.end}
                            onChange={(e) => setReportFilter({ ...reportFilter, end: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs text-gray-800 font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Unit Kerja Spesifik</label>
                        <select
                          value={reportFilter.unit}
                          onChange={(e) => setReportFilter({ ...reportFilter, unit: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-bold focus:ring-2 focus:ring-purple-600 outline-none cursor-pointer"
                        >
                          <option value="Semua">Semua Unit Puskesmas</option>
                          <option value="Pimpinan">Pimpinan Puskesmas</option>
                          <option value="UGD & Rawat Inap">UGD & Rawat Inap</option>
                          <option value="KIA / KB">KIA & KB</option>
                          <option value="Farmasi / Apotek">Farmasi & Obat-obatan</option>
                          <option value="Poli Umum">Poli Umum / Gigi</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <button
                          onClick={() => showToast(`Cetak PDF Laporan Unit ${reportFilter.unit} periode ${reportFilter.start} - ${reportFilter.end} berhasil!`, 'success')}
                          className="border-gradient bg-transparent text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          Ekspor PDF Resmi
                        </button>

                        <button
                          onClick={() => showToast(`Cetak Excel Laporan Unit ${reportFilter.unit} berhasil diunduh!`, 'success')}
                          className="border-gradient bg-transparent text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Unduh format Excel
                        </button>
                      </div>

                    </div>
                  </div>

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 7: PROFIL PENGGUNA                                                 */}
              {/* ======================================================================= */}
              {currentPage === 'profil' && (
                <div className="space-y-6 animate-fade-in">
                  
                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-3xl mx-auto">
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 pb-8 border-b border-gray-100">
                      
                      <div className="relative group cursor-pointer">
                        <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-purple-500 shadow-lg">
                          <img src={userProfile.photo} alt={userProfile.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white text-xs font-bold">
                          Ubah Foto
                        </div>
                      </div>

                      <div className="text-center md:text-left space-y-2">
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-3 py-1.5 rounded-full inline-block">
                          ASN PUSKESMAS KOTA MATARAM
                        </span>
                        <h3 className="text-2xl font-extrabold text-gray-900">{userProfile.name}</h3>
                        <p className="text-sm text-gray-500 font-medium">NIP. {userProfile.nip}</p>
                        <p className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-lg inline-block font-bold">
                          {userProfile.role} - Unit {userProfile.unit}
                        </p>
                      </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                      <div>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email Dinas</span>
                        <input
                          type="text"
                          value={userProfile.email}
                          onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs font-semibold text-gray-800"
                        />
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nomor Telepon WA</span>
                        <input
                          type="text"
                          value={userProfile.phone}
                          onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none text-xs font-semibold text-gray-800"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                      <button
                        onClick={() => showToast('Ubah password dikirim ke email dinas...', 'warning')}
                        className="px-4 py-2.5 border-gradient rounded-xl text-xs font-bold text-white bg-transparent"
                      >
                        Ubah Password
                      </button>
                      <button
                        onClick={() => showToast('Profil berhasil disimpan!', 'success')}
                        className="px-5 py-2.5 border-gradient bg-transparent text-white font-bold text-xs rounded-xl transition-all shadow-md"
                      >
                        Simpan Perubahan
                      </button>
                    </div>

                  </div>

                </div>
              )}

              {/* ======================================================================= */}
              {/* PAGE 8: PENGATURAN                                                      */}
              {/* ======================================================================= */}
              {currentPage === 'pengaturan' && (
                <div className="space-y-6 animate-fade-in">
                  
                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto space-y-6">
                    <div>
                      <h4 className="text-base font-bold text-gray-900">Konfigurasi Sistem Absensi</h4>
                      <p className="text-xs text-gray-400 mt-1">Kelola batas radius geofencing dan integrasi verifikasi wajah.</p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-xs font-bold text-gray-800">Validasi Radius Lokasi (Geofence)</span>
                          <span className="block text-[10px] text-gray-400">Batasi presensi di dalam batas GPS Puskesmas Ampenan</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.strictGps}
                          onChange={(e) => setSettings({ ...settings, strictGps: e.target.checked })}
                          className="rounded text-purple-600 focus:ring-purple-500 border-gray-300 w-5 h-5 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-xs font-bold text-gray-800">Uji Wajah dengan AI Scanner</span>
                          <span className="block text-[10px] text-gray-400">Verifikasi wajah asli mencegah kecurangan mock kamera</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.strictSelfie}
                          onChange={(e) => setSettings({ ...settings, strictSelfie: e.target.checked })}
                          className="rounded text-purple-600 focus:ring-purple-500 border-gray-300 w-5 h-5 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Maksimal Radius Toleransi ({settings.gpsRadius} meter)
                        </label>
                        <input
                          type="range"
                          min="15"
                          max="200"
                          value={settings.gpsRadius}
                          onChange={(e) => setSettings({ ...settings, gpsRadius: parseInt(e.target.value) })}
                          className="w-full accent-purple-700 cursor-pointer"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setSettings({ gpsRadius: 50, startTime: '07:30', endTime: '14:30', autoApproveLeave: false, strictGps: true, strictSelfie: true });
                            showToast('Pengaturan dikembalikan ke standar awal', 'warning');
                          }}
                          className="px-4 py-2.5 border-gradient rounded-xl text-xs font-bold text-white bg-transparent"
                        >
                          Default
                        </button>
                        <button
                          onClick={() => showToast('Pengaturan sistem berhasil diperbarui!', 'success')}
                          className="px-5 py-2.5 border-gradient bg-transparent text-white font-bold text-xs rounded-xl transition-all shadow-md"
                        >
                          Terapkan Pengaturan
                        </button>
                      </div>

                    </div>
                  </div>

                </div>
              )}

            </main>

            {/* MOBILE BOTTOM NAVIGATION BAR */}
            <div className="md:hidden bg-white border-t border-gray-100 sticky bottom-0 z-30 grid grid-cols-5 py-2">
              {[
                { id: 'dashboard', label: 'Home', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
                { id: 'absensi', label: 'Absen', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h.01M16 20h4M4 12h4m12 0h-4" /> },
                { id: 'pegawai', label: 'Pegawai', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
                { id: 'izin_cuti', label: 'Izin', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
                { id: 'profil', label: 'Profil', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    showToast(`Halaman ${item.label}`, 'success');
                  }}
                  className={`flex flex-col items-center justify-center py-1 transition-all ${
                    currentPage === item.id ? 'text-purple-700 font-extrabold' : 'text-gray-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                  <span className="text-[10px] mt-1">{item.label}</span>
                </button>
              ))}
            </div>

          </div>

        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-4 px-6 text-center text-xs text-gray-400 font-medium">
        © 2026 UPT Puskesmas Ampenan. Hak Cipta Dilindungi Undang-Undang. Dinkes Kota Mataram.
      </footer>

    </div>
  );
}