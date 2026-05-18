-- Lightweight abuse-protection counter table for the controlled soft launch.
-- Operational-only: rows are rolling counters keyed by (key, category) and may be pruned
-- by ops jobs at any time (no historical retention guarantees). The limiter writes via
-- the service role only; clients never read or write directly. Admin (`public.tc_is_admin()`)
-- may read for visibility. Keep the admin helper definition in sync with
-- supabase/sql/withdrawal_requests.sql + supabase/sql/operational_logs.sql + supabase/sql/tester_feedback.sql
-- and lib/adminAccess.js ADMIN_EMAILS.

create table if not exists public.request_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  category text not null,
  count integer not null default 1,
  window_start timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- A unique (key, category) constraint lets the limiter perform a single atomic upsert
-- (`on conflict (key, category) do update set ...`) and lets the helper RPC look up the
-- row in O(1). This is intentional and required by lib/rateLimit.js.
create unique index if not exists request_limits_key_category_uq
  on public.request_limits (key, category);

create index if not exists request_limits_key_idx on public.request_limits (key);
create index if not exists request_limits_category_idx on public.request_limits (category);
create index if not exists request_limits_window_start_idx on public.request_limits (window_start);

comment on table public.request_limits is
  'Operational-only rolling counters for soft-launch rate limiting. Service-role-managed; rows may be pruned by ops jobs.';
comment on column public.request_limits.key is
  'Stable caller identifier — userId or hashed IP. Never store raw IPs here.';
comment on column public.request_limits.category is
  'Rate-limit category (e.g. paypal.create_order, withdrawal.create_request).';

alter table public.request_limits enable row level security;

-- Admin select via public.tc_is_admin() — same helper used by tester_feedback.sql /
-- operational_logs.sql / withdrawal_requests.sql. Defined there; do not redeclare here.
create policy "request_limits_select_admin"
  on public.request_limits
  for select
  to authenticated
  using (public.tc_is_admin());

-- NOTE: there is no insert/update/delete policy for `authenticated` on purpose.
-- The limiter writes exclusively via the service role from server-side API routes,
-- which bypasses RLS. Clients must never touch this table directly.

grant select on public.request_limits to authenticated;

-- Atomic upsert helper. Performs check + increment + window reset in one statement and
-- returns the post-update counter row so the caller can decide allow/deny.
-- Execution is restricted to the service role; clients call it via the rate-limit helper.
create or replace function public.rate_limit_increment(
  p_key text,
  p_category text,
  p_window_ms integer,
  p_metadata jsonb
)
returns table (
  out_count integer,
  out_window_start timestamptz,
  out_last_seen timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_interval interval := make_interval(secs => greatest(p_window_ms, 1) / 1000.0);
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_row public.request_limits%rowtype;
begin
  -- Try to update an existing in-window row first.
  update public.request_limits rl
     set count = rl.count + 1,
         last_seen = v_now,
         metadata = v_meta
   where rl.key = p_key
     and rl.category = p_category
     and rl.window_start > (v_now - v_window_interval)
  returning rl.* into v_row;

  if found then
    out_count := v_row.count;
    out_window_start := v_row.window_start;
    out_last_seen := v_row.last_seen;
    return next;
    return;
  end if;

  -- No fresh window row exists — insert or reset.
  insert into public.request_limits (key, category, count, window_start, last_seen, metadata)
       values (p_key, p_category, 1, v_now, v_now, v_meta)
  on conflict (key, category) do update
       set count = 1,
           window_start = excluded.window_start,
           last_seen = excluded.last_seen,
           metadata = excluded.metadata
  returning public.request_limits.* into v_row;

  out_count := v_row.count;
  out_window_start := v_row.window_start;
  out_last_seen := v_row.last_seen;
  return next;
end;
$$;

revoke all on function public.rate_limit_increment(text, text, integer, jsonb) from public;
revoke all on function public.rate_limit_increment(text, text, integer, jsonb) from authenticated;
grant execute on function public.rate_limit_increment(text, text, integer, jsonb) to service_role;
