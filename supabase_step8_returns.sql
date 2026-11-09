-- Step 8: Return, Cancellation & Exchange System
-- Top Tendance POS & Inventory

-- 1. Returns Table
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    return_type TEXT NOT NULL CHECK (return_type IN ('refund', 'exchange')),
    total_refunded_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_refunded_amount >= 0),
    refund_payment_method TEXT NOT NULL CHECK (refund_payment_method IN ('cash', 'card', 'store_credit')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_returns_original_sale_id ON public.returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns(created_at);

-- 2. Return Items Table
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 3) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_variant_id ON public.return_items(variant_id);

-- 3. Enable RLS on Returns and Return Items
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "returns_select_policy" ON public.returns
    FOR SELECT TO authenticated
    USING (cashier_id = auth.uid() OR public.is_manager());

CREATE POLICY "returns_insert_policy" ON public.returns
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "return_items_select_policy" ON public.return_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.returns r
            WHERE r.id = return_items.return_id
              AND (r.cashier_id = auth.uid() OR public.is_manager())
        )
    );

CREATE POLICY "return_items_insert_policy" ON public.return_items
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Process Return & Exchange RPC
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

        -- Verify sale_item
        SELECT id, variant_id, quantity, unit_price
        INTO v_sale_item
        FROM public.sale_items
        WHERE id = v_item.sale_item_id AND sale_id = p_original_sale_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Sale item % does not belong to sale %', v_item.sale_item_id, p_original_sale_id;
        END IF;

        IF v_item.quantity > v_sale_item.quantity THEN
            RAISE EXCEPTION 'Return quantity (%) exceeds sold quantity (%)', v_item.quantity, v_sale_item.quantity;
        END IF;

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

