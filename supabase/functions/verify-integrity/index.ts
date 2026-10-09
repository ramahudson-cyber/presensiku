// Supabase Edge Function: verify-integrity
// -----------------------------------------
// Memverifikasi token Play Integrity (Android) yang dikirim APK Presensiku,
// lalu mengembalikan verdict yang bisa disisipkan ke payload absensi
// (field `integrity_verdict`). Server absensi kemudian menegakkan lewat
// assert_client_integrity() bila setting attendance_require_integrity=true.
//
// Alur verifikasi Google Play Integrity STANDAR:
//   1. APK minta integrity token (IntegrityManager.requestIntegrityToken).
//   2. Token dikirim ke function ini bersama nonce.
//   3. Function memanggil Google Play Integrity API (decodeIntegrityToken)
//      memakai GOOGLE_SERVICE_ACCOUNT (akses Play Console).
//   4. Verdict diambil dari deviceIntegrity.deviceRecognitionVerdict.
//
// Env yang dibutuhkan:
//   GOOGLE_SERVICE_ACCOUNT   — JSON service account (punya akses Play API)
//   PLAY_INTEGRITY_PACKAGE   — mis. com.presensiku.app
//   (opsional) PLAY_INTEGRITY_CERT_SHA256 — fingerprint sertifikat signing
//
// Bila kredensial belum diset, function mengembalikan verdict 'UNVERIFIED'
// (fail-closed terhadap kebijakan: pemanggil dianggap tidak lolos bila
// attendance_require_integrity=true). Tidak pernah crash tanpa konfigurasi.

// Tidak memakai supabase-js: gateway sudah memverifikasi JWT (verify_jwt=true),
// dan function hanya perlu memanggil Google Play API. Ini mengurangi beban boot
// sekaligus menghindari panggilan jaringan yang bisa menggantung.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
const PACKAGE_NAME = Deno.env.get('PLAY_INTEGRITY_PACKAGE') ?? 'com.presensiku.app'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Ambil OAuth2 access token dari service account (JWT grant -> token Google).
async function getGoogleAccessToken(sa: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const unsigned = `${enc(header)}.${enc(claim)}`

  const pem = sa.private_key.replace(/\\n/g, '\n')
  const keyData = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const raw = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  )
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const assertion = `${unsigned}.${sigB64}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error(`OAuth token gagal: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // 1) Wajib login (JWT Supabase) — mencegah endpoint dipakai anonim.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      // Jangan panggil jaringan untuk token kosong (menghindari idle timeout).
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: 'Server tidak terkonfigurasi' }, 500)
    }

    // decodeJwt: sudah diverifikasi signature oleh gateway (verify_jwt=true).
    // Cukup pastikan ada subject (sub) yang valid.
    let sub: string | null = null
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
      sub = payload?.sub ?? null
    } catch {
      sub = null
    }
    if (!sub) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const integrityToken: string | undefined = body.integrity_token
    const nonce: string | undefined = body.nonce
    if (!integrityToken) return json({ error: 'integrity_token wajib dikirim' }, 400)

    // 2) Tanpa service account: verdict UNVERIFIED (fail-closed di server).
    if (!SERVICE_ACCOUNT) {
      return json({ verdict: 'UNVERIFIED', reason: 'service_account_not_configured' })
    }

    const sa = JSON.parse(SERVICE_ACCOUNT)
    const accessToken = await getGoogleAccessToken(sa)

    // 3) decodeIntegrityToken
    const url =
      `https://playintegrity.googleapis.com/v1/${encodeURIComponent(PACKAGE_NAME)}:decodeIntegrityToken`
    const giRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ integrity_token: integrityToken }),
    })
    if (!giRes.ok) {
      const t = await giRes.text()
      console.error('Play Integrity error:', giRes.status, t)
      return json({ verdict: 'UNVERIFIED', reason: `google_error_${giRes.status}` })
    }

    const gi = await giRes.json()
    const payload = gi?.tokenPayloadExternal ?? {}
    const nonceOk = !nonce || payload?.requestDetails?.nonce === nonce
    const deviceVerdicts: string[] =
      payload?.deviceIntegrity?.deviceRecognitionVerdict ?? []
    const appVerdict = payload?.appIntegrity?.appRecognitionVerdict ?? 'UNKNOWN'

    // 4) Verdict ringkas untuk disimpan di absensi.
    let verdict = 'UNVERIFIED'
    if (nonceOk && deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')
        && appVerdict === 'PLAY_RECOGNIZED') {
      verdict = 'MEETS_DEVICE_INTEGRITY'
    } else if (deviceVerdicts.includes('MEETS_BASIC_INTEGRITY')) {
      verdict = 'MEETS_BASIC_INTEGRITY'
    }

    return json({
      verdict,
      device_recognition: deviceVerdicts,
      app_recognition: appVerdict,
      nonce_ok: nonceOk,
    })
  } catch (err) {
    console.error('verify-integrity fatal:', err)
    return json({ verdict: 'UNVERIFIED', reason: 'exception' })
  }
}
