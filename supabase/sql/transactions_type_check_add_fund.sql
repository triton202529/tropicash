-- =============================================================================
-- transactions.type: extend CHECK to allow 'fund' (wallet top-up).
-- Run in Supabase SQL Editor after verifying current definition and row values.
-- =============================================================================

-- 1) Inspect current check constraint on public.transactions
SELECT c.conname,
       pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'transactions'
  AND c.contype = 'c'
  AND c.conname = 'transactions_type_check';

-- Optional: see every type value present in data (include all in new CHECK)
SELECT type, COUNT(*) AS n
FROM public.transactions
GROUP BY type
ORDER BY type;

-- 2) Drop old check (name must match your DB; adjust if inspect shows different name)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

-- 3) Recreate including fund (add any other types from GROUP BY above, e.g. deposit_to_triton)
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('send', 'receive', 'withdraw', 'fund'));
