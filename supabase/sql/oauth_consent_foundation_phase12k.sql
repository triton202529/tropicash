-- Tropicash Developer Center — Phase 12K: OAuth consent data model foundation.
--
-- SCHEMA ONLY. This migration establishes the secure storage layer that future
-- OAuth authorization + user-consent features will use. It creates NO login
-- flow, issues NO tokens, and exposes NO wallet/transaction/money-movement
-- behavior.
--
-- Security posture:
--   • Token + client secret material is NEVER stored in plaintext — only
--     SHA-256 (or stronger) hashes (`*_hash` columns).
--   • Token tables (access/refresh) are SERVICE-ROLE ONLY — no authenticated or
--     public access via RLS.
--   • Users may read only their own consents (and their own audit events).
--   • Developers may read only OAuth clients tied to apps they own.
--   • Admins may read clients/consents/audit (NOT raw token tables).
--
-- Scope: Developer Platform only. Does NOT touch wallets, send money,
-- withdrawals, PayPal, treasury, fraud, KYC, user balances, or transactions.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--
--   1. `supabase/sql/developer_orgs_phase4a.sql`  — orgs/apps + ownership for RLS.
--   2. THIS FILE — oauth_clients, oauth_consents, oauth_access_tokens,
--      oauth_refresh_tokens, oauth_audit_events.
--
-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql /
-- lib/adminAccess.js).

-- ===========================================================================
-- 1. oauth_clients — registered applications approved for OAuth access.
-- ===========================================================================

create table if not exists public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  client_id text not null unique,
  client_secret_hash text not null,
  status text not null default 'active'
    constraint oauth_clients_status_ck
      check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oauth_clients_app_id_idx
  on public.oauth_clients (app_id);
create index if not exists oauth_clients_status_idx
  on public.oauth_clients (status);

comment on table public.oauth_clients is
  'Phase 12K: OAuth client registrations bound to a developer app. Stores only a hash of the client secret — never plaintext.';
comment on column public.oauth_clients.client_secret_hash is
  'SHA-256 (or stronger) hash of the client secret. Plaintext is shown once at issuance and never persisted.';

-- ===========================================================================
-- 2. oauth_consents — user consent grants to an OAuth client.
-- ===========================================================================

create table if not exists public.oauth_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  client_id uuid not null
    references public.oauth_clients (id) on delete cascade,
  scopes text[] not null default '{}',
  status text not null default 'active'
    constraint oauth_consents_status_ck
      check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists oauth_consents_user_id_idx
  on public.oauth_consents (user_id);
create index if not exists oauth_consents_client_id_idx
  on public.oauth_consents (client_id);
create index if not exists oauth_consents_status_idx
  on public.oauth_consents (status);

comment on table public.oauth_consents is
  'Phase 12K: user consent grants (which scopes a user authorized for which OAuth client). Users may read only their own grants.';

-- ===========================================================================
-- 3. oauth_access_tokens — SERVICE-ROLE ONLY. Hash storage for future tokens.
-- ===========================================================================

create table if not exists public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null
    references public.oauth_consents (id) on delete cascade,
  token_hash text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists oauth_access_tokens_consent_id_idx
  on public.oauth_access_tokens (consent_id);
create index if not exists oauth_access_tokens_token_hash_idx
  on public.oauth_access_tokens (token_hash);
create index if not exists oauth_access_tokens_expires_at_idx
  on public.oauth_access_tokens (expires_at);

comment on table public.oauth_access_tokens is
  'Phase 12K: access token store (future). SERVICE-ROLE ONLY — RLS denies all authenticated/public access. Stores token_hash only, never plaintext.';

-- ===========================================================================
-- 4. oauth_refresh_tokens — SERVICE-ROLE ONLY. Hash storage for future tokens.
-- ===========================================================================

