-- Phase 3: fraud log review workflow (ALTER-only; does not recreate fraud_logs).
-- Run in Supabase SQL Editor or via migration runner.

-- ---------------------------------------------------------------------------
-- 1) Columns (idempotent)
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Ensure default for any legacy NULL status (defensive if column pre-existed nullable).
UPDATE public.fraud_logs
SET status = 'open'
WHERE status IS NULL;

ALTER TABLE IF EXISTS public.fraud_logs
  ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE IF EXISTS public.fraud_logs
  ALTER COLUMN status SET NOT NULL;

-- Normalize invalid legacy values before adding CHECK.
UPDATE public.fraud_logs
SET status = 'open'
WHERE status IS NULL
   OR status NOT IN ('open', 'reviewed', 'escalated');

-- ---------------------------------------------------------------------------
-- 2) Check constraint on status (add once)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3) Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS fraud_logs_status_idx ON public.fraud_logs (status);

CREATE INDEX IF NOT EXISTS fraud_logs_reviewed_by_idx ON public.fraud_logs (reviewed_by);

CREATE INDEX IF NOT EXISTS fraud_logs_reviewed_at_idx ON public.fraud_logs (reviewed_at);

COMMENT ON COLUMN public.fraud_logs.status IS 'Review workflow: open | reviewed | escalated';
COMMENT ON COLUMN public.fraud_logs.review_note IS 'Optional analyst note (does not imply status change).';
COMMENT ON COLUMN public.fraud_logs.reviewed_by IS 'Last user who changed review status or timestamp trail (app sets on status actions).';
COMMENT ON COLUMN public.fraud_logs.reviewed_at IS 'Timestamp of last status transition (app sets on status actions).';
