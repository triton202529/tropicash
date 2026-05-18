-- Tropicash Unified Notification & Event Center — Phase 1 migration.
--
-- Strictly ADDITIVE to public.notifications. Every column / index / policy below uses
-- `if not exists` (or `drop policy if exists` followed by `create policy`) so this file
-- is safe to re-run. Existing rows are not touched.
--
-- Allowed string values are intentionally NOT enforced via DB CHECK constraints. This
-- decouples deployment timing from app strings — adding a new event type or category
-- in code does not require a migration in lockstep. The application is the source of
-- truth (see lib/eventBus.js → CATEGORIES / SEVERITIES exports).
--
-- Allowed CATEGORIES (must match lib/eventBus.js):
--   system, security, payments, treasury, fraud, triton, admin, account
-- Allowed SEVERITIES (must match lib/eventBus.js):
--   info, success, warning, critical
-- Example event_type values (free-form, app-side):
--   funding.completed, funding.failed, withdrawal.processing, withdrawal.paid,
--   withdrawal.rejected, triton.completed, triton.rejected, fraud.high_risk,
--   security.rate_limit, treasury.warning
--
-- The legacy `type` column keeps its existing CHECK constraint (see
-- supabase/sql/notifications_withdrawal_status_types.sql). New emission sites should
-- use the new `event_type` column and leave `type` NULL. To make that possible we
-- drop the NOT NULL on `type` here — existing inserts that still pass a valid value
-- continue to work unchanged, and the CHECK constraint still rejects unknown
-- non-null values.
--
-- The companion table `public.notification_preferences` is created below with own-row
-- RLS so users can opt in/out of email + push without exposing other users' rows.

alter table public.notifications
  alter column type drop not null;

alter table public.notifications
  add column if not exists category text;

alter table public.notifications
  add column if not exists severity text;

alter table public.notifications
  add column if not exists read_at timestamptz;

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.notifications
  add column if not exists event_type text;

alter table public.notifications
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

comment on column public.notifications.category is
  'Event category. App-defined: system | security | payments | treasury | fraud | triton | admin | account.';
comment on column public.notifications.severity is
  'Event severity. App-defined: info | success | warning | critical.';
comment on column public.notifications.read_at is
  'When the recipient marked this notification read. Backwards compatible with the legacy is_read boolean.';
comment on column public.notifications.metadata is
  'Sanitized event metadata. Must not contain secrets / raw IPs / stack traces — caller responsibility.';
comment on column public.notifications.event_type is
  'New event identifier (e.g. funding.completed). Independent of the legacy `type` CHECK constraint.';
comment on column public.notifications.actor_user_id is
  'Optional initiator user_id when an event was caused by someone other than the recipient (admin actions, etc.).';

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_event_type_idx
  on public.notifications (event_type);

create index if not exists notifications_category_idx
  on public.notifications (category);

-- Existing policies:
--   notifications_select_own (FOR SELECT) — keep, do not duplicate.
--   notifications_update_own (FOR UPDATE) — keep, already lets the owner stamp read_at.
--   notifications_insert_own_or_recipient_for_send (FOR INSERT) — keep.
-- Phase 1 adds admin SELECT for ops visibility only. tc_is_admin() lives in
-- supabase/sql/withdrawal_requests.sql; do not redeclare here.
drop policy if exists "notifications_select_admin" on public.notifications;
create policy "notifications_select_admin"
  on public.notifications
  for select
  to authenticated
  using (public.tc_is_admin());

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  security_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-user notification channel preferences for the Unified Notification Center.';

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
  on public.notification_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
  on public.notification_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
  on public.notification_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_select_admin" on public.notification_preferences;
create policy "notification_preferences_select_admin"
  on public.notification_preferences
  for select
  to authenticated
  using (public.tc_is_admin());

grant select, insert, update on public.notification_preferences to authenticated;
