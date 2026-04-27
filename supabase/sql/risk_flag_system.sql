-- =============================================================================
-- Tropicash: user-level risk memory on public.profiles
-- Deterministic flags derived from fraud_logs (admin visibility only; no blocking).
-- Run in Supabase Dashboard → SQL Editor after public.profiles exists.
-- =============================================================================

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low';

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS risk_score_snapshot numeric NULL;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS risk_last_evaluated_at timestamptz NULL;

UPDATE public.profiles
SET risk_flags = '[]'::jsonb
WHERE risk_flags IS NULL
   OR jsonb_typeof(risk_flags) IS DISTINCT FROM 'array';

UPDATE public.profiles
SET risk_level = 'low'
WHERE risk_level IS NULL
   OR risk_level NOT IN ('low', 'medium', 'high');

ALTER TABLE IF EXISTS public.profiles
  ALTER COLUMN risk_level SET DEFAULT 'low';

ALTER TABLE IF EXISTS public.profiles
  ALTER COLUMN risk_flags SET DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.conname = 'profiles_risk_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_risk_level_check
      CHECK (risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.conname = 'profiles_risk_flags_array_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_risk_flags_array_check
      CHECK (jsonb_typeof(risk_flags) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_risk_level_idx ON public.profiles (risk_level);

CREATE INDEX IF NOT EXISTS profiles_risk_last_evaluated_at_idx ON public.profiles (risk_last_evaluated_at DESC NULLS LAST);

COMMENT ON COLUMN public.profiles.risk_level IS 'Account-level tier from fraud_logs aggregates (low | medium | high).';
COMMENT ON COLUMN public.profiles.risk_flags IS 'Deterministic account flags (string array in JSON).';
COMMENT ON COLUMN public.profiles.risk_score_snapshot IS 'Average fraud risk score at last evaluation.';
COMMENT ON COLUMN public.profiles.risk_last_evaluated_at IS 'When risk_level / risk_flags were last recomputed.';
