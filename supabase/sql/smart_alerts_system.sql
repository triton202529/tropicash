-- =============================================================================
-- Tropicash: public.smart_alerts — internal proactive alerts (no blocking).
-- Run in Supabase SQL Editor after public.fraud_logs exists.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.smart_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  fraud_log_id uuid REFERENCES public.fraud_logs (id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_alerts_user_id_idx ON public.smart_alerts (user_id);
CREATE INDEX IF NOT EXISTS smart_alerts_fraud_log_id_idx ON public.smart_alerts (fraud_log_id);
CREATE INDEX IF NOT EXISTS smart_alerts_alert_type_idx ON public.smart_alerts (alert_type);
CREATE INDEX IF NOT EXISTS smart_alerts_severity_idx ON public.smart_alerts (severity);
CREATE INDEX IF NOT EXISTS smart_alerts_status_idx ON public.smart_alerts (status);
CREATE INDEX IF NOT EXISTS smart_alerts_created_at_idx ON public.smart_alerts (created_at DESC);

COMMENT ON TABLE public.smart_alerts IS 'Internal smart alerts for fraud/risk visibility (best-effort, not blocking).';
COMMENT ON COLUMN public.smart_alerts.user_id IS 'Subject user when applicable; may be NULL for system-level alerts.';
COMMENT ON COLUMN public.smart_alerts.fraud_log_id IS 'Related fraud_logs row when applicable.';

GRANT SELECT, INSERT, UPDATE ON TABLE public.smart_alerts TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.smart_alerts TO authenticated;

ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "smart_alerts_select_authenticated" ON public.smart_alerts;
CREATE POLICY "smart_alerts_select_authenticated"
  ON public.smart_alerts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "smart_alerts_insert_authenticated" ON public.smart_alerts;
CREATE POLICY "smart_alerts_insert_authenticated"
  ON public.smart_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "smart_alerts_update_authenticated" ON public.smart_alerts;
CREATE POLICY "smart_alerts_update_authenticated"
  ON public.smart_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
