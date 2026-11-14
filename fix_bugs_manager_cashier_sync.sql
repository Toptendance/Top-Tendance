-- ============================================================
-- FIX: Manager ↔ Cashier Sync Bugs
-- Top Tendance POS
-- Date: 2026-11-14
-- ============================================================
-- BUG 1: Cashier cannot see sales made by manager in POS
--         → RLS on "sales" uses cashier_id = auth.uid() for cashiers,
--           so manager sales (cashier_id = manager_id) are invisible to cashier.
--         FIX: Allow ALL authenticated users to SELECT any sale (they already share
--              the same DB; the manager and cashier are both authenticated).
--              OR: change the select policy to allow all authenticated users to read all sales.
-- BUG 2 & 3: ReturnExchangeModal says "déjà retourné" for manager sales &
--            allows returning the same item multiple times
--         → process_return_exchange checks v_item.quantity > v_sale_item.quantity
--           but NEVER checks how many items were already returned.
--           The cashier can keep returning the same sale_item up to sold qty each time.
--         FIX: Add a SUM(quantity) check on return_items for each sale_item_id
--              before accepting each partial return.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- FIX 1: RLS — Sales visibility for cashiers
-- Allow cashiers to see ALL sales (not just their own)
-- so that a manager sale can be searched + returned at the POS.
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;

CREATE POLICY "sales_select_policy" ON public.sales
    FOR SELECT TO authenticated
    USING (true);   -- any authenticated user (cashier OR manager) can read any sale

-- Also fix sale_items so cashiers can read items of ANY sale (needed for return lookup)
DROP POLICY IF EXISTS "sale_items_select_policy" ON public.sale_items;

CREATE POLICY "sale_items_select_policy" ON public.sale_items
    FOR SELECT TO authenticated
    USING (true);   -- matches sales policy above

-- Also fix return_items / returns so cashiers can see returns of manager sales
DROP POLICY IF EXISTS "returns_select_policy" ON public.returns;

CREATE POLICY "returns_select_policy" ON public.returns
    FOR SELECT TO authenticated
    USING (true);   -- any cashier needs to know what was already returned

DROP POLICY IF EXISTS "return_items_select_policy" ON public.return_items;

CREATE POLICY "return_items_select_policy" ON public.return_items
    FOR SELECT TO authenticated
    USING (true);


-- ════════════════════════════════════════════════════════════
-- FIX 2 & 3: process_return_exchange — prevent double returns
-- Add a check: already_returned_qty + new qty must not exceed sold qty
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_return_exchange(
    p_original_sale_id UUID,
    p_returned_items JSONB,
    p_return_type TEXT,
    p_refund_method TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cashier_id UUID;
    v_sale RECORD;
    v_item RECORD;
    v_sale_item RECORD;
    v_return_id UUID;
    v_total_refund NUMERIC(12, 3) := 0.000;
    v_processed_items JSONB := '[]'::JSONB;
    v_already_returned_qty INT := 0;   -- ← NEW: track prior returns per item
BEGIN
    -- Check Caller
    v_cashier_id := auth.uid();
    IF v_cashier_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    -- Validate parameters
    IF p_return_type NOT IN ('refund', 'exchange') THEN
        RAISE EXCEPTION 'Invalid return type: %. Must be refund or exchange.', p_return_type;
    END IF;

    IF p_refund_method NOT IN ('cash', 'card', 'store_credit') THEN
        RAISE EXCEPTION 'Invalid refund method: %. Must be cash, card, or store_credit.', p_refund_method;
    END IF;

    IF p_returned_items IS NULL OR jsonb_array_length(p_returned_items) = 0 THEN
        RAISE EXCEPTION 'Returned items cannot be empty';
    END IF;

    -- Check original sale
    SELECT id, final_amount, created_at
    INTO v_sale
    FROM public.sales
    WHERE id = p_original_sale_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original sale #% not found', p_original_sale_id;
    END IF;

    -- Create Return record
    INSERT INTO public.returns (
        original_sale_id,
        cashier_id,
        return_type,
        total_refunded_amount,
        refund_payment_method,
        reason
    )
    VALUES (
        p_original_sale_id,
        v_cashier_id,
        p_return_type,
        0.000,
        p_refund_method,
        p_reason
    )
    RETURNING id INTO v_return_id;

    -- Process each returned item
    FOR v_item IN
        SELECT
            (item->>'sale_item_id')::UUID AS sale_item_id,
            (item->>'variant_id')::UUID AS variant_id,
            (item->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_returned_items) AS item
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Returned quantity must be greater than zero';
        END IF;

        -- Verify sale_item belongs to this sale
        SELECT id, variant_id, quantity, unit_price
        INTO v_sale_item
        FROM public.sale_items
        WHERE id = v_item.sale_item_id AND sale_id = p_original_sale_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Sale item % does not belong to sale %', v_item.sale_item_id, p_original_sale_id;
        END IF;

        -- ── FIX: compute how many units were already returned for this sale_item ──
        SELECT COALESCE(SUM(ri.quantity), 0)
        INTO v_already_returned_qty
        FROM public.return_items ri
        WHERE ri.sale_item_id = v_item.sale_item_id;

        IF (v_already_returned_qty + v_item.quantity) > v_sale_item.quantity THEN
            RAISE EXCEPTION
                'Cannot return % unit(s) of sale item %: already returned %, original quantity was %. '
                'Maximum additional returnable: %.',
                v_item.quantity,
                v_item.sale_item_id,
                v_already_returned_qty,
                v_sale_item.quantity,
                (v_sale_item.quantity - v_already_returned_qty);
        END IF;
        -- ────────────────────────────────────────────────────────────────────────────

        -- Subtotal for this return item
        v_total_refund := v_total_refund + (v_sale_item.unit_price * v_item.quantity);

        -- Record return item
        INSERT INTO public.return_items (
            return_id,
            sale_item_id,
            variant_id,
            quantity,
            unit_price,
            subtotal
        )
        VALUES (
            v_return_id,
            v_item.sale_item_id,
            v_item.variant_id,
            v_item.quantity,
            v_sale_item.unit_price,
            v_sale_item.unit_price * v_item.quantity
        );

        -- Restore stock quantity back to variant
        UPDATE public.variants
        SET stock_quantity = stock_quantity + v_item.quantity
        WHERE id = v_item.variant_id;

        -- Audit stock movement
        INSERT INTO public.stock_movements (
            variant_id,
            quantity_change,
            movement_type,
            reason,
            created_by
        )
        VALUES (
            v_item.variant_id,
            v_item.quantity,
            'return',
            'Return / Exchange #' || v_return_id::text || ' for Sale #' || p_original_sale_id::text,
            v_cashier_id
        );

        v_processed_items := v_processed_items || jsonb_build_object(
            'variant_id', v_item.variant_id,
            'quantity', v_item.quantity,
            'unit_price', v_sale_item.unit_price
        );
    END LOOP;

    -- Update return total
    UPDATE public.returns
    SET total_refunded_amount = v_total_refund
    WHERE id = v_return_id;

    RETURN jsonb_build_object(
        'return_id', v_return_id,
        'original_sale_id', p_original_sale_id,
        'total_refunded_amount', v_total_refund,
        'refund_payment_method', p_refund_method,
        'return_type', p_return_type,
        'items', v_processed_items,
        'created_at', now()
    );
END;
$$;
