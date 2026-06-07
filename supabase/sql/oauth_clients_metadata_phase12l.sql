-- Tropicash Developer Center — Phase 12L: OAuth client registration metadata.
--
-- Extends the Phase 12K `oauth_clients` table with the metadata required for the
-- developer registration workflow (client name + redirect URIs) and adds the
-- owner-scoped RLS write policies so approved developers can register, rotate,
-- and disable their own OAuth clients.
--
-- This is the client-management layer ONLY. No OAuth authorization flow, no
-- access/refresh tokens, no consent, no authorization codes, no wallet APIs,
-- and no money movement.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--
--   1. `supabase/sql/developer_orgs_phase4a.sql`            — apps + ownership.
--   2. `supabase/sql/oauth_consent_foundation_phase12k.sql` — oauth_clients table.
--   3. THIS FILE — adds client_name / redirect_uris + developer write RLS.
--
-- Admin gating uses public.tc_is_admin().

-- ---------------------------------------------------------------------------
-- Additional metadata columns
-- ---------------------------------------------------------------------------

alter table public.oauth_clients
  add column if not exists client_name text;

alter table public.oauth_clients
  add column if not exists redirect_uris text[] not null default '{}';

comment on column public.oauth_clients.client_name is
  'Human-readable name for the OAuth client (developer-supplied).';
comment on column public.oauth_clients.redirect_uris is
  'Allowed OAuth redirect URIs. HTTPS required; http only for localhost in sandbox; no wildcards.';

-- ---------------------------------------------------------------------------
-- Developer write RLS
--
-- Phase 12K granted developers SELECT on clients tied to apps they own, plus an
-- admin-only write policy. This phase adds owner-scoped INSERT + UPDATE so a
-- developer can register / rotate / disable clients for apps they own. Deletes
-- remain admin-only (developers disable instead of deleting).
-- ---------------------------------------------------------------------------

drop policy if exists "oauth_clients_insert_developer" on public.oauth_clients;
create policy "oauth_clients_insert_developer"
  on public.oauth_clients
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.owner_user_id = auth.uid()
    )
  );

drop policy if exists "oauth_clients_update_developer" on public.oauth_clients;
create policy "oauth_clients_update_developer"
  on public.oauth_clients
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.owner_user_id = auth.uid()
    )
  );

grant insert, update on public.oauth_clients to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` / `with check (public.tc_is_admin())`
-- admin policy with an explicit email allow-list on auth.users, kept in sync with
-- lib/adminAccess.js ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
