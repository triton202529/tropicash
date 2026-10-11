-- Phase 2: financial-control schema the send, withdrawal, and payout-webhook
-- APIs already call. Does not change Phase 1 money-RPC grants or tc_is_admin().
-- Does not create admin_members (authorization migration is deferred).
--
-- Apply once on a database that already has auth.users, public.transactions,
-- public.withdrawal_requests, and public.tc_is_admin(). Re-run is idempotent.
--
-- Live apply was two migrations:
--   phase2_financial_schema_alignment
--   phase2_financial_schema_alignment_grants
-- The second migration only removes service-role delete/truncate (and audit
-- update) privileges that Supabase default privileges attach at CREATE TABLE.

-- ---------------------------------------------------------------------------
-- Shared guards
-- ---------------------------------------------------------------------------

create or replace function public.prevent_financial_idempotency_mutation()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'idempotency_key_immutable'
      using errcode = '42501';
  end if;

  if tg_table_name = 'transfer_idempotency_keys' then
    if new.recipient_id is distinct from old.recipient_id
       or new.amount is distinct from old.amount then
      raise exception 'idempotency_terms_immutable'
        using errcode = '42501';
    end if;
    if old.status = 'completed' and (
      new.status is distinct from old.status
      or new.transaction_id is distinct from old.transaction_id
      or new.response_payload is distinct from old.response_payload
    ) then
      raise exception 'idempotency_completed_immutable'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'withdrawal_idempotency_keys' then
    if new.amount is distinct from old.amount
       or new.payout_email is distinct from old.payout_email then
      raise exception 'idempotency_terms_immutable'
        using errcode = '42501';
    end if;
    if old.status = 'completed' and (
      new.status is distinct from old.status
      or new.request_id is distinct from old.request_id
      or new.response_payload is distinct from old.response_payload
    ) then
      raise exception 'idempotency_completed_immutable'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.prevent_financial_idempotency_mutation() is
  'Rejects changes to the user, key, amount, recipient, or payout email, and freezes a completed result.';

revoke all on function public.prevent_financial_idempotency_mutation() from public;
grant execute on function public.prevent_financial_idempotency_mutation() to service_role;

create or replace function public.sync_payout_webhook_processing_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.processed and not new.processed then
    raise exception 'webhook_event_already_processed'
      using errcode = '42501';
  end if;

  if new.processed then
    new.processing_status := 'processed';
    new.processing_error := null;
  elsif new.processing_error is not null then
    new.processing_status := 'failed';
  elsif new.processing_status is null or new.processing_status = '' then
    new.processing_status := 'received';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.sync_payout_webhook_processing_status() is
  'Keeps explicit processing_status aligned with processed/processing_error and blocks reopening a processed event.';

revoke all on function public.sync_payout_webhook_processing_status() from public;
grant execute on function public.sync_payout_webhook_processing_status() to service_role;

-- ---------------------------------------------------------------------------
-- transfer_idempotency_keys
-- Contract: pages/api/transfers/send.js + lib/financialIdempotency.js
-- ---------------------------------------------------------------------------

create table if not exists public.transfer_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  idempotency_key text not null,
  recipient_id uuid not null,
  amount numeric not null,
  status text not null default 'processing',
  transaction_id uuid null references public.transactions (id) on delete restrict,
  response_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_idempotency_user_key_unique unique (user_id, idempotency_key),
  constraint transfer_idempotency_key_format check (
    char_length(idempotency_key) between 8 and 128
    and idempotency_key ~ '^[A-Za-z0-9._-]+$'
  ),
  constraint transfer_idempotency_amount_positive check (amount > 0),
  constraint transfer_idempotency_status_check check (
    status = any (array['processing'::text, 'completed'::text, 'failed'::text])
  )
);

comment on table public.transfer_idempotency_keys is
  'One logical send per authenticated user and idempotency key. Service role only. Completed rows are frozen.';

alter table public.transfer_idempotency_keys enable row level security;

drop trigger if exists trg_transfer_idempotency_immutable on public.transfer_idempotency_keys;
create trigger trg_transfer_idempotency_immutable
  before update on public.transfer_idempotency_keys
  for each row
  execute function public.prevent_financial_idempotency_mutation();

create index if not exists transfer_idempotency_keys_user_id_idx
  on public.transfer_idempotency_keys (user_id);

