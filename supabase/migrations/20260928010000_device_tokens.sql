-- =====================================================================
-- device_tokens: simpan FCM token per perangkat untuk push notification
-- =====================================================================

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_device_tokens_user on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "users_select_own_device_tokens" on public.device_tokens;
create policy "users_select_own_device_tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "users_insert_own_device_tokens" on public.device_tokens;
create policy "users_insert_own_device_tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "users_update_own_device_tokens" on public.device_tokens;
create policy "users_update_own_device_tokens"
  on public.device_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "users_delete_own_device_tokens" on public.device_tokens;
create policy "users_delete_own_device_tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

-- Realtime: pengumuman baru langsung tersiar ke semua client yang subscribe
do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then
  null;
end $$;
