-- Tropicash Developer Center — Phase 12E: developer event registry.
--
-- Single source of truth for every event that can be emitted through webhooks,
-- APIs, notifications, and future platform integrations. Documentation /
-- discovery / governance only — NO event emission, wallet movement, or payment
-- processing happens here.
--
-- Scope: Developer Platform only. Does NOT touch wallets, send money,
-- withdrawals, treasury, fraud, PayPal, or user balances.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--
--   • Standalone — no FK dependencies. Admin gating uses public.tc_is_admin()
--     (see developer_orgs_phase4a.sql / lib/adminAccess.js).

create table if not exists public.developer_event_registry (
  id uuid primary key default gen_random_uuid(),
  event_name text not null unique,
  category text not null default 'system'
    constraint developer_event_registry_category_ck
      check (category in ('wallet', 'kyc', 'developer', 'account', 'triton', 'system')),
  description text,
  status text not null default 'planned'
    constraint developer_event_registry_status_ck
      check (status in ('available', 'planned', 'internal')),
  sample_payload jsonb not null default '{}'::jsonb,
  available_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_event_registry_event_name_idx
  on public.developer_event_registry (event_name);

create index if not exists developer_event_registry_category_idx
  on public.developer_event_registry (category);

create index if not exists developer_event_registry_status_idx
  on public.developer_event_registry (status);

comment on table public.developer_event_registry is
  'Phase 12E: canonical Developer Event Registry. Read-only documentation of available/planned/internal events. No emission logic.';

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Every authenticated developer reads the shared catalog of available + planned
-- events. Internal events are hidden from non-admins. Admins read everything.
-- No mutation policies — the registry is read-only in this phase; admin
-- controls arrive in a future phase. Seed inserts below run as the migration
-- executor (table owner), which bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.developer_event_registry enable row level security;

drop policy if exists "developer_event_registry_select_public"
  on public.developer_event_registry;
create policy "developer_event_registry_select_public"
  on public.developer_event_registry
  for select
  to authenticated
  using (status in ('available', 'planned'));

drop policy if exists "developer_event_registry_select_admin"
  on public.developer_event_registry;
create policy "developer_event_registry_select_admin"
  on public.developer_event_registry
  for select
  to authenticated
  using (public.tc_is_admin());

grant select on public.developer_event_registry to authenticated;

-- ---------------------------------------------------------------------------
-- Initial seed data (idempotent via ON CONFLICT on the unique event_name).
-- developer.test is the only `available` event; everything else is `planned`.
-- No `internal` events initially.
-- ---------------------------------------------------------------------------

insert into public.developer_event_registry
  (event_name, category, description, status, sample_payload, available_since)
values
  ('developer.test', 'developer',
   'Test event delivered by the webhook test tool to verify signature handling.',
   'available',
   '{"id":"evt_test_0001","type":"developer.test","created_at":"2026-01-01T00:00:00Z","data":{"message":"Tropicash webhook test successful"}}'::jsonb,
   now()),

  ('developer.api_key_created', 'developer',
   'Emitted when a developer API credential is created.',
   'planned',
   '{"id":"evt_0001","type":"developer.api_key_created","created_at":"2026-01-01T00:00:00Z","data":{"api_key_id":"key_xxx","public_key":"tc_pub_test_xxx","environment":"sandbox"}}'::jsonb,
   null),

  ('developer.api_key_revoked', 'developer',
   'Emitted when a developer API credential is revoked.',
   'planned',
   '{"id":"evt_0002","type":"developer.api_key_revoked","created_at":"2026-01-01T00:00:00Z","data":{"api_key_id":"key_xxx","environment":"sandbox"}}'::jsonb,
   null),

  ('developer.webhook_created', 'developer',
   'Emitted when a webhook endpoint is registered.',
   'planned',
   '{"id":"evt_0003","type":"developer.webhook_created","created_at":"2026-01-01T00:00:00Z","data":{"webhook_id":"whk_xxx","url":"https://example.com/webhooks/tropicash"}}'::jsonb,
   null),

  ('developer.webhook_disabled', 'developer',
   'Emitted when a webhook endpoint is disabled.',
   'planned',
   '{"id":"evt_0004","type":"developer.webhook_disabled","created_at":"2026-01-01T00:00:00Z","data":{"webhook_id":"whk_xxx"}}'::jsonb,
   null),

  ('wallet.funded', 'wallet',
   'Emitted when a wallet is funded.',
   'planned',
   '{"id":"evt_0101","type":"wallet.funded","created_at":"2026-01-01T00:00:00Z","data":{"wallet_id":"wlt_xxx","amount":"100.00","currency":"USD"}}'::jsonb,
   null),

  ('wallet.withdrawal_requested', 'wallet',
   'Emitted when a wallet withdrawal is requested.',
   'planned',
   '{"id":"evt_0102","type":"wallet.withdrawal_requested","created_at":"2026-01-01T00:00:00Z","data":{"withdrawal_id":"wd_xxx","amount":"50.00","currency":"USD"}}'::jsonb,
   null),

  ('wallet.withdrawal_completed', 'wallet',
   'Emitted when a wallet withdrawal completes.',
   'planned',
   '{"id":"evt_0103","type":"wallet.withdrawal_completed","created_at":"2026-01-01T00:00:00Z","data":{"withdrawal_id":"wd_xxx","amount":"50.00","currency":"USD"}}'::jsonb,
   null),

  ('wallet.transfer_sent', 'wallet',
   'Emitted when a wallet transfer is sent.',
   'planned',
   '{"id":"evt_0104","type":"wallet.transfer_sent","created_at":"2026-01-01T00:00:00Z","data":{"transfer_id":"trf_xxx","amount":"25.00","currency":"USD"}}'::jsonb,
   null),

  ('wallet.transfer_received', 'wallet',
   'Emitted when a wallet transfer is received.',
   'planned',
   '{"id":"evt_0105","type":"wallet.transfer_received","created_at":"2026-01-01T00:00:00Z","data":{"transfer_id":"trf_xxx","amount":"25.00","currency":"USD"}}'::jsonb,
   null),

  ('kyc.submitted', 'kyc',
   'Emitted when a KYC application is submitted.',
   'planned',
   '{"id":"evt_0201","type":"kyc.submitted","created_at":"2026-01-01T00:00:00Z","data":{"kyc_id":"kyc_xxx","level":"basic"}}'::jsonb,
   null),

  ('kyc.approved', 'kyc',
   'Emitted when a KYC application is approved.',
   'planned',
   '{"id":"evt_0202","type":"kyc.approved","created_at":"2026-01-01T00:00:00Z","data":{"kyc_id":"kyc_xxx","level":"basic"}}'::jsonb,
   null),

  ('kyc.rejected', 'kyc',
   'Emitted when a KYC application is rejected.',
   'planned',
   '{"id":"evt_0203","type":"kyc.rejected","created_at":"2026-01-01T00:00:00Z","data":{"kyc_id":"kyc_xxx","reason":"document_unreadable"}}'::jsonb,
   null),

  ('account.created', 'account',
   'Emitted when a user account is created.',
   'planned',
   '{"id":"evt_0301","type":"account.created","created_at":"2026-01-01T00:00:00Z","data":{"account_id":"acct_xxx"}}'::jsonb,
   null),

  ('account.updated', 'account',
   'Emitted when a user account is updated.',
   'planned',
   '{"id":"evt_0302","type":"account.updated","created_at":"2026-01-01T00:00:00Z","data":{"account_id":"acct_xxx","fields":["display_name"]}}'::jsonb,
   null),

  ('triton.transfer_requested', 'triton',
   'Emitted when a Triton transfer is requested.',
   'planned',
   '{"id":"evt_0401","type":"triton.transfer_requested","created_at":"2026-01-01T00:00:00Z","data":{"transfer_id":"ttr_xxx","amount":"75.00","currency":"USD"}}'::jsonb,
   null),

  ('triton.transfer_completed', 'triton',
   'Emitted when a Triton transfer completes.',
   'planned',
   '{"id":"evt_0402","type":"triton.transfer_completed","created_at":"2026-01-01T00:00:00Z","data":{"transfer_id":"ttr_xxx","amount":"75.00","currency":"USD"}}'::jsonb,
   null),

  ('system.maintenance_started', 'system',
   'Emitted when platform maintenance begins.',
   'planned',
   '{"id":"evt_0501","type":"system.maintenance_started","created_at":"2026-01-01T00:00:00Z","data":{"window_id":"mw_xxx","scope":"platform"}}'::jsonb,
   null),

  ('system.maintenance_completed', 'system',
   'Emitted when platform maintenance completes.',
   'planned',
   '{"id":"evt_0502","type":"system.maintenance_completed","created_at":"2026-01-01T00:00:00Z","data":{"window_id":"mw_xxx","scope":"platform"}}'::jsonb,
   null)
on conflict (event_name) do nothing;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace the admin select policy's `using (public.tc_is_admin())` with an
-- explicit email allow-list on auth.users, kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
