-- Extend notifications.type for withdrawal status alerts (run in Supabase SQL editor).

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
      'withdrawal_rejected'
    )
  );
