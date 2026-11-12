import { createClient } from 'npm:@supabase/supabase-js'

// Retensi foto bukti sanggahan.
// Dipanggil pg_cron setiap hari — otentikasi via header x-cron-secret
// (pola sama dengan send-shift-reminder): transport memakai service role
// dari Vault, otentikasi sebenarnya dicek di dalam function.
//
// Tujuan: kuota storage dan egress Supabase tidak tumbuh tanpa batas.
// Foto bukti yang lebih tua dari RETENTION_DAYS dihapus dari storage, dan
// attachment_url pada baris sanggahan dikosongkan agar UI tidak menampilkan
// gambar yang sudah hilang. Catatan sanggahan itu sendiri TIDAK dihapus
// (riwayat absensi tetap utuh).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
const BUCKET = 'sanggahan'
// Masa simpan foto bukti. Bisa diubah lewat env tanpa mengubah kode.
const RETENTION_DAYS = Number(Deno.env.get('EVIDENCE_RETENTION_DAYS') || '365')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

export default async function handler(req: Request): Promise<Response> {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  const removed: string[] = []
  const errors: string[] = []

  try {
    // Struktur bucket: <user_id>/<timestamp>.ext → dua tingkat.
    const { data: folders, error: foldersErr } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    if (foldersErr) throw foldersErr

    for (const folder of folders || []) {
      // Objek di akar bucket (bila ada) sekaligus folder user.
      const { data: entries, error: listErr } = await supabase.storage
        .from(BUCKET)
        .list(folder.name, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
      if (listErr) {
        errors.push(`${folder.name}: ${listErr.message}`)
        continue
      }

      const expired: { path: string; url: string }[] = []
      for (const entry of entries || []) {
        if (!entry.id) continue // item berupa sub-folder, bukan file
        const created = new Date(entry.created_at || entry.updated_at || 0).getTime()
        if (!created || created > cutoff) continue
        expired.push({
          path: `${folder.name}/${entry.name}`,
          url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${folder.name}/${entry.name}`,
        })
      }
      if (!expired.length) continue

      const { error: delErr } = await supabase.storage
        .from(BUCKET)
        .remove(expired.map((e) => e.path))
      if (delErr) {
        errors.push(`${folder.name}: ${delErr.message}`)
        continue
      }

      // Bersihkan referensi agar UI tidak menampilkan gambar yang sudah hilang.
      for (const e of expired) {
        const { error: updErr } = await supabase
          .from('sanggahan')
          .update({ attachment_url: null })
          .eq('attachment_url', e.url)
        if (updErr) errors.push(`ref ${e.path}: ${updErr.message}`)
        removed.push(e.path)
      }
    }

    return new Response(
      JSON.stringify({
        retention_days: RETENTION_DAYS,
        removed: removed.length,
        paths: removed,
        errors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e), removed: removed.length, errors }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
// Runtime Edge Supabase mewajibkan wiring eksplisit (pola sama dengan
// send-shift-reminder) — default export saja membuat function menggantung.
Deno.serve(handler)
