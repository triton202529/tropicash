-- TLP-002: Atomic wallet send using canonical wallet_balance column.
-- Invoked only via POST /api/transfers/send (service_role). Do not grant to authenticated.

CREATE OR REPLACE FUNCTION public.transfer_funds(
  sender_id uuid,
  recipient_id uuid,
  amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  v_tx_id uuid;
  v_sender_balance numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> transfer_funds.sender_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF transfer_funds.sender_id = transfer_funds.recipient_id THEN
    RAISE EXCEPTION 'cannot_send_to_self';
  END IF;

  UPDATE wallets w
  SET wallet_balance = COALESCE(w.wallet_balance, 0) - transfer_funds.amount
  WHERE w.user_id = transfer_funds.sender_id
    AND COALESCE(w.wallet_balance, 0) >= transfer_funds.amount;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  UPDATE wallets w
  SET wallet_balance = COALESCE(w.wallet_balance, 0) + transfer_funds.amount
  WHERE w.user_id = transfer_funds.recipient_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    INSERT INTO wallets (user_id, wallet_balance)
    VALUES (transfer_funds.recipient_id, transfer_funds.amount);
  END IF;

  INSERT INTO transactions (sender_id, recipient_id, amount, type, status)
  VALUES (
    transfer_funds.sender_id,
    transfer_funds.recipient_id,
    transfer_funds.amount,
    'send_money',
    'completed'
  )
  RETURNING id INTO v_tx_id;

  SELECT COALESCE(wallet_balance, 0) INTO v_sender_balance
  FROM wallets WHERE user_id = transfer_funds.sender_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'sender_balance', v_sender_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds(uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_funds(uuid, uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric) TO service_role;
