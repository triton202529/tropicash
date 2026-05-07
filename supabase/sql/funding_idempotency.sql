-- PayPal (and future provider) wallet funding idempotency keys.
-- Server-side writes only (service role). RLS enabled with no policies blocks direct client access.

CREATE TABLE IF NOT EXISTS public.funding_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'paypal',
  provider_order_id text NOT NULL,
  provider_capture_id text NULL,
  user_id uuid NULL,
  amount numeric NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])),
  transaction_id uuid NULL,
  notification_id uuid NULL,
  raw_response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funding_idempotency_keys_provider_order_unique UNIQUE (provider, provider_order_id)
);

CREATE INDEX IF NOT EXISTS funding_idempotency_keys_user_id_idx
  ON public.funding_idempotency_keys (user_id);

CREATE INDEX IF NOT EXISTS funding_idempotency_keys_status_idx
  ON public.funding_idempotency_keys (status);

COMMENT ON TABLE public.funding_idempotency_keys IS
  'One row per provider order; prevents duplicate wallet credits under concurrency.';

ALTER TABLE public.funding_idempotency_keys ENABLE ROW LEVEL SECURITY;
