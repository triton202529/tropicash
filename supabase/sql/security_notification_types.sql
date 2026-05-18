-- Security-related in-app notification types (idempotent).
-- Extends public.notifications.type CHECK to match app inserts after
-- supabase/sql/tropicash_automated_payouts.sql (or equivalent).
-- Safe to re-run: drops and recreates notifications_type_check with full allowlist.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications drop constraint if exists notifications_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type is null
    or type in (
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
      'wallet_funded',
      'triton_transfer_update',
      'security_suspicious_login',
      'security_session_revoked',
      'security_account_activity'
    )
  );
