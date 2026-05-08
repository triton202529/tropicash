-- Manual / admin payout confirmation: audit columns on withdrawal_requests.
-- Safe to re-run (IF NOT EXISTS). Run after public.withdrawal_requests exists.
-- updated_at may already exist from tropicash_automated_payouts.sql; IF NOT EXISTS keeps this idempotent.

alter table public.withdrawal_requests
  add column if not exists processed_by uuid,
  add column if not exists processed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz;

comment on column public.withdrawal_requests.processed_by is 'User id of admin who last changed payout workflow (app sets).';
comment on column public.withdrawal_requests.processed_at is 'Timestamp of last admin payout workflow action (app sets).';
comment on column public.withdrawal_requests.rejection_reason is 'Summary shown to the user when a request is rejected (app sets).';
comment on column public.withdrawal_requests.updated_at is 'Last update to this row (app sets on status changes).';

create index if not exists withdrawal_requests_processed_at_idx
  on public.withdrawal_requests (processed_at desc)
  where processed_at is not null;
