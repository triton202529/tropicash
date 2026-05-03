-- Payout audit fields on withdrawal_requests + notification types for admin alerts.
-- Run in Supabase SQL editor after withdrawal_requests and notifications exist.

alter table public.withdrawal_requests
  add column if not exists paid_via text,
  add column if not exists external_reference text;

-- Allow create_notification RPC to insert these types (matches app usage).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications drop constraint if exists notifications_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type = any (
      array[
        'money_sent'::text,
        'money_received'::text,
        'wallet_funded'::text,
        'withdraw_wallet'::text,
        'admin_withdrawal_request'::text
      ]
    )
  );
