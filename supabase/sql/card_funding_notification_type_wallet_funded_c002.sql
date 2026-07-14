-- =============================================================================
-- Phase C-002 / G: Align notifications.type CHECK with capture-order + security types
-- File: card_funding_notification_type_wallet_funded_c002.sql
-- Project: Tropicash Supabase ref opbhcndlibbcsmoaeymq
-- =============================================================================
--
-- FINDING:
--   Live notifications_type_check omitted 'wallet_funded' (and other security types
--   from supabase/sql/security_notification_types.sql). capture-order uses
--   p_type='wallet_funded', so post-funding notifications failed while wallet credit
--   succeeded.
--
-- ACTION:
--   Recreate CHECK with the documented allowlist including wallet_funded.
-- =============================================================================

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

comment on constraint notifications_type_check on public.notifications is
  'C-002 G: includes wallet_funded for PayPal capture-order funding notifications.';
