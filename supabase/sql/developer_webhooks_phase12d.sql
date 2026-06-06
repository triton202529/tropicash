-- Tropicash Developer Center — Phase 12D: developer webhooks foundation.
--
-- Webhook endpoint registry for external developers. Stores ONLY non-secret
-- metadata plus a SHA-256 hash of the webhook signing secret. The plaintext
-- secret (whsec_...) is generated, shown once, and never persisted.
--
-- Scope: Developer Platform only. Does NOT touch wallets, send money,
-- withdrawals, PayPal, treasury, fraud, or user balances. No real payment
-- events are emitted in this phase.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--
--   1. `supabase/sql/developer_orgs_phase4a.sql`  — orgs/apps + ownership for RLS.
--   2. THIS FILE — `developer_webhooks`.
--
-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql /
-- lib/adminAccess.js).

create table if not exists public.developer_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  url text not null,
  secret_hash text not null,
  status text not null default 'active'
    constraint developer_webhooks_status_ck
      check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null
);

create index if not exists developer_webhooks_organization_id_idx
  on public.developer_webhooks (organization_id);

create index if not exists developer_webhooks_app_id_idx
  on public.developer_webhooks (app_id);

create index if not exists developer_webhooks_status_idx
  on public.developer_webhooks (status);

create index if not exists developer_webhooks_created_at_idx
  on public.developer_webhooks (created_at desc);

comment on table public.developer_webhooks is
  'Phase 12D: developer webhook endpoints. Stores SHA-256 hash of the signing secret only — never plaintext. Owner/member-scoped via RLS.';
comment on column public.developer_webhooks.secret_hash is
  'SHA-256 hex digest of the plaintext whsec_ signing secret. Plaintext is shown once and never persisted.';

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Organization owners (members) may select/create/update webhooks for apps in
-- organizations they own. Admins may view all. Deletes are admin-only —
-- developers disable instead of deleting.
-- ---------------------------------------------------------------------------

alter table public.developer_webhooks enable row level security;

drop policy if exists "developer_webhooks_select_member"
  on public.developer_webhooks;
create policy "developer_webhooks_select_member"
  on public.developer_webhooks
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

drop policy if exists "developer_webhooks_select_admin"
  on public.developer_webhooks;
create policy "developer_webhooks_select_admin"
  on public.developer_webhooks
  for select
  to authenticated
  using (public.tc_is_admin());

-- Insert: creator must be the caller, the org must belong to the caller, and
-- the app must belong to the caller and live under that organization.
drop policy if exists "developer_webhooks_insert_member"
  on public.developer_webhooks;
create policy "developer_webhooks_insert_member"
  on public.developer_webhooks
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

-- Update: members may update (disable, rotate secret) webhooks for orgs they
-- own. Cannot move a webhook to an org they do not own.
drop policy if exists "developer_webhooks_update_member"
  on public.developer_webhooks;
create policy "developer_webhooks_update_member"
  on public.developer_webhooks
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

drop policy if exists "developer_webhooks_update_admin"
  on public.developer_webhooks;
create policy "developer_webhooks_update_admin"
  on public.developer_webhooks
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

-- Delete: admin only. Developers disable instead of deleting.
drop policy if exists "developer_webhooks_delete_admin"
  on public.developer_webhooks;
create policy "developer_webhooks_delete_admin"
  on public.developer_webhooks
  for delete
  to authenticated
  using (public.tc_is_admin());

grant select, insert, update on public.developer_webhooks to authenticated;
grant delete on public.developer_webhooks to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` / `with check (public.tc_is_admin())`
-- admin policy with an explicit email allow-list on auth.users, kept in sync with
-- lib/adminAccess.js ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