create table if not exists public.oauth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null
    references public.oauth_consents (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists oauth_refresh_tokens_consent_id_idx
  on public.oauth_refresh_tokens (consent_id);
create index if not exists oauth_refresh_tokens_token_hash_idx
  on public.oauth_refresh_tokens (token_hash);
create index if not exists oauth_refresh_tokens_expires_at_idx
  on public.oauth_refresh_tokens (expires_at);

comment on table public.oauth_refresh_tokens is
  'Phase 12K: refresh token store (future). SERVICE-ROLE ONLY — RLS denies all authenticated/public access. Stores token_hash only, never plaintext.';

-- ===========================================================================
-- 5. oauth_audit_events — security + compliance audit trail.
-- ===========================================================================

create table if not exists public.oauth_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid
    references auth.users (id) on delete set null,
  client_id uuid
    references public.oauth_clients (id) on delete set null,
  event_type text not null
    constraint oauth_audit_events_type_ck
      check (event_type in (
        'consent_granted',
        'consent_revoked',
        'token_issued',
        'token_revoked',
        'token_refresh_attempt',
        'oauth_client_disabled',
        'suspicious_oauth_activity'
      )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists oauth_audit_events_user_id_idx
  on public.oauth_audit_events (user_id);
create index if not exists oauth_audit_events_client_id_idx
  on public.oauth_audit_events (client_id);
create index if not exists oauth_audit_events_event_type_idx
  on public.oauth_audit_events (event_type);
create index if not exists oauth_audit_events_created_at_idx
  on public.oauth_audit_events (created_at desc);

comment on table public.oauth_audit_events is
  'Phase 12K: append-only OAuth audit trail. Inserts are service-role only; users read their own events, admins read all.';

-- Expand audit event types on existing deployments (idempotent).
alter table public.oauth_audit_events drop constraint if exists oauth_audit_events_type_ck;
alter table public.oauth_audit_events
  add constraint oauth_audit_events_type_ck
  check (event_type in (
    'consent_granted',
    'consent_revoked',
    'token_issued',
    'token_revoked',
    'token_refresh_attempt',
    'oauth_client_disabled',
    'suspicious_oauth_activity'
  ));

-- Prefer auth.users FK when table pre-dates this migration (best-effort).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'oauth_consents_user_id_fkey'
      and conrelid = 'public.oauth_consents'::regclass
  ) then
    alter table public.oauth_consents
      add constraint oauth_consents_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
exception
  when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'oauth_audit_events_user_id_fkey'
      and conrelid = 'public.oauth_audit_events'::regclass
  ) then
    alter table public.oauth_audit_events
      add constraint oauth_audit_events_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete set null;
  end if;
exception
  when others then null;
end $$;

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.oauth_clients         enable row level security;
alter table public.oauth_consents        enable row level security;
alter table public.oauth_access_tokens   enable row level security;
alter table public.oauth_refresh_tokens  enable row level security;
alter table public.oauth_audit_events    enable row level security;

-- ---------------------------------------------------------------------------
-- oauth_clients: developers read clients tied to apps they own; admins read all.
-- Writes are admin-only in this foundation phase (registration flow is future
-- work and will run server-side).
-- ---------------------------------------------------------------------------

drop policy if exists "oauth_clients_select_developer" on public.oauth_clients;
create policy "oauth_clients_select_developer"
  on public.oauth_clients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.owner_user_id = auth.uid()
    )
  );

drop policy if exists "oauth_clients_select_admin" on public.oauth_clients;
create policy "oauth_clients_select_admin"
  on public.oauth_clients
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "oauth_clients_write_admin" on public.oauth_clients;
create policy "oauth_clients_write_admin"
  on public.oauth_clients
  for all
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select on public.oauth_clients to authenticated;

-- ---------------------------------------------------------------------------
-- oauth_consents: users read ONLY their own consents; admins read all. Writes
-- (granting/revoking) run server-side via the service role in future phases.
-- ---------------------------------------------------------------------------

drop policy if exists "oauth_consents_select_owner" on public.oauth_consents;
create policy "oauth_consents_select_owner"
  on public.oauth_consents
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "oauth_consents_select_admin" on public.oauth_consents;
create policy "oauth_consents_select_admin"
  on public.oauth_consents
  for select
  to authenticated
  using (public.tc_is_admin());

grant select on public.oauth_consents to authenticated;

-- ---------------------------------------------------------------------------
-- oauth_access_tokens / oauth_refresh_tokens: SERVICE-ROLE ONLY.
-- RLS is enabled with NO authenticated/public policies, so every
-- authenticated/anon query is denied. The service role bypasses RLS for trusted
-- server-side token issuance/verification. No grants to authenticated.
-- ---------------------------------------------------------------------------

-- (intentionally no policies and no grants for token tables)

-- ---------------------------------------------------------------------------
-- oauth_audit_events: users read their own events; admins read all. Inserts are
-- service-role only (no authenticated insert policy).
-- ---------------------------------------------------------------------------

drop policy if exists "oauth_audit_events_select_owner" on public.oauth_audit_events;
create policy "oauth_audit_events_select_owner"
  on public.oauth_audit_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "oauth_audit_events_select_admin" on public.oauth_audit_events;
create policy "oauth_audit_events_select_admin"
  on public.oauth_audit_events
  for select
  to authenticated
  using (public.tc_is_admin());

grant select on public.oauth_audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` / `with check (public.tc_is_admin())`
-- admin policy with an explicit email allow-list on auth.users, kept in sync with
-- lib/adminAccess.js ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