create index if not exists transfer_idempotency_keys_status_idx
  on public.transfer_idempotency_keys (status);

revoke all on table public.transfer_idempotency_keys from public;
revoke all on table public.transfer_idempotency_keys from anon;
revoke all on table public.transfer_idempotency_keys from authenticated;
grant select, insert, update on table public.transfer_idempotency_keys to service_role;
revoke delete, truncate, references, trigger on table public.transfer_idempotency_keys from service_role;

-- ---------------------------------------------------------------------------
-- withdrawal_idempotency_keys
-- Contract: pages/api/withdrawals/create.js + lib/financialIdempotency.js
-- ---------------------------------------------------------------------------

create table if not exists public.withdrawal_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  idempotency_key text not null,
  amount numeric not null,
  payout_email text not null,
  status text not null default 'processing',
  request_id uuid null references public.withdrawal_requests (id) on delete restrict,
  response_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint withdrawal_idempotency_user_key_unique unique (user_id, idempotency_key),
  constraint withdrawal_idempotency_key_format check (
    char_length(idempotency_key) between 8 and 128
    and idempotency_key ~ '^[A-Za-z0-9._-]+$'
  ),
  constraint withdrawal_idempotency_amount_positive check (amount > 0),
  constraint withdrawal_idempotency_email_present check (char_length(btrim(payout_email)) > 3),
  constraint withdrawal_idempotency_status_check check (
    status = any (array['processing'::text, 'completed'::text, 'failed'::text])
  )
);

comment on table public.withdrawal_idempotency_keys is
  'One logical withdrawal per authenticated user and idempotency key, bound to amount and payout email. Service role only.';

alter table public.withdrawal_idempotency_keys enable row level security;

drop trigger if exists trg_withdrawal_idempotency_immutable on public.withdrawal_idempotency_keys;
create trigger trg_withdrawal_idempotency_immutable
  before update on public.withdrawal_idempotency_keys
  for each row
  execute function public.prevent_financial_idempotency_mutation();

create index if not exists withdrawal_idempotency_keys_user_id_idx
  on public.withdrawal_idempotency_keys (user_id);

create index if not exists withdrawal_idempotency_keys_status_idx
  on public.withdrawal_idempotency_keys (status);

revoke all on table public.withdrawal_idempotency_keys from public;
revoke all on table public.withdrawal_idempotency_keys from anon;
revoke all on table public.withdrawal_idempotency_keys from authenticated;
grant select, insert, update on table public.withdrawal_idempotency_keys to service_role;
revoke delete, truncate, references, trigger on table public.withdrawal_idempotency_keys from service_role;

-- ---------------------------------------------------------------------------
-- payout_webhook_events
-- Contract: pages/api/webhooks/paypal.js insert/update columns.
-- processing_status is maintained by trigger so the handler can keep writing
-- processed and processing_error.
-- ---------------------------------------------------------------------------

create table if not exists public.payout_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paypal',
  event_id text not null,
  event_type text,
  resource jsonb,
  raw_event jsonb,
  matched_withdrawal_id uuid null references public.withdrawal_requests (id) on delete set null,
  processed boolean not null default false,
  processing_status text not null default 'received',
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_webhook_events_provider_event_unique unique (provider, event_id),
  constraint payout_webhook_events_provider_check check (provider in ('paypal')),
  constraint payout_webhook_events_event_id_present check (char_length(btrim(event_id)) > 0),
  constraint payout_webhook_events_status_check check (
    processing_status = any (array['received'::text, 'processed'::text, 'failed'::text])
  )
);

comment on table public.payout_webhook_events is
  'Durable PayPal payout webhook log. Unique provider event id. Clients have no access. A processed event cannot be reopened.';

alter table public.payout_webhook_events enable row level security;

drop trigger if exists trg_payout_webhook_processing_status on public.payout_webhook_events;
create trigger trg_payout_webhook_processing_status
  before insert or update on public.payout_webhook_events
  for each row
  execute function public.sync_payout_webhook_processing_status();

create index if not exists payout_webhook_events_created_at_idx
  on public.payout_webhook_events (created_at desc);

create index if not exists payout_webhook_events_status_idx
  on public.payout_webhook_events (processing_status);

revoke all on table public.payout_webhook_events from public;
revoke all on table public.payout_webhook_events from anon;
revoke all on table public.payout_webhook_events from authenticated;
grant select, insert, update on table public.payout_webhook_events to service_role;
revoke delete, truncate, references, trigger on table public.payout_webhook_events from service_role;

