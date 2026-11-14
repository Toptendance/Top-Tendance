-- =============================================================================
-- supabase_step14_credit_return_rpc.sql
-- Phase 2: Gestion Métier des Retours pour Articles à Crédit
-- -----------------------------------------------------------------------------
-- Business rules enforced by this migration:
--   * Returning an article from an unpaid credit NEVER writes to `returns`,
--     `return_items` or `credit_payments` -> the daily cash register is untouched.
--   * The article value is deducted from `customer_credits.remaining_balance`
--     (capped at zero). If the debt reaches zero the credit becomes 'settled'.
--   * The article quantity is restored to `variants.stock_quantity`.
--   * A `stock_movements` row is logged with movement_type = 'credit_return'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Track how many units of each credit line have already been returned
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'credit_items'
          AND column_name = 'returned_quantity'
    ) THEN
        ALTER TABLE public.credit_items
            ADD COLUMN returned_quantity INT NOT NULL DEFAULT 0;
    END IF;
END $$;

ALTER TABLE public.credit_items
    DROP CONSTRAINT IF EXISTS credit_items_returned_quantity_check;

ALTER TABLE public.credit_items
    ADD CONSTRAINT credit_items_returned_quantity_check
    CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

-- -----------------------------------------------------------------------------
-- 2. Allow the 'credit_return' stock movement type
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE public.stock_movements
        DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

    ALTER TABLE public.stock_movements
        ADD CONSTRAINT stock_movements_movement_type_check
        CHECK (movement_type IN (
            'sale',
            'restock',
            'return',
            'adjustment',
            'delivery_shipment',
            'delivery_return',
            'credit_sale',
            'credit_return'
        ));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Atomic RPC: return_credit_item
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_credit_item(
    p_credit_item_id UUID,
    p_quantity       INT DEFAULT 1,
    p_returned_by    UUID DEFAULT NULL,
    p_reason         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item             public.credit_items%ROWTYPE;
    v_credit           public.customer_credits%ROWTYPE;
    v_actor            UUID;
    v_returnable       INT;
    v_return_value     NUMERIC(12, 3);
    v_new_balance      NUMERIC(12, 3);
    v_new_status       TEXT;
    v_current_stock    INT;
BEGIN
    v_actor := COALESCE(p_returned_by, auth.uid());

    -- 1. Validate quantity
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La quantité retournée doit être supérieure à zéro';
    END IF;

    -- 2. Lock the credit line
    SELECT * INTO v_item
    FROM public.credit_items
    WHERE id = p_credit_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Article de crédit introuvable (id: %)', p_credit_item_id;
    END IF;

    -- 3. Lock the parent credit
    SELECT * INTO v_credit
    FROM public.customer_credits
    WHERE id = v_item.credit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédit introuvable pour cet article (id: %)', v_item.credit_id;
    END IF;

    IF v_credit.status = 'cancelled' THEN
        RAISE EXCEPTION 'Impossible de retourner un article d''un crédit annulé';
    END IF;

    IF v_credit.status = 'settled' OR v_credit.remaining_balance <= 0 THEN
        RAISE EXCEPTION 'Ce crédit est déjà soldé. Aucun retour à crédit possible';
    END IF;

    -- 4. Check remaining returnable quantity
    v_returnable := v_item.quantity - COALESCE(v_item.returned_quantity, 0);

    IF v_returnable <= 0 THEN
        RAISE EXCEPTION 'Cet article a déjà été retourné intégralement';
    END IF;

    IF p_quantity > v_returnable THEN
        RAISE EXCEPTION 'Quantité à retourner (%) supérieure à la quantité restante (%)',
            p_quantity, v_returnable;
    END IF;

    v_return_value := v_item.unit_price * p_quantity;

    -- 5. Lock variant + restore physical stock
    SELECT stock_quantity INTO v_current_stock
    FROM public.variants
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante introuvable (id: %)', v_item.variant_id;
    END IF;

    UPDATE public.variants
    SET stock_quantity = stock_quantity + p_quantity
    WHERE id = v_item.variant_id;

    -- 6. Journal the stock movement (NO cash / returns impact)
    INSERT INTO public.stock_movements (
        variant_id,
        quantity_change,
        movement_type,
        reason,
        created_by
    ) VALUES (
        v_item.variant_id,
        p_quantity,
        'credit_return',
        CONCAT(
            'Retour article à crédit #',
            substring(v_credit.id::text from 1 for 8),
            ' - ',
            v_item.product_name,
            CASE
                WHEN p_reason IS NOT NULL AND trim(p_reason) <> ''
                    THEN ' - ' || trim(p_reason)
                ELSE ''
            END
        ),
        v_actor
    );

    -- 7. Mark the line as (partially) returned
    UPDATE public.credit_items
    SET returned_quantity = COALESCE(returned_quantity, 0) + p_quantity
    WHERE id = p_credit_item_id;

    -- 8. Reduce the outstanding debt (never below zero)
    v_new_balance := GREATEST(0::NUMERIC, v_credit.remaining_balance - v_return_value);

    IF v_new_balance = 0 THEN
        v_new_status := 'settled';
    ELSIF v_credit.status = 'partially_paid' THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := 'pending';
    END IF;

    UPDATE public.customer_credits
    SET remaining_balance = v_new_balance,
        status            = v_new_status,
        updated_at        = timezone('utc'::text, now())
    WHERE id = v_credit.id;

    RETURN jsonb_build_object(
        'success',               true,
        'credit_item_id',        p_credit_item_id,
        'credit_id',             v_credit.id,
        'variant_id',            v_item.variant_id,
        'product_name',          v_item.product_name,
        'quantity_returned',     p_quantity,
        'return_value',          v_return_value,
        'new_remaining_balance', v_new_balance,
        'new_status',            v_new_status,
        'customer_name',         v_credit.customer_name,
        'customer_phone',        v_credit.customer_phone
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Permissions
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.return_credit_item(UUID, INT, UUID, TEXT)
    TO authenticated, service_role;

-- =============================================================================
-- Verification query (run manually to confirm deployment):
-- SELECT public.return_credit_item('<credit_item_id>'::uuid, 1, NULL, 'Test');
-- =============================================================================
