import { supabase } from "../lib/supabase";
import { compressImage } from "../lib/imageCompress";

export const LEAVE_TYPES = [
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
];

export async function createLeaveRequest({ userId, type, startDate, endDate, reason, attachmentUrl = null }) {
  if (!userId) throw new Error("User tidak dikenali");
  if (!["izin", "sakit"].includes(type)) throw new Error("Jenis permohonan tidak valid");
  if (!startDate || !endDate) throw new Error("Tanggal wajib diisi");
  if (endDate < startDate) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai");
  if (!reason?.trim()) throw new Error("Alasan wajib diisi");

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      user_id: userId,
      leave_type: type,
      total_days: countLeaveDays(startDate, endDate),
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
      attachment_url: attachmentUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Upload lampiran izin/sakit (foto surat dokter) ke bucket 'sanggahan'.
// Policy bucket mengizinkan insert authenticated user; cron retensi 365 hari
// ikut menata file di bucket ini (pola sama dengan bukti sanggahan).
export async function uploadLeaveAttachment(userId, file) {
  const compressed = await compressImage(file, { maxSize: 1024, quality: 0.75 });
  const ext = compressed.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/leave_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("sanggahan")
    .upload(path, compressed, {
      upsert: true,
      contentType: compressed.type || "image/jpeg",
      cacheControl: "604800",
    });
  if (error) {
    const msg = /size|too large/i.test(error.message)
      ? "Ukuran foto melebihi 2MB"
      : /mime|type/i.test(error.message)
        ? "Format foto tidak didukung (JPG/PNG)"
        : error.message;
    throw new Error(msg);
  }
  const { data: { publicUrl } } = supabase.storage.from("sanggahan").getPublicUrl(path);
  return publicUrl;
}

export async function getMyLeaveRequests(userId) {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLeaveRequests(status) {
  let query = supabase
    .from("leave_requests")
    .select("*, profiles!leave_requests_user_id_fkey(full_name, username, department)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// RPC mengembalikan { success, error?, message?, created?, skipped? }
async function callLeaveRpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Gagal memproses permohonan");
  return data;
}

// Guard for UUID validation — prevents "invalid input syntax for type uuid: null"
function guardUuid(id, label) {
  if (!id || typeof id !== "string" || id === "null" || id === "undefined") {
    throw new Error(`${label} tidak valid`);
  }
}

export const approveLeaveRequest = (id) => {
  guardUuid(id, "ID permohonan");
  return callLeaveRpc("approve_leave_request", { p_request_id: id });
};

export const rejectLeaveRequest = (id, reason) => {
  guardUuid(id, "ID permohonan");
  return callLeaveRpc("reject_leave_request", { p_request_id: id, p_reason: reason || null });
};

export async function cancelLeaveRequest(id) {
  if (!id || typeof id !== "string" || id === "null" || id === "undefined") {
    throw new Error("ID permohonan tidak valid");
  }
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
}

export function countLeaveDays(startDate, endDate) {
  const ms = new Date(endDate) - new Date(startDate);
  return Math.floor(ms / 86400000) + 1;
}
