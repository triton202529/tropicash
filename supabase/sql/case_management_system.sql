-- =============================================================================
-- Tropicash: fraud case management (structured investigations)
-- Run in Supabase SQL Editor after public.fraud_logs exists.
-- Enable Realtime for fraud_cases and fraud_case_notes in Dashboard if desired.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fraud_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  primary_fraud_log_id uuid REFERENCES public.fraud_logs (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'escalated', 'resolved')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  summary text,
  assigned_to uuid,
  opened_by uuid,
  resolved_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS fraud_cases_user_id_idx ON public.fraud_cases (user_id);
CREATE INDEX IF NOT EXISTS fraud_cases_primary_fraud_log_id_idx ON public.fraud_cases (primary_fraud_log_id);
CREATE INDEX IF NOT EXISTS fraud_cases_status_idx ON public.fraud_cases (status);
CREATE INDEX IF NOT EXISTS fraud_cases_priority_idx ON public.fraud_cases (priority);
CREATE INDEX IF NOT EXISTS fraud_cases_assigned_to_idx ON public.fraud_cases (assigned_to);
CREATE INDEX IF NOT EXISTS fraud_cases_opened_at_idx ON public.fraud_cases (opened_at DESC);
CREATE INDEX IF NOT EXISTS fraud_cases_updated_at_idx ON public.fraud_cases (updated_at DESC);

COMMENT ON TABLE public.fraud_cases IS 'Internal fraud investigation cases (operations workflow).';

CREATE TABLE IF NOT EXISTS public.fraud_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.fraud_cases (id) ON DELETE CASCADE,
  author_user_id uuid,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_case_notes_case_id_idx ON public.fraud_case_notes (case_id);
CREATE INDEX IF NOT EXISTS fraud_case_notes_author_user_id_idx ON public.fraud_case_notes (author_user_id);
CREATE INDEX IF NOT EXISTS fraud_case_notes_created_at_idx ON public.fraud_case_notes (created_at DESC);

COMMENT ON TABLE public.fraud_case_notes IS 'Internal notes on fraud_cases (append-only).';

GRANT SELECT, INSERT, UPDATE ON TABLE public.fraud_cases TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fraud_cases TO authenticated;

GRANT SELECT, INSERT ON TABLE public.fraud_case_notes TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.fraud_case_notes TO authenticated;

ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_case_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_cases_select_authenticated" ON public.fraud_cases;
CREATE POLICY "fraud_cases_select_authenticated"
  ON public.fraud_cases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fraud_cases_insert_authenticated" ON public.fraud_cases;
CREATE POLICY "fraud_cases_insert_authenticated"
  ON public.fraud_cases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "fraud_cases_update_authenticated" ON public.fraud_cases;
CREATE POLICY "fraud_cases_update_authenticated"
  ON public.fraud_cases
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "fraud_case_notes_select_authenticated" ON public.fraud_case_notes;
CREATE POLICY "fraud_case_notes_select_authenticated"
  ON public.fraud_case_notes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fraud_case_notes_insert_authenticated" ON public.fraud_case_notes;
CREATE POLICY "fraud_case_notes_insert_authenticated"
  ON public.fraud_case_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
