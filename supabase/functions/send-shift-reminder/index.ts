import { createClient } from 'npm:@supabase/supabase-js'

// Cron-driven shift reminder push (PWA web-push + Android FCM).
// Dipanggil pg_cron tiap 1 menit — otentikasi via header x-cron-secret
// (verify_jwt=false di config.toml), BUKAN JWT user.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FIREBASE_SA_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ---------- FCM HTTP v1 auth: OAuth2 JWT (RS256) dari service account ----------

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function toB64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cachedToken: { token: string; exp: number } | null = null

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp > now + 120) return cachedToken.token

  const sa = JSON.parse(FIREBASE_SA_JSON)
  const enc = new TextEncoder()
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const signingInput = `${toB64Url(enc.encode(JSON.stringify(header)))}.${toB64Url(enc.encode(JSON.stringify(claims)))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput))
  const jwt = `${signingInput}.${toB64Url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`FCM OAuth error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  cachedToken = { token: data.access_token, exp: now + Number(data.expires_in || 3600) }
  return data.access_token
}

async function sendFcm(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<boolean> {
  const sa = JSON.parse(FIREBASE_SA_JSON)
  const accessToken = await getFcmAccessToken()
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        data,
        android: { priority: 'HIGH' },
        webpush: {
          // Notifikasi web bisa diklik → buka aplikasi
          fcmOptions: { link: Deno.env.get('WEB_APP_URL') || 'https://presensiku-beige.vercel.app' },
        },
      },
    }),
  })
  if (res.ok) return true
  const errText = await res.text()
  if (res.status === 404 || /UNREGISTERED|INVALID_REGISTRATION|registration token/i.test(errText)) {
    return false
  }
  throw new Error(`FCM send error ${res.status}: ${errText}`)
}

// ---------- WITA helpers ----------

// "HH:MM" → menit sejak tengah malam; null bila format tidak valid
function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

interface Candidate {
  userId: string
  shiftCode: string
  shiftName: string
  date: string
  kind: 'start' | 'end'
  timeStr: string
  diffMin: number
}

// ---------- Handler ----------

export default async function handler(req: Request) {
  try {
    // Hanya cron (atau admin yang tahu secret) yang boleh memicu
    if (!CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Secret CRON_SECRET belum diset' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    if (!FIREBASE_SA_JSON) {
      return new Response(JSON.stringify({ error: 'Secret FIREBASE_SERVICE_ACCOUNT belum diset' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Waktu WITA = UTC+8, tanpa DST
    const wita = new Date(Date.now() + 8 * 60 * 60 * 1000)
    const today = wita.toISOString().slice(0, 10)
    const yesterday = new Date(wita.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const nowMin = wita.getUTCHours() * 60 + wita.getUTCMinutes()
    const dowMondayFirst = (wita.getUTCDay() + 6) % 7

    // Jadwal hari ini + kemarin (kemarin dibutuhkan untuk reminder pulang
    // shift malam yang melewati tengah malam).
    const { data: schedRows, error: schedErr } = await supabase
      .from('employee_schedules')
      .select('user_id, date, shift_code, organization_id')
      .in('date', [today, yesterday])
    if (schedErr) throw new Error(`employee_schedules: ${schedErr.message}`)

    const codes = [...new Set((schedRows || []).map((r) => r.shift_code))]
    const orgIds = [...new Set((schedRows || []).map((r) => r.organization_id).filter(Boolean))]

    // Definisi shift per (org, kode, dow Senin-pertama)
    const { data: defRows, error: defErr } = await supabase
      .from('shift_schedules')
      .select('organization_id, shift_code, day_of_week, start_time, end_time, crosses_midnight, is_working_day')
      .eq('day_of_week', dowMondayFirst)
      .in('shift_code', codes.length ? codes : ['__none__'])
    if (defErr) throw new Error(`shift_schedules: ${defErr.message}`)
    const defMap = new Map<string, Record<string, unknown>>()
    for (const d of defRows || []) {
      defMap.set(`${d.organization_id}|${d.shift_code}`, d)
    }

    // Nama shift per (org, kode) — tabel shifts boleh punya duplikat, ambil satu
    const { data: shiftMaster } = await supabase
      .from('shifts')
      .select('organization_id, code, name')
    const nameMap = new Map<string, string>()
    for (const s of shiftMaster || []) {
      const k = `${s.organization_id}|${s.code}`
      if (!nameMap.has(k) && s.name) nameMap.set(k, s.name)
    }

    // Reminder dikirim saat sisa waktu 1-2 menit sebelum shift mulai/berakhir
    // (cron tiap 1 menit; dedupe log mencegah dobel kirim dalam jendela ini)
    const WINDOW_MIN = 2
    const candidates: Candidate[] = []
    for (const r of schedRows || []) {
      const def = defMap.get(`${r.organization_id}|${r.shift_code}`)
      if (!def) continue
      const startMin = toMinutes(def.start_time)
      const endMin = toMinutes(def.end_time)
      if (startMin === null || endMin === null) continue
      // Placeholder hari non-kerja (00:00) tidak diingatkan
      if (startMin === 0 || def.is_working_day === false) continue

      const dayOffset = r.date === today ? 0 : -1440
      const startAbs = dayOffset + startMin
      const crosses = def.crosses_midnight === true
      const endAbs = dayOffset + endMin + (crosses ? 1440 : 0)

      const displayName =
        nameMap.get(`${r.organization_id}|${r.shift_code}`) || r.shift_code
      const capName = displayName.charAt(0).toUpperCase() + displayName.slice(1)

      if (r.date === today && startAbs - nowMin > 0 && startAbs - nowMin <= WINDOW_MIN) {
        candidates.push({
          userId: r.user_id, shiftCode: r.shift_code, shiftName: capName,
          date: r.date, kind: 'start',
          timeStr: String(Math.floor(startMin / 60)).padStart(2, '0') + ':' + String(startMin % 60).padStart(2, '0'),
          diffMin: startAbs - nowMin,
        })
      }
      // Reminder pulang: berlaku juga untuk jadwal kemarin yang shift-nya
      // melewati tengah malam (endAbs jatuh di hari ini).
      if (endAbs - nowMin > 0 && endAbs - nowMin <= WINDOW_MIN) {
        candidates.push({
          userId: r.user_id, shiftCode: r.shift_code, shiftName: capName,
          date: r.date, kind: 'end',
          timeStr: String(Math.floor(endMin / 60)).padStart(2, '0') + ':' + String(endMin % 60).padStart(2, '0'),
          diffMin: endAbs - nowMin,
        })
      }
    }

    // Dedupe: baris log hanya dibuat sekali per (user, shift, tanggal, jenis) —
    // cron yang retriger / dobel invoke tidak akan mengirim ulang.
    const toSend: Candidate[] = []
    for (const c of candidates) {
      const { data: inserted } = await supabase
        .from('shift_notification_log')
        .insert(
          { user_id: c.userId, shift_code: c.shiftCode, notif_date: c.date, kind: c.kind },
          { ignoreDuplicates: true }
        )
        .select('id')
      if (inserted && inserted.length > 0) toSend.push(c)
    }

    const userIds = [...new Set(toSend.map((c) => c.userId))]
    const { data: tokens } = userIds.length
      ? await supabase.from('device_tokens').select('id, user_id, token').in('user_id', userIds)
      : { data: [] }

    let sent = 0
    const staleIds: string[] = []
    const errors: string[] = []
    for (const row of tokens || []) {
      const c = toSend.find((x) => x.userId === row.user_id)
      if (!c) continue
      const title = c.kind === 'start' ? 'Pengingat Absen Masuk' : 'Pengingat Absen Pulang'
      // Sisa waktu nyata saat notifikasi dikirim (bukan angka hardcoded)
      const lagText = c.diffMin >= 1 ? `${c.diffMin} menit lagi` : 'kurang dari 1 menit lagi'
      const body =
        c.kind === 'start'
          ? `Shift ${c.shiftName} Anda dimulai ${c.timeStr} WITA (${lagText}). Jangan lupa absen masuk.`
          : `Shift ${c.shiftName} Anda berakhir ${c.timeStr} WITA (${lagText}). Jangan lupa absen pulang.`
      try {
        const ok = await sendFcm(row.token, title, body, {
          type: 'shift_reminder',
          kind: c.kind,
          shift_code: c.shiftCode,
          date: c.date,
        })
        if (ok) sent++
        else staleIds.push(row.id)
      } catch (e) {
        errors.push(String(e))
      }
    }

    if (staleIds.length > 0) {
      await supabase.from('device_tokens').delete().in('id', staleIds)
    }

    return new Response(
      JSON.stringify({
        wita_now: `${today} ${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`,
        candidates: candidates.length,
        to_send: toSend.length,
        sent,
        stale_removed: staleIds.length,
        errors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('send-shift-reminder error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}

// Runtime Edge Supabase kini mewajibkan wiring eksplisit — function dengan
// default export saja terbukti menggantung (idle timeout) pada deploy baru.
Deno.serve(handler)
