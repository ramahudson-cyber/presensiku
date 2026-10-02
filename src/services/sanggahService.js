import { supabase } from "../lib/supabase";

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

// Absensi milik user yang layak disanggah (Alpha/Terlambat, 60 hari terakhir)
export async function getMyDisputableAttendance(userId) {
  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance")
    .select("id, date, attendance_status, is_late, late_minutes, shift_code, clock_out_time")
    .eq("user_id", userId)
    .in("attendance_status", ["alpha", "terlambat"])
    .gte("date", from)
    .order("date", { ascending: false });
  if (error) throw error;
  return data || [];
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
