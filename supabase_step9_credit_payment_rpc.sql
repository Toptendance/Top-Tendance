-- =============================================================================
-- supabase_step9_credit_payment_rpc.sql
-- Phase 3.3 — Atomic RPC: record_credit_payment
-- =============================================================================
-- Records a credit repayment installment atomically:
--   1. Validates the credit record exists and is not already settled/cancelled.
--   2. Checks the payment amount does not exceed the remaining balance.
--   3. Inserts the installment row into credit_payments.
--   4. Subtracts the payment amount from customer_credits.remaining_balance.
--   5. Updates customer_credits.status:
--        remaining_balance = 0  →  'settled'
--        remaining_balance > 0  →  'partially_paid'
--   6. Updates customer_credits.updated_at to now().
--   7. Returns a JSONB summary of the operation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_credit_payment(
    p_credit_id      UUID,
    p_amount         NUMERIC,
    p_payment_method TEXT,          -- 'cash' | 'card'
    p_received_by    UUID DEFAULT NULL,
    p_notes          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit          public.customer_credits%ROWTYPE;
    v_new_balance     NUMERIC(12,3);
    v_new_status      TEXT;
    v_payment_id      UUID;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. Lock and fetch the credit record
    -- -------------------------------------------------------------------------
    SELECT * INTO v_credit
    FROM public.customer_credits
    WHERE id = p_credit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit record % not found.', p_credit_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Guard: reject payment on settled or cancelled credits
    -- -------------------------------------------------------------------------
    IF v_credit.status IN ('settled', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot record a payment on a credit that is already % (id: %).', v_credit.status, p_credit_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. Guard: payment must be positive and not exceed the remaining balance
    -- -------------------------------------------------------------------------
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero (got %).', p_amount;
    END IF;

    IF p_amount > v_credit.remaining_balance THEN
        RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%) for credit %.', p_amount, v_credit.remaining_balance, p_credit_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. Guard: payment method must be 'cash' or 'card'
    -- -------------------------------------------------------------------------
    IF p_payment_method NOT IN ('cash', 'card') THEN
        RAISE EXCEPTION 'Invalid payment_method "%". Must be ''cash'' or ''card''.', p_payment_method;
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Insert the installment into credit_payments
    -- -------------------------------------------------------------------------
    INSERT INTO public.credit_payments (
        credit_id,
        amount,
        payment_method,
        received_by,
        notes,
        created_at
    )
    VALUES (
        p_credit_id,
        p_amount,
        p_payment_method,
        p_received_by,
        p_notes,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_payment_id;

    -- -------------------------------------------------------------------------
    -- 6. Recalculate balance and derive new status
    -- -------------------------------------------------------------------------
    v_new_balance := v_credit.remaining_balance - p_amount;

    IF v_new_balance = 0 THEN
        v_new_status := 'settled';
    ELSE
        v_new_status := 'partially_paid';
    END IF;

    -- -------------------------------------------------------------------------
    -- 7. Update customer_credits
    -- -------------------------------------------------------------------------
    UPDATE public.customer_credits
    SET
        remaining_balance = v_new_balance,
        status            = v_new_status,
        updated_at        = timezone('utc'::text, now())
    WHERE id = p_credit_id;

    -- -------------------------------------------------------------------------
    -- 8. Return summary payload
    -- -------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success',           true,
        'payment_id',        v_payment_id,
        'credit_id',         p_credit_id,
        'amount_paid',       p_amount,
        'payment_method',    p_payment_method,
        'new_remaining_balance', v_new_balance,
        'new_status',        v_new_status,
        'customer_name',     v_credit.customer_name,
        'customer_phone',    v_credit.customer_phone
    );
END;
$$;

-- Grant execution to authenticated users (cashiers & managers calling via Supabase client)
GRANT EXECUTE ON FUNCTION public.record_credit_payment(UUID, NUMERIC, TEXT, UUID, TEXT)
    TO authenticated;

-- =============================================================================
-- Verification query (run manually to confirm deployment):
-- SELECT public.record_credit_payment(
--     '<a valid credit_id UUID>',
--     50.000,
--     'cash',
--     NULL,
--     'Test installment'
-- );
-- =============================================================================

