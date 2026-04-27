-- =============================================================================
-- Tropicash: internal account control fields on public.profiles
-- Internal/admin-facing only; not used for transaction blocking.
-- Run after profiles exists.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_last_reviewed_at timestamptz NULL;

ALTER TABLE public.profiles
  ALTER COLUMN account_status SET DEFAULT 'active';

UPDATE public.profiles
SET account_status = 'active'
WHERE account_status IS NULL OR account_status = '';

UPDATE public.profiles
SET account_flags = '[]'::jsonb
WHERE account_flags IS NULL OR jsonb_typeof(account_flags) <> 'array';

ALTER TABLE public.profiles
  ALTER COLUMN account_status SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN account_flags SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN account_flags SET DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'under_review', 'restricted'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_flags_array_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_flags_array_check
  CHECK (jsonb_typeof(account_flags) = 'array');

CREATE INDEX IF NOT EXISTS profiles_account_status_idx ON public.profiles (account_status);
CREATE INDEX IF NOT EXISTS profiles_account_last_reviewed_at_idx ON public.profiles (account_last_reviewed_at DESC NULLS LAST);

COMMENT ON COLUMN public.profiles.account_status IS 'Internal account control: active | under_review | restricted.';
COMMENT ON COLUMN public.profiles.account_flags IS 'Deterministic internal control flags (string array in jsonb).';
COMMENT ON COLUMN public.profiles.account_last_reviewed_at IS 'Last time account control fields were set or recomputed.';
