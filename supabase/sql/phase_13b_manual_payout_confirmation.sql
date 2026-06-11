-- Phase 13B: Manual external payout confirmation audit fields.
-- Run after withdrawal_requests exists. Does not change wallet debit/refund logic.

alter table public.withdrawal_requests
  add column if not exists manual_payout_reference text,
  add column if not exists manual_payout_confirmed_at timestamptz,
  add column if not exists manual_payout_confirmed_by uuid references auth.users (id) on delete set null;

comment on column public.withdrawal_requests.manual_payout_reference is
  'External receipt / transaction ID when admin records manual off-platform payout (Phase 13B).';
comment on column public.withdrawal_requests.manual_payout_confirmed_at is
  'When admin confirmed external payment was completed outside Tropicash.';
comment on column public.withdrawal_requests.manual_payout_confirmed_by is
  'Admin user who confirmed manual external payout.';
