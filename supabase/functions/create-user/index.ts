import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

export default async function handler(req: Request) {
  try {
    const body = await req.json()
    const { email, password, username, full_name, role, employee_status } = body

    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name }
    })

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message || userError }), { status: 400 })
    }

    const profile = {
      id: user.id,
      username,
      full_name,
      email,
      role,
      employee_status,
      created_at: new Date().toISOString()
    }

    const { data: inserted, error: insertError } = await supabase.from('profiles').insert(profile).select().single()

    if (insertError) {
      try {
        await supabase.auth.admin.deleteUser(user.id)
      } catch (e) {
        console.error('Rollback delete user failed', e)
      }
      return new Response(JSON.stringify({ error: insertError.message || insertError }), { status: 400 })
    }

    return new Response(JSON.stringify({ user, profile: inserted }), { status: 200 })
  } catch (err) {
    console.error('Function error', err)
    return new Response(JSON.stringify({ error: (err as Error).message || String(err) }), { status: 500 })
  }
}
