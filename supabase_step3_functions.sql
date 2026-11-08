-- Step 3: Core Transaction Logic (Postgres Functions / RPC)
-- Top Tendance POS & Inventory

-- 1. complete_sale RPC
CREATE OR REPLACE FUNCTION public.complete_sale(
    p_items JSONB,
    p_payment_method TEXT,
    p_discount NUMERIC(12, 3) DEFAULT 0.000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cashier_id UUID;
    v_cashier_profile RECORD;
    v_item RECORD;
    v_variant RECORD;
    v_cost_price NUMERIC(12, 3);
    v_total_amount NUMERIC(12, 3) := 0.000;
    v_final_amount NUMERIC(12, 3) := 0.000;
    v_discount NUMERIC(12, 3) := COALESCE(p_discount, 0.000);
    v_sale_id UUID;
    v_sale_items JSONB := '[]'::JSONB;
    v_variant_ids UUID[];
BEGIN
    -- 1. Identity & Profile Check
    v_cashier_id := auth.uid();
    IF v_cashier_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, full_name, role INTO v_cashier_profile
    FROM public.profiles
    WHERE id = v_cashier_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Forbidden: No active profile found for authenticated user %', v_cashier_id;
    END IF;

    -- Validate payment method
    IF p_payment_method NOT IN ('cash', 'card', 'split') THEN
        RAISE EXCEPTION 'Invalid payment method: %. Must be cash, card, or split.', p_payment_method;
    END IF;

    -- Validate items array
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot complete sale with empty items list';
    END IF;

    IF v_discount < 0 THEN
        RAISE EXCEPTION 'Discount cannot be negative';
    END IF;

    -- 2. Extract variant IDs and acquire pessimistic row locks (FOR UPDATE)
    SELECT array_agg((item->>'variant_id')::UUID)
    INTO v_variant_ids
    FROM jsonb_array_elements(p_items) AS item;

    PERFORM 1
    FROM public.variants
    WHERE id = ANY(v_variant_ids)
    FOR UPDATE;

    -- 3. Validate stock availability, retrieve prices, and compute totals
    FOR v_item IN
        SELECT 
            (item->>'variant_id')::UUID AS variant_id,
            (item->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS item
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than zero';
        END IF;

        SELECT id, selling_price, stock_quantity, sku, is_active
        INTO v_variant
        FROM public.variants
        WHERE id = v_item.variant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Variant not found: %', v_item.variant_id;
        END IF;

        IF NOT v_variant.is_active THEN
            RAISE EXCEPTION 'Variant % (SKU: %) is inactive and cannot be sold', v_variant.id, v_variant.sku;
        END IF;

        IF v_variant.stock_quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for SKU %: requested %, available %', 
                v_variant.sku, v_item.quantity, v_variant.stock_quantity;
        END IF;

        -- Subtotal calculation
        v_total_amount := v_total_amount + (v_variant.selling_price * v_item.quantity);
    END LOOP;

    -- Calculate final amount
    IF v_discount > v_total_amount THEN
        RAISE EXCEPTION 'Discount amount (%) exceeds total amount (%)', v_discount, v_total_amount;
    END IF;
    v_final_amount := v_total_amount - v_discount;

    -- 4. Insert into sales
    INSERT INTO public.sales (
        cashier_id,
        total_amount,
        discount_amount,
        final_amount,
        payment_method
    )
    VALUES (
        v_cashier_id,
        v_total_amount,
        v_discount,
        v_final_amount,
        p_payment_method
    )
    RETURNING id INTO v_sale_id;

    -- 5. Process each sale item, variant stock decrement, and stock movement
    FOR v_item IN
        SELECT 
            (item->>'variant_id')::UUID AS variant_id,
            (item->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS item
    LOOP
        SELECT id, selling_price, sku INTO v_variant
        FROM public.variants
        WHERE id = v_item.variant_id;

        -- Fetch unit cost from variant_costs (snapshot)
        SELECT COALESCE(cost_price, 0.000) INTO v_cost_price
        FROM public.variant_costs
        WHERE variant_id = v_item.variant_id;

        IF v_cost_price IS NULL THEN
            v_cost_price := 0.000;
        END IF;

        -- Insert into sale_items
        INSERT INTO public.sale_items (
            sale_id,
            variant_id,
            quantity,
            unit_price,
            unit_cost,
            subtotal
        )
        VALUES (
            v_sale_id,
            v_item.variant_id,
            v_item.quantity,
            v_variant.selling_price,
            v_cost_price,
            v_variant.selling_price * v_item.quantity
        );

        -- Decrement stock quantity
        UPDATE public.variants
        SET stock_quantity = stock_quantity - v_item.quantity
        WHERE id = v_item.variant_id;

        -- Insert audit row into stock_movements
        INSERT INTO public.stock_movements (
            variant_id,
            quantity_change,
            movement_type,
            reason,
            created_by
        )
        VALUES (
            v_item.variant_id,
            -v_item.quantity,
            'sale',
            'Sale #' || v_sale_id::text,
            v_cashier_id
        );

        -- Accumulate receipt item detail
        v_sale_items := v_sale_items || jsonb_build_object(
            'variant_id', v_item.variant_id,
            'sku', v_variant.sku,
            'quantity', v_item.quantity,
            'unit_price', v_variant.selling_price,
            'subtotal', v_variant.selling_price * v_item.quantity
        );
    END LOOP;

    -- 6. Return receipt details
    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'cashier_id', v_cashier_id,
        'cashier_name', v_cashier_profile.full_name,
        'total_amount', v_total_amount,
        'discount_amount', v_discount,
        'final_amount', v_final_amount,
        'payment_method', p_payment_method,
        'items', v_sale_items,
        'created_at', timezone('utc'::text, now())
    );
END;
$$;


-- 2. receive_stock RPC
CREATE OR REPLACE FUNCTION public.receive_stock(
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_item RECORD;
    v_processed_count INT := 0;
BEGIN
    -- Enforce manager role
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, role INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.role != 'manager' THEN
        RAISE EXCEPTION 'Forbidden: Only managers can receive stock';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No stock items provided to receive';
    END IF;

    FOR v_item IN
        SELECT 
            (item->>'variant_id')::UUID AS variant_id,
            (item->>'quantity')::INT AS quantity,
            (item->>'cost_price')::NUMERIC(12, 3) AS cost_price,
            item->>'reason' AS reason
        FROM jsonb_array_elements(p_items) AS item
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Received quantity must be positive';
        END IF;

        -- Update variant stock quantity
        UPDATE public.variants
        SET stock_quantity = stock_quantity + v_item.quantity
        WHERE id = v_item.variant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Variant not found: %', v_item.variant_id;
        END IF;

        -- Upsert variant cost if provided
        IF v_item.cost_price IS NOT NULL THEN
            IF v_item.cost_price < 0 THEN
                RAISE EXCEPTION 'Cost price cannot be negative';
            END IF;

            INSERT INTO public.variant_costs (
                variant_id,
                cost_price,
                updated_at,
                updated_by
            )
            VALUES (
                v_item.variant_id,
                v_item.cost_price,
                timezone('utc'::text, now()),
                v_user_id
            )
            ON CONFLICT (variant_id) DO UPDATE
            SET 
                cost_price = EXCLUDED.cost_price,
                updated_at = timezone('utc'::text, now()),
                updated_by = v_user_id;
        END IF;

        -- Insert audit row into stock_movements
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
            'restock',
            COALESCE(v_item.reason, 'Restock shipment received'),
            v_user_id
        );

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'received_items_count', v_processed_count,
        'received_by', v_user_id
    );
END;
$$;


-- 3. process_return RPC
CREATE OR REPLACE FUNCTION public.process_return(
    p_sale_item_id UUID,
    p_quantity INT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_sale_item RECORD;
    v_already_returned_qty INT := 0;
BEGIN
    -- Enforce manager role
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, role INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.role != 'manager' THEN
        RAISE EXCEPTION 'Forbidden: Only managers can process returns';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Return quantity must be positive';
    END IF;

    -- Fetch original sale_item
    SELECT id, sale_id, variant_id, quantity, unit_price
    INTO v_sale_item
    FROM public.sale_items
    WHERE id = p_sale_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale item not found: %', p_sale_item_id;
    END IF;

    -- Validate return quantity against previous returns for this sale item
    SELECT COALESCE(SUM(quantity_change), 0) INTO v_already_returned_qty
    FROM public.stock_movements
    WHERE movement_type = 'return'
      AND reason LIKE 'Return for sale item ' || p_sale_item_id::text || '%';

    IF (v_already_returned_qty + p_quantity) > v_sale_item.quantity THEN
        RAISE EXCEPTION 'Cannot return % units: already returned %, original sale item quantity was %',
            p_quantity, v_already_returned_qty, v_sale_item.quantity;
    END IF;

    -- Increment variant stock quantity
    UPDATE public.variants
    SET stock_quantity = stock_quantity + p_quantity
    WHERE id = v_sale_item.variant_id;

    -- Insert audit row into stock_movements
    INSERT INTO public.stock_movements (
        variant_id,
        quantity_change,
        movement_type,
        reason,
        created_by
    )
    VALUES (
        v_sale_item.variant_id,
        p_quantity,
        'return',
        'Return for sale item ' || p_sale_item_id::text || ': ' || COALESCE(p_reason, 'Customer return'),
        v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_item_id', p_sale_item_id,
        'variant_id', v_sale_item.variant_id,
        'returned_quantity', p_quantity,
        'refund_amount', v_sale_item.unit_price * p_quantity,
        'processed_by', v_user_id
    );
END;
$$;

