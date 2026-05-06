-- Automated withdrawal payouts (PayPal Payouts + future processors).
-- Run in Supabase SQL editor after withdrawal_requests + notifications exist.

-- ---------------------------------------------------------------------------
-- profiles: PayPal / payout destination email (MVP)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists payout_email text;

comment on column public.profiles.payout_email is 'PayPal payout recipient email; optional — falls back to profiles.email when null.';

-- ---------------------------------------------------------------------------
-- withdrawal_requests: processor audit + payout destination snapshot
-- ---------------------------------------------------------------------------
alter table public.withdrawal_requests
  add column if not exists payout_destination text,
  add column if not exists payout_email text,
  add column if not exists processor text,
  add column if not exists processor_batch_id text,
  add column if not exists processor_item_id text,
  add column if not exists processor_status text,
  add column if not exists processor_response jsonb,
  add column if not exists failure_reason text,
  add column if not exists updated_at timestamptz,
  add column if not exists paid_via text,
  add column if not exists external_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists payout_processing_notified_at timestamptz;

comment on column public.withdrawal_requests.payout_processing_notified_at is 'Set when user received withdrawal_payout_processing notification (optional dedupe).';

-- Allow automated "failed" state (distinct from admin "rejected")
alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_status_ck;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_status_ck check (
    lower(btrim(status)) in ('pending', 'processing', 'paid', 'failed', 'rejected')
  );

create index if not exists withdrawal_requests_processor_batch_id_idx
  on public.withdrawal_requests (processor_batch_id)
  where processor_batch_id is not null;

create index if not exists withdrawal_requests_processor_item_id_idx
  on public.withdrawal_requests (processor_item_id)
  where processor_item_id is not null;

-- ---------------------------------------------------------------------------
-- Webhook idempotency log (service role only in app)
-- ---------------------------------------------------------------------------
create table if not exists public.payout_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paypal',
  event_id text not null,
  event_type text,
  resource jsonb,
  raw_event jsonb,
  matched_withdrawal_id uuid references public.withdrawal_requests (id) on delete set null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now(),
  constraint payout_webhook_events_provider_event_unique unique (provider, event_id)
);

create index if not exists payout_webhook_events_created_at_idx
  on public.payout_webhook_events (created_at desc);

alter table public.payout_webhook_events enable row level security;

-- No policies: only Supabase service role (bypasses RLS) writes from API routes.

-- ---------------------------------------------------------------------------
-- notifications: payout lifecycle types
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications drop constraint if exists notifications_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'fund_wallet',
      'receive_money',
      'send_money',
      'withdraw_wallet',
      'admin_withdrawal_request',
      'withdrawal_processing',
      'withdrawal_paid',
      'withdrawal_rejected',
      'withdrawal_payout_processing',
      'withdrawal_payout_failed',
      'money_sent',
      'money_received',
      'wallet_funded'
    )
  );
