-- =============================================================================
-- Tropicash: public.fraud_events — audit trail for fraud / risk operations
-- Best-effort inserts from app; not used for blocking.
-- Run in Supabase Dashboard → SQL Editor after public.fraud_logs exists.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_log_id uuid REFERENCES public.fraud_logs (id) ON DELETE SET NULL,
  user_id uuid,
  actor_user_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_events_fraud_log_id_idx ON public.fraud_events (fraud_log_id);
CREATE INDEX IF NOT EXISTS fraud_events_user_id_idx ON public.fraud_events (user_id);
CREATE INDEX IF NOT EXISTS fraud_events_actor_user_id_idx ON public.fraud_events (actor_user_id);
CREATE INDEX IF NOT EXISTS fraud_events_event_type_idx ON public.fraud_events (event_type);
CREATE INDEX IF NOT EXISTS fraud_events_created_at_idx ON public.fraud_events (created_at DESC);

COMMENT ON TABLE public.fraud_events IS 'Append-only audit events for fraud review and risk recompute (internal).';
COMMENT ON COLUMN public.fraud_events.fraud_log_id IS 'Related fraud_logs row when applicable; NULL for user-only events.';
COMMENT ON COLUMN public.fraud_events.user_id IS 'Subject user the event concerns.';
COMMENT ON COLUMN public.fraud_events.actor_user_id IS 'User who performed the action (often admin).';

GRANT SELECT, INSERT ON TABLE public.fraud_events TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.fraud_events TO authenticated;

ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_events_select_authenticated" ON public.fraud_events;
CREATE POLICY "fraud_events_select_authenticated"
  ON public.fraud_events
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fraud_events_insert_authenticated" ON public.fraud_events;
CREATE POLICY "fraud_events_insert_authenticated"
  ON public.fraud_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