-- ---------------------------------------------------------------------------
-- audit_timeline
-- Contract: lib/auditTimeline.js appendAuditEventServer.
-- Reads use tc_is_admin() plus the caller's own rows. No client writes.
-- ---------------------------------------------------------------------------

create table if not exists public.audit_timeline (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  severity text not null default 'info',
  actor_user_id uuid null references auth.users (id) on delete set null,
  target_user_id uuid null references auth.users (id) on delete set null,
  title text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_timeline_severity_check check (
    severity in ('info', 'success', 'warning', 'critical')
  ),
  constraint audit_timeline_entity_type_check check (
    entity_type in (
      'user',
      'withdrawal',
      'transaction',
      'triton_transfer',
      'fraud_case',
      'treasury',
      'admin_action',
      'notification',
      'developer_app'
    )
  )
);

comment on table public.audit_timeline is
  'Append-only operational timeline. Service role inserts. Authenticated users may read their own rows; admins read all via tc_is_admin().';

alter table public.audit_timeline enable row level security;

drop policy if exists "audit_timeline_select" on public.audit_timeline;
create policy "audit_timeline_select"
  on public.audit_timeline
  for select
  to authenticated
  using (
    public.tc_is_admin()
    or target_user_id = auth.uid()
    or (entity_type = 'user' and entity_id = auth.uid()::text)
    or actor_user_id = auth.uid()
  );

create index if not exists audit_timeline_entity_created_idx
  on public.audit_timeline (entity_type, entity_id, created_at desc);

create index if not exists audit_timeline_created_idx
  on public.audit_timeline (created_at desc);

create index if not exists audit_timeline_severity_idx
  on public.audit_timeline (severity);

revoke all on table public.audit_timeline from public;
revoke all on table public.audit_timeline from anon;
revoke all on table public.audit_timeline from authenticated;
grant select on table public.audit_timeline to authenticated;
grant select, insert on table public.audit_timeline to service_role;
revoke update, delete, truncate, references, trigger on table public.audit_timeline from service_role;

-- ---------------------------------------------------------------------------
-- admin_audit_logs
-- Contract: lib/adminAudit.js. Inserts are best-effort from KYC and admin actions.
-- Authorization stays on tc_is_admin(); this table does not grant admin rights.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  category text not null default 'security',
  severity text not null default 'info',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_category_ck check (
    category in ('security', 'wallet', 'withdrawal', 'payout', 'user_management', 'system')
  ),
  constraint admin_audit_logs_severity_ck check (
    severity in ('info', 'warning', 'high', 'critical')
  )
);

comment on table public.admin_audit_logs is
  'Append-only admin action log. Select and insert require tc_is_admin() for authenticated callers. No update or delete grant.';

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin_audit_logs_select_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_select_admin"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "admin_audit_logs_insert_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_insert_admin"
  on public.admin_audit_logs
  for insert
  to authenticated
  with check (public.tc_is_admin());

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_user_id);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_user_id);
create index if not exists admin_audit_logs_category_idx on public.admin_audit_logs (category);

revoke all on table public.admin_audit_logs from public;
revoke all on table public.admin_audit_logs from anon;
revoke all on table public.admin_audit_logs from authenticated;
grant select, insert on table public.admin_audit_logs to authenticated;
grant select, insert on table public.admin_audit_logs to service_role;
revoke update, delete, truncate, references, trigger on table public.admin_audit_logs from service_role;

-- ---------------------------------------------------------------------------
-- Phase 1 grant invariant. This block does not grant money RPCs.
-- ---------------------------------------------------------------------------

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'fund_wallet(uuid,numeric)',
    'transfer_funds(uuid,uuid,numeric)',
    'create_withdrawal_request(uuid,numeric,text)',
    'refund_withdrawal_request(uuid,text,uuid)'
  ]
  loop
    if has_function_privilege('anon', 'public.' || v_fn, 'execute')
       or has_function_privilege('authenticated', 'public.' || v_fn, 'execute')
       or not has_function_privilege('service_role', 'public.' || v_fn, 'execute') then
      raise exception 'phase1_money_grant_regressed: %', v_fn
        using errcode = '42501';
    end if;
  end loop;
end;
$$;
