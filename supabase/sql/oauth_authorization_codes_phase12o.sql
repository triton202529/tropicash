-- Tropicash — Phase 12O: OAuth authorization code issuance.
--
-- Adds short-lived, single-use OAuth authorization codes that are minted after a
-- valid consent approval. Codes are stored as SHA-256 hashes ONLY — the
-- plaintext code is returned exactly once and never persisted.
--
-- This phase issues authorization CODES ONLY. It does NOT issue access tokens or
-- refresh tokens, create no wallet/transaction APIs, and moves no money.
--
-- Security posture:
--   • Hash-only storage (code_hash). Plaintext never stored.
--   • 10-minute expiry (enforced in app logic via expires_at).
--   • Single-use (used_at stamped on redemption; validated as unused).
--   • Bound to a specific OAuth client (client_id) and redirect_uri.
--   • SERVICE-ROLE ONLY — RLS enabled with no authenticated/public policies,
--     mirroring the Phase 12K token tables. Issuance/validation run server-side
--     with the service role, which bypasses RLS.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--   1. supabase/sql/oauth_consent_foundation_phase12k.sql — oauth_clients,
--      oauth_consents, oauth_audit_events.
--   2. THIS FILE — oauth_authorization_codes (+ adds the
--      'authorization_code_issued' audit event type).

-- ===========================================================================
-- oauth_authorization_codes — short-lived, single-use authorization codes.
-- ===========================================================================

create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid
    references public.oauth_consents (id) on delete set null,
  client_id uuid not null
    references public.oauth_clients (id) on delete cascade,
  code_hash text not null unique,
  scopes text[] not null default '{}',
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_authorization_codes_client_id_idx
  on public.oauth_authorization_codes (client_id);
create index if not exists oauth_authorization_codes_code_hash_idx
  on public.oauth_authorization_codes (code_hash);
create index if not exists oauth_authorization_codes_expires_at_idx
  on public.oauth_authorization_codes (expires_at);
create index if not exists oauth_authorization_codes_consent_id_idx
  on public.oauth_authorization_codes (consent_id);

comment on table public.oauth_authorization_codes is
  'Phase 12O: short-lived, single-use OAuth authorization codes. SERVICE-ROLE ONLY — RLS denies all authenticated/public access. Stores code_hash only, never plaintext.';
comment on column public.oauth_authorization_codes.code_hash is
  'SHA-256 hash of the authorization code. Plaintext is returned once at issuance and never persisted.';
comment on column public.oauth_authorization_codes.used_at is
  'Set when the code is redeemed. A non-null value means the (single-use) code is spent.';

-- ===========================================================================
-- Row level security — SERVICE-ROLE ONLY.
-- RLS enabled with NO authenticated/public policies, so every authenticated/anon
-- query is denied. The service role bypasses RLS for trusted server-side
-- issuance/validation. No grants to authenticated.
-- ===========================================================================

alter table public.oauth_authorization_codes enable row level security;

-- (intentionally no policies and no grants — service role only)

-- ===========================================================================
-- Audit: allow the 'authorization_code_issued' event type (idempotent).
-- ===========================================================================

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
    'suspicious_oauth_activity',
    'authorization_code_issued',
    'token_refreshed',
    'refresh_token_reuse_detected',
    'access_token_validated',
    'access_token_rejected'
  ));

-- ===========================================================================
-- Phase 12P: allow nullable consent linkage on the 12K token tables.
--
-- The 12K token tables declared consent_id NOT NULL. In this foundation phase
-- authorization codes are issued WITHOUT a consent record (consent_id is null),
-- so the access/refresh token rows minted during the Phase 12P token exchange
-- must also support a null consent_id. We relax the NOT NULL constraint here
-- (idempotent) rather than create new tables. The FK to oauth_consents remains.
-- ===========================================================================

alter table public.oauth_access_tokens  alter column consent_id drop not null;
alter table public.oauth_refresh_tokens alter column consent_id drop not null;

-- ===========================================================================
-- Phase 12Q: refresh token rotation support.
--
-- Refresh token rotation must (a) bind a refresh token to its issuing OAuth
-- client and (b) carry the granted scopes forward to the rotated tokens. The
-- 12K refresh-token table had neither column (it only linked via consent_id,
-- which is null in this foundation phase), so we add them here (idempotent).
-- The FK to oauth_clients remains; scopes default to an empty array.
-- ===========================================================================

alter table public.oauth_refresh_tokens
  add column if not exists client_id uuid references public.oauth_clients (id) on delete cascade;
alter table public.oauth_refresh_tokens
  add column if not exists scopes text[] not null default '{}';

create index if not exists oauth_refresh_tokens_client_id_idx
  on public.oauth_refresh_tokens (client_id);

-- ===========================================================================
-- Phase 12R: access token validation middleware support.
--
-- The access token validation middleware must resolve the issuing client (and
-- thus the developer app) from a presented access token. The 12K access-token
-- table linked only via consent_id (null in this foundation phase), so we add a
-- direct client_id binding here (idempotent), mirroring the 12Q refresh tokens.
-- ===========================================================================

alter table public.oauth_access_tokens
  add column if not exists client_id uuid references public.oauth_clients (id) on delete cascade;

create index if not exists oauth_access_tokens_client_id_idx
  on public.oauth_access_tokens (client_id);
