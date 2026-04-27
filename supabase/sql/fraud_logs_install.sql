-- =============================================================================
-- Tropicash: public.fraud_logs — full install (table + review columns + RLS)
-- Run in Supabase Dashboard → SQL Editor (one project = one database).
--
-- Fixes: "Could not find the table 'public.fraud_logs' in the schema cache"
-- when the table was never created, or RLS blocked all access.
--
-- Prerequisites:
--   - public.transactions exists with column id uuid (FK on related_transaction_id).
--     Verify: SELECT column_name, data_type FROM information_schema.columns
--              WHERE table_schema='public' AND table_name='transactions' AND column_name='id';
--   - If CREATE fails on FK, temporarily omit the REFERENCES line below, run the script,
--     fix types, then: ALTER TABLE public.fraud_logs ADD CONSTRAINT ... FOREIGN KEY ...
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Core table (Phase 1)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fraud_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_type text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  risk_score smallint NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_transaction_id uuid REFERENCES public.transactions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fraud_logs_transaction_type_check CHECK (
    transaction_type = ANY (ARRAY['send'::text, 'fund'::text, 'withdraw'::text])
  ),
  CONSTRAINT fraud_logs_risk_level_check CHECK (
    risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])
  )
);

CREATE INDEX IF NOT EXISTS fraud_logs_user_id_idx ON public.fraud_logs (user_id);
CREATE INDEX IF NOT EXISTS fraud_logs_transaction_type_idx ON public.fraud_logs (transaction_type);
CREATE INDEX IF NOT EXISTS fraud_logs_risk_level_idx ON public.fraud_logs (risk_level);
CREATE INDEX IF NOT EXISTS fraud_logs_created_at_idx ON public.fraud_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_logs_related_transaction_id_idx ON public.fraud_logs (related_transaction_id);

COMMENT ON TABLE public.fraud_logs IS 'Rule-based fraud scores for post-success wallet transactions (review only).';

-- ---------------------------------------------------------------------------
-- B) Review workflow columns (Phase 3)
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

UPDATE public.fraud_logs
SET status = 'open'
WHERE status IS NULL;

ALTER TABLE IF EXISTS public.fraud_logs
  ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE IF EXISTS public.fraud_logs
  ALTER COLUMN status SET NOT NULL;

UPDATE public.fraud_logs
SET status = 'open'
WHERE status IS NULL
   OR status NOT IN ('open', 'reviewed', 'escalated');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'fraud_logs'
      AND c.conname = 'fraud_logs_status_check'
  ) THEN
    ALTER TABLE IF EXISTS public.fraud_logs
      ADD CONSTRAINT fraud_logs_status_check
      CHECK (
        status = ANY (
          ARRAY['open'::text, 'reviewed'::text, 'escalated'::text]
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fraud_logs_status_idx ON public.fraud_logs (status);
CREATE INDEX IF NOT EXISTS fraud_logs_reviewed_by_idx ON public.fraud_logs (reviewed_by);
CREATE INDEX IF NOT EXISTS fraud_logs_reviewed_at_idx ON public.fraud_logs (reviewed_at);

COMMENT ON COLUMN public.fraud_logs.status IS 'Review workflow: open | reviewed | escalated';
COMMENT ON COLUMN public.fraud_logs.review_note IS 'Optional analyst note (does not imply status change).';
COMMENT ON COLUMN public.fraud_logs.reviewed_by IS 'Last user who changed review status or timestamp trail (app sets on status actions).';
COMMENT ON COLUMN public.fraud_logs.reviewed_at IS 'Timestamp of last status transition (app sets on status actions).';

-- ---------------------------------------------------------------------------
-- C) Grants (JWT role used by the browser client)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fraud_logs TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fraud_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- D) RLS — simple dev policies (tighten later to admin-only via JWT claim or table)
-- ---------------------------------------------------------------------------

ALTER TABLE public.fraud_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_logs_select_authenticated" ON public.fraud_logs;
CREATE POLICY "fraud_logs_select_authenticated"
  ON public.fraud_logs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fraud_logs_insert_authenticated" ON public.fraud_logs;
CREATE POLICY "fraud_logs_insert_authenticated"
  ON public.fraud_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "fraud_logs_update_authenticated" ON public.fraud_logs;
CREATE POLICY "fraud_logs_update_authenticated"
  ON public.fraud_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
