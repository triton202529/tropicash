-- In-app notifications for Tropicash (run in Supabase SQL Editor or as a migration).
-- After applying: Dashboard → Database → Replication → enable `notifications` for Realtime if needed.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('money_sent', 'money_received', 'wallet_funded')
  ),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  related_transaction_id uuid REFERENCES public.transactions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Read own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update own (e.g. mark read)
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert: own user_id, OR recipient row for a send the current user initiated
CREATE POLICY "notifications_insert_own_or_recipient_for_send"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (
      related_transaction_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.transactions tr
        WHERE tr.id = related_transaction_id
          AND tr.sender_id = auth.uid()
          AND tr.recipient_id = notifications.user_id
          AND lower(trim(coalesce(tr.type::text, ''))) = 'send'
      )
    )
  );

-- Realtime: add table to publication (skip or ignore error if already a member)
-- Dashboard → Database → Replication: ensure `notifications` is enabled.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
