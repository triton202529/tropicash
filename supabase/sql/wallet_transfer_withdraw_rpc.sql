-- Run in Supabase SQL Editor (or via migration).
-- Atomic wallet send + history, and withdraw + history.
-- Requires: public.wallets (user_id uuid PK or unique, balance numeric)
--           public.transactions (columns as inserted below)

CREATE OR REPLACE FUNCTION public.transfer_funds(
  sender_id uuid,
  recipient_id uuid,
  amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> transfer_funds.sender_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF transfer_funds.sender_id = transfer_funds.recipient_id THEN
    RAISE EXCEPTION 'cannot_send_to_self';
  END IF;

  UPDATE wallets w
  SET balance = COALESCE(w.balance, 0) - transfer_funds.amount
  WHERE w.user_id = transfer_funds.sender_id
    AND COALESCE(w.balance, 0) >= transfer_funds.amount;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  UPDATE wallets w
  SET balance = COALESCE(w.balance, 0) + transfer_funds.amount
  WHERE w.user_id = transfer_funds.recipient_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    INSERT INTO wallets (user_id, balance)
    VALUES (transfer_funds.recipient_id, transfer_funds.amount);
  END IF;

  INSERT INTO transactions (sender_id, recipient_id, amount, type, status)
  VALUES (
    transfer_funds.sender_id,
    transfer_funds.recipient_id,
    transfer_funds.amount,
    'send',
    'completed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_funds(
  user_id uuid,
  amount numeric,
  note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> withdraw_funds.user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE wallets w
  SET balance = COALESCE(w.balance, 0) - withdraw_funds.amount
  WHERE w.user_id = withdraw_funds.user_id
    AND COALESCE(w.balance, 0) >= withdraw_funds.amount;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  INSERT INTO transactions (sender_id, amount, type, status, note)
  VALUES (
    withdraw_funds.user_id,
    withdraw_funds.amount,
    'withdraw',
    'completed',
    withdraw_funds.note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds(uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_funds(uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_funds(uuid, numeric, text) TO authenticated;
