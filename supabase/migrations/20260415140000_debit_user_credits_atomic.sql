-- Débit atomique (une seule instruction SQL pour le runner Supabase).
-- Verrouille les lignes user_credits, somme le solde, fusionne les doublons, met à jour, insère credit_transactions.

CREATE OR REPLACE FUNCTION public.debit_user_credits_atomic(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'generation',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_credits integer;
  keep_id uuid;
  new_bal integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = p_user_id) THEN
    INSERT INTO public.user_credits (user_id, credits) VALUES (p_user_id, 0);
  END IF;

  PERFORM id FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

  SELECT COALESCE(SUM(credits), 0) INTO total_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;

  IF total_credits < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Crédits insuffisants',
      'current_credits', total_credits,
      'required', p_amount
    );
  END IF;

  new_bal := total_credits - p_amount;

  SELECT id INTO keep_id
  FROM public.user_credits
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  DELETE FROM public.user_credits
  WHERE user_id = p_user_id AND id IS DISTINCT FROM keep_id;

  UPDATE public.user_credits
  SET credits = new_bal, updated_at = now()
  WHERE id = keep_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reason, metadata)
  VALUES (
    p_user_id,
    -p_amount,
    'debit',
    COALESCE(NULLIF(BTRIM(COALESCE(p_reason, '')), ''), 'generation'),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'remaining_credits', new_bal,
    'debited', p_amount
  );
END;
$$;
