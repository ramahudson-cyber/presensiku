import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FIREBASE_SA_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || ''

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
  // Token sudah tidak valid (app di-uninstall / token berganti) — tandai untuk dihapus
  if (res.status === 404 || /UNREGISTERED|INVALID_REGISTRATION|registration token/i.test(errText)) {
    return false
  }
  throw new Error(`FCM send error ${res.status}: ${errText}`)
}

// ---------- Handler ----------

export default async function handler(req: Request) {
  try {
    if (!FIREBASE_SA_JSON) {
      return new Response(
        JSON.stringify({ error: 'Secret FIREBASE_SERVICE_ACCOUNT belum diset. Lihat FIREBASE_SETUP.md.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Dua jalur otorisasi:
    // 1. JWT admin instansi / super admin (dipanggil dari browser admin);
    // 2. header x-cron-secret (dipanggil trigger DB via pg_net — tidak ada
    //    JWT user pada panggilan server-side).
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const isTrustedCaller =
      cronSecret !== '' && (req.headers.get('x-cron-secret') || '') === cronSecret

    if (!isTrustedCaller) {
      const authHeader = req.headers.get('Authorization') || ''
      const jwt = authHeader.replace(/^Bearer\s+/i, '')
      const { data: userData, error: authErr } = await supabase.auth.getUser(jwt)
      if (authErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle()
      if (!['super_admin', 'admin_puskesmas'].includes(profile?.role || '')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }
    }

    const body = await req.json().catch(() => ({}))
    let title: string = body.title || ''
    let message: string = body.body || ''
    let userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : []

    if (body.announcement_id) {
      const { data: ann } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', body.announcement_id)
        .maybeSingle()
      if (!ann) {
        return new Response(JSON.stringify({ error: 'Announcement tidak ditemukan' }), { status: 404 })
      }
      title = title || 'Pengumuman'
      message = message || (ann.title ? `${ann.title}\n${ann.content}` : ann.content)

      // Klaim atomik: trigger DB dan invoke browser admin bisa datang
      // bersamaan — hanya panggilan pertama yang mengirim push.
      // (.filter bukan .isNull: builder versi bundled tidak punya isNull)
      const { data: claimed } = await supabase
        .from('announcements')
        .update({ push_sent_at: new Date().toISOString() })
        .eq('id', ann.id)
        .filter('push_sent_at', 'is', null)
        .select('id')
      if (!claimed || claimed.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: 'already_sent' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      let q = supabase.from('profiles').select('id')
      if (ann.organization_id) q = q.eq('organization_id', ann.organization_id)
      const { data: users } = await q
      userIds = (users || []).map((u) => u.id)
    }

    if (!title || userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_target' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('id, token')
      .in('user_id', userIds)

    let sent = 0
    const staleIds: string[] = []
    const dataPayload: Record<string, string> = {
      type: 'announcement',
      announcement_id: String(body.announcement_id || ''),
    }

    for (const row of tokens || []) {
      try {
        const ok = await sendFcm(row.token, title, message, dataPayload)
        if (ok) sent++
        else staleIds.push(row.id)
      } catch (e) {
        console.error('send-push: gagal kirim ke satu perangkat:', e)
      }
    }

    if (staleIds.length > 0) {
      await supabase.from('device_tokens').delete().in('id', staleIds)
    }

    return new Response(
      JSON.stringify({ sent, stale_removed: staleIds.length, targets: (tokens || []).length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('send-push error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}

// Runtime Edge Supabase kini mewajibkan wiring eksplisit — function dengan
// default export saja terbukti menggantung (idle timeout) pada deploy baru.
Deno.serve(handler)
