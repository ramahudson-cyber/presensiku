import { supabase } from "../lib/supabase";
import { getShiftDefinition, isShiftEnded, getWitaDateKey } from "../lib/shiftTime";

const SANGGAHAN_BUCKET = "sanggahan";
const MIN_EARLY_NOTE = "Sanggahan hanya untuk status Alpha/Terlambat.";

// ── Pegawai ────────────────────────────────────────────────────────────────

// Riwayat sanggahan milik user yang sedang login
export async function getMySanggahan() {
  const { data, error } = await supabase
    .from("sanggahan")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Absensi milik user yang layak disanggah (Alpha/Terlambat/Tanpa Pulang,
// 60 hari terakhir)
export async function getMyDisputableAttendance(userId) {
  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  // Hari ini (WITA) masih bisa absen pulang → bukan kandidat "tanpa pulang"
  const todayWita = getWitaDateKey();
  const [{ data, error }, { data: allDateRows }, { data: noCheckoutRows, error: ncError }] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, date, attendance_status, is_late, late_minutes, shift_code, clock_out_time")
      .eq("user_id", userId)
      .in("attendance_status", ["alpha", "terlambat"])
      .gte("date", from)
      .order("date", { ascending: false }),
    // Semua tanggal yang sudah punya baris attendance (status apa pun) —
    // hari hadir/izin/sakit TIDAK boleh ter-derive sebagai alpha.
    supabase.from("attendance").select("date").eq("user_id", userId).gte("date", from),
    // Hadir tapi tidak pernah absen pulang, hari sudah lewat
    supabase
      .from("attendance")
      .select("id, date, attendance_status, shift_code")
      .eq("user_id", userId)
      .eq("attendance_status", "hadir")
      .not("clock_in_time", "is", null)
      .filter("clock_out_time", "is", null)
      .lt("date", todayWita)
      .gte("date", from)
      .order("date", { ascending: false }),
  ]);
  if (error) throw error;
  if (ncError) throw ncError;
  const rows = (data || []).concat(
    (noCheckoutRows || []).map((r) => ({ ...r, attendance_status: "tanpa_pulang" }))
  );

  // Hari alpha turunan: jadwal yang shift-nya sudah berakhir tanpa baris
  // attendance — konsisten dengan statistik dashboard. RPC create_sanggahan
  // menerima jalur jadwal ini (tanpa attendance_id).
  try {
    const [{ data: scheds }, { data: defs }] = await Promise.all([
      supabase
        .from("employee_schedules")
        .select("date, shift_code")
        .eq("user_id", userId)
        .gte("date", from),
      supabase
        .from("shift_schedules")
        .select("shift_code, day_of_week, end_time, crosses_midnight, is_working_day"),
    ]);
    const now = new Date();
    const attended = new Set((allDateRows || []).map((r) => r.date));
    const derived = (scheds || [])
      .filter((s) => !attended.has(s.date) && isShiftEnded(
        s.date,
        getShiftDefinition(defs || [], s),
        now
      ))
      .map((s) => ({
        id: `sched-${s.date}`,
        date: s.date,
        attendance_status: "alpha",
        is_late: false,
        late_minutes: 0,
        shift_code: s.shift_code,
      }));
    return [...rows, ...derived].sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    console.error("Derive alpha sanggahan gagal, pakai attendance saja:", e);
    return rows;
  }
}

// Ajukan sanggahan (RPC server-side: validasi tanggal, status, anti-double)
export async function createSanggahan({ tanggal, reason, attachmentUrl = null }) {
  if (!tanggal) throw new Error("Tanggal wajib dipilih");
  if (!reason?.trim()) throw new Error("Alasan wajib diisi");
  const { data, error } = await supabase.rpc("create_sanggahan", {
    p_tanggal: tanggal,
    p_reason: reason.trim(),
    p_attachment_url: attachmentUrl,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Gagal mengirim sanggahan");
  return data;
}

// Batalkan sanggahan yang masih pending (milik sendiri)
export async function cancelMySanggahan(id) {
  const { error } = await supabase.from("sanggahan").delete().eq("id", id);
  if (error) throw error;
}

// Upload foto bukti ke bucket 'sanggahan' (folder per user)
export async function uploadSanggahanEvidence(userId, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(SANGGAHAN_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) {
    const msg = /size|too large/i.test(error.message)
      ? "Ukuran foto melebihi 2MB"
      : /mime|type/i.test(error.message)
        ? "Format foto tidak didukung (JPG/PNG/WebP)"
        : error.message;
    throw new Error(msg);
  }
  const { data: { publicUrl } } = supabase.storage.from(SANGGAHAN_BUCKET).getPublicUrl(path);
  return publicUrl;
}

// ── Admin ──────────────────────────────────────────────────────────────────

// Semua sanggahan instansi (RLS membatasi per org); opsional filter status
export async function getSanggahan(status = null) {
  let query = supabase
    .from("sanggahan")
    .select("*, profiles!sanggahan_user_id_fkey(full_name, username, position, avatar_url)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Setujui → attendance dikoreksi jadi Hadir (RPC server-side)
export async function approveSanggahan(id) {
  const { data, error } = await supabase.rpc("review_sanggahan", {
    p_sanggahan_id: id,
    p_approve: true,
    p_rejection_reason: null,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Gagal menyetujui sanggahan");
  return data;
}

// Tolak → alasan wajib
export async function rejectSanggahan(id, rejectionReason) {
  if (!rejectionReason?.trim()) throw new Error("Alasan penolakan wajib diisi");
  const { data, error } = await supabase.rpc("review_sanggahan", {
    p_sanggahan_id: id,
    p_approve: false,
    p_rejection_reason: rejectionReason.trim(),
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Gagal menolak sanggahan");
  return data;
}

// Admin sanggahkan pegawai untuk rentang tanggal (langsung disetujui &
// dikoreksi otomatis via review_sanggahan di dalam RPC). Hari tidak valid
// dilewati dan dilaporkan di `skipped`.
export async function adminCreateSanggahan({ userId, dateFrom, dateTo, reason, attachmentUrl = null }) {
  if (!userId) throw new Error("Pegawai wajib dipilih");
  if (!dateFrom || !dateTo) throw new Error("Rentang tanggal wajib diisi");
  if (!reason?.trim()) throw new Error("Alasan wajib diisi");
  const { data, error } = await supabase.rpc("admin_create_sanggahan", {
    p_user_id: userId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_reason: reason.trim(),
    p_attachment_url: attachmentUrl,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Gagal menyimpan sanggahan");
  return data;
}
