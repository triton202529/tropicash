-- Fraud detection audit trail (Phase 1: log + score only; no blocking).
-- Run in Supabase SQL Editor or via migration.

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
