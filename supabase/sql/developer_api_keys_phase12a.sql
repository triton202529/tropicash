-- Tropicash Developer Center — Phase 12A: real API credential infrastructure.
--
-- First production-grade API credential vault for the Developer Console. Stores
-- ONLY non-secret credential metadata plus a SHA-256 hash of the secret. The
-- plaintext secret is NEVER stored — it is generated and shown to the developer
-- exactly once at creation/rotation time and then discarded.
--
-- Scope: Developer Center only. Does NOT touch wallets, transactions, PayPal,
-- treasury, fraud systems, user balances, or withdrawals.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--
--   1. `supabase/sql/developer_orgs_phase4a.sql` — required:
--        `developer_organizations`, `developer_apps` (FK targets + ownership for RLS).
--   2. THIS FILE — `developer_api_keys`.
--
-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql /
-- lib/adminAccess.js). If that helper is missing in an environment, use the
-- fallback note at the bottom of this file.

-- ---------------------------------------------------------------------------
-- developer_api_keys
-- ---------------------------------------------------------------------------

create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  key_name text not null,
  public_key text not null unique,
  secret_hash text not null,
  environment text not null default 'sandbox'
    constraint developer_api_keys_environment_ck
      check (environment in ('sandbox', 'production')),
  status text not null default 'active'
    constraint developer_api_keys_status_ck
      check (status in ('active', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null
);

create index if not exists developer_api_keys_organization_id_idx
  on public.developer_api_keys (organization_id);

create index if not exists developer_api_keys_app_id_idx
  on public.developer_api_keys (app_id);

create index if not exists developer_api_keys_created_by_idx
  on public.developer_api_keys (created_by);

create index if not exists developer_api_keys_status_environment_idx
  on public.developer_api_keys (status, environment);

create index if not exists developer_api_keys_public_key_idx
  on public.developer_api_keys (public_key);

create index if not exists developer_api_keys_created_at_idx
  on public.developer_api_keys (created_at desc);

comment on table public.developer_api_keys is
  'Phase 12A: real API credentials per developer app. Stores SHA-256 secret hash only — never plaintext. Owner/member-scoped via RLS.';
comment on column public.developer_api_keys.secret_hash is
  'SHA-256 hex digest of the plaintext secret. The plaintext is shown to the developer once and never persisted.';
comment on column public.developer_api_keys.public_key is
  'Non-secret publishable identifier (e.g. tc_pub_test_...). Safe to display and store.';

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Developers may read/manage keys that belong to an organization they are a
-- member of. The org registry models membership as organization ownership
-- (developer_organizations.owner_user_id), so membership = ownership here.
-- Admins get full visibility/management via public.tc_is_admin().
-- ---------------------------------------------------------------------------

alter table public.developer_api_keys enable row level security;

drop policy if exists "developer_api_keys_select_member"
  on public.developer_api_keys;
create policy "developer_api_keys_select_member"
  on public.developer_api_keys
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_api_keys_select_admin"
  on public.developer_api_keys;
create policy "developer_api_keys_select_admin"
  on public.developer_api_keys
  for select
  to authenticated
  using (public.tc_is_admin());

-- Insert: the creator must be the caller, the credential's app must belong to
-- the caller, and the app must live under the referenced organization.
drop policy if exists "developer_api_keys_insert_member"
  on public.developer_api_keys;
create policy "developer_api_keys_insert_member"
  on public.developer_api_keys
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
    and exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.organization_id = organization_id
        and a.owner_user_id = auth.uid()
    )
  );

-- Update: members may update keys (status changes, last_used_at) for orgs they
-- own. They cannot move a key to an org they do not own.
drop policy if exists "developer_api_keys_update_member"
  on public.developer_api_keys;
create policy "developer_api_keys_update_member"
  on public.developer_api_keys
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_api_keys_update_admin"
  on public.developer_api_keys;
create policy "developer_api_keys_update_admin"
  on public.developer_api_keys
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_api_keys_delete_admin"
  on public.developer_api_keys;
create policy "developer_api_keys_delete_admin"
  on public.developer_api_keys
  for delete
  to authenticated
  using (public.tc_is_admin());

grant select, insert, update, delete on public.developer_api_keys to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` / `with check (public.tc_is_admin())`
-- admin policy with an explicit email allow-list on auth.users, kept in sync with
-- lib/adminAccess.js ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
