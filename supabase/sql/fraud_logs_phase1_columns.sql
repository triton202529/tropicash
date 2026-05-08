-- Phase 1 structured fraud events (log-only). Run after fraud_logs core + review columns exist.
-- Adds explicit event_type, description, and metadata for analyst review.

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS event_type text;

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE IF EXISTS public.fraud_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.fraud_logs.event_type IS 'Rule id / event code (e.g. DUPLICATE_FUNDING_BLOCKED).';
COMMENT ON COLUMN public.fraud_logs.description IS 'Human-readable explanation for reviewers.';
COMMENT ON COLUMN public.fraud_logs.metadata IS 'Structured context (order ids, counts); avoid storing secrets.';

CREATE INDEX IF NOT EXISTS fraud_logs_event_type_idx ON public.fraud_logs (event_type);
