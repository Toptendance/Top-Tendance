-- =============================================================================
-- supabase_step11_deliveries_rpcs.sql
-- Phase 4.2 — Stock Management on Shipping & Returns
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RPC: create_delivery_order
--   1. Validates recipient and delivery order parameters.
--   2. Verifies stock availability for each item and decrements variants.stock_quantity.
--   3. Logs stock_movements with movement_type = 'delivery_shipment'.
--   4. Inserts into deliveries and delivery_items.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_delivery_order(
    p_recipient_name      TEXT,
    p_recipient_phone     TEXT,
    p_address             TEXT,
    p_city                TEXT,
    p_governorate         TEXT,
    p_items               JSONB,
    p_tracking_number     TEXT DEFAULT NULL,
    p_courier_name        TEXT DEFAULT 'Aramex',
    p_recipient_phone_alt TEXT DEFAULT NULL,
    p_cod_amount          NUMERIC DEFAULT 0.000,
    p_shipping_fee        NUMERIC DEFAULT 7.000,
    p_status              TEXT DEFAULT 'preparing',
    p_payment_status      TEXT DEFAULT 'unpaid',
    p_notes               TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_delivery_id    UUID;
    v_caller_id      UUID;
    v_item           RECORD;
    v_variant_id     UUID;
    v_qty            INT;
    v_unit_price     NUMERIC(12, 3);
    v_product_name   TEXT;
    v_sku            TEXT;
    v_size           TEXT;
    v_color          TEXT;
    v_current_stock  INT;
    v_items_count    INT;
BEGIN
    v_caller_id := auth.uid();

    -- Validate required recipient details
    IF p_recipient_name IS NULL OR trim(p_recipient_name) = '' THEN
        RAISE EXCEPTION 'Le nom du destinataire est obligatoire';
    END IF;

    IF p_recipient_phone IS NULL OR trim(p_recipient_phone) = '' THEN
        RAISE EXCEPTION 'Le numéro de téléphone du destinataire est obligatoire';
    END IF;

    IF p_address IS NULL OR trim(p_address) = '' THEN
        RAISE EXCEPTION 'L''adresse de livraison est obligatoire';
    END IF;

    IF p_city IS NULL OR trim(p_city) = '' THEN
        RAISE EXCEPTION 'La ville de livraison est obligatoire';
    END IF;

    IF p_governorate IS NULL OR trim(p_governorate) = '' THEN
        RAISE EXCEPTION 'Le gouvernorat de livraison est obligatoire';
    END IF;

    -- Validate items array
    v_items_count := jsonb_array_length(p_items);
    IF v_items_count IS NULL OR v_items_count = 0 THEN
        RAISE EXCEPTION 'Le colis ne contient aucun article';
    END IF;

    -- Validate stock for each item before writing
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        variant_id UUID,
        quantity INT,
        unit_price NUMERIC,
        product_name TEXT,
        sku TEXT,
        size TEXT,
        color TEXT
    )
    LOOP
        v_variant_id := v_item.variant_id;
        v_qty := v_item.quantity;

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'L''identifiant de la variante est obligatoire';
        END IF;

        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Quantité invalide pour l''article %', COALESCE(v_item.product_name, v_item.sku, 'inconnu');
        END IF;

        SELECT stock_quantity, sku, size, color INTO v_current_stock, v_sku, v_size, v_color
        FROM public.variants
        WHERE id = v_variant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Article ou variante introuvable (ID: %)', v_variant_id;
        END IF;

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Stock insuffisant pour l''article % (Demandé: %, Disponible: %)',
                COALESCE(v_item.product_name, v_sku), v_qty, v_current_stock;
        END IF;
    END LOOP;

    -- Insert into deliveries
    INSERT INTO public.deliveries (
        tracking_number,
        courier_name,
        recipient_name,
        recipient_phone,
        recipient_phone_alt,
        address,
        city,
        governorate,
        cod_amount,
        shipping_fee,
        status,
        payment_status,
        notes,
        created_by
    ) VALUES (
        nullif(trim(p_tracking_number), ''),
        COALESCE(nullif(trim(p_courier_name), ''), 'Aramex'),
        trim(p_recipient_name),
        trim(p_recipient_phone),
        nullif(trim(p_recipient_phone_alt), ''),
        trim(p_address),
        trim(p_city),
        trim(p_governorate),
        COALESCE(p_cod_amount, 0.000),
        COALESCE(p_shipping_fee, 7.000),
        COALESCE(nullif(trim(p_status), ''), 'preparing'),
        COALESCE(nullif(trim(p_payment_status), ''), 'unpaid'),
        nullif(trim(p_notes), ''),
        v_caller_id
    )
    RETURNING id INTO v_delivery_id;

    -- Decrement stock, log movement, and insert delivery_items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        variant_id UUID,
        quantity INT,
        unit_price NUMERIC,
        product_name TEXT,
        sku TEXT,
        size TEXT,
        color TEXT
    )
    LOOP
        v_variant_id := v_item.variant_id;
        v_qty := v_item.quantity;
        v_unit_price := COALESCE(v_item.unit_price, 0.000);

        IF v_item.product_name IS NOT NULL THEN
            v_product_name := v_item.product_name;
        ELSE
            SELECT p.name INTO v_product_name
            FROM public.variants v
            JOIN public.products p ON v.product_id = p.id
            WHERE v.id = v_variant_id;
        END IF;

        INSERT INTO public.delivery_items (
            delivery_id,
            variant_id,
            product_name,
            sku,
            size,
            color,
            quantity,
            unit_price
        ) VALUES (
            v_delivery_id,
            v_variant_id,
            COALESCE(v_product_name, 'Article'),
            COALESCE(v_item.sku, ''),
            v_item.size,
            v_item.color,
            v_qty,
            v_unit_price
        );

        -- Decrement physical stock
        UPDATE public.variants
        SET stock_quantity = stock_quantity - v_qty
        WHERE id = v_variant_id;

        -- Log stock movement
        INSERT INTO public.stock_movements (
            variant_id,
            quantity_change,
            movement_type,
            reason,
            created_by
        ) VALUES (
            v_variant_id,
            -v_qty,
            'delivery_shipment',
            CONCAT('Expédition livraison #', substring(v_delivery_id::text from 1 for 8), ' - Destinataire: ', trim(p_recipient_name)),
            v_caller_id
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_id', v_delivery_id,
        'recipient_name', trim(p_recipient_name),
        'cod_amount', COALESCE(p_cod_amount, 0.000),
        'status', COALESCE(nullif(trim(p_status), ''), 'preparing'),
        'created_at', now()
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- RPC: process_delivery_return
--   1. Validates delivery exists and has not already been returned.
--   2. Restores variants.stock_quantity for all items in the delivery.
--   3. Logs stock_movements with movement_type = 'delivery_return'.
--   4. Updates deliveries.status = 'returned' and saves return notes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_delivery_return(
    p_delivery_id UUID,
    p_notes       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_delivery public.deliveries%ROWTYPE;
    v_item     RECORD;
    v_caller_id UUID;
    v_items_restored INT := 0;
BEGIN
    v_caller_id := auth.uid();

    SELECT * INTO v_delivery
    FROM public.deliveries
    WHERE id = p_delivery_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Livraison introuvable (ID: %)', p_delivery_id;
    END IF;

    IF v_delivery.status = 'returned' THEN
        RAISE EXCEPTION 'Cette livraison a déjà été marquée comme retournée';
    END IF;

    -- Restore stock and log delivery_return for each delivery item
    FOR v_item IN
        SELECT variant_id, quantity, product_name, sku
        FROM public.delivery_items
        WHERE delivery_id = p_delivery_id
    LOOP
        UPDATE public.variants
        SET stock_quantity = stock_quantity + v_item.quantity
        WHERE id = v_item.variant_id;

        INSERT INTO public.stock_movements (
            variant_id,
            quantity_change,
            movement_type,
            reason,
            created_by
        ) VALUES (
            v_item.variant_id,
            v_item.quantity,
            'delivery_return',
            CONCAT('Retour livraison #', substring(p_delivery_id::text from 1 for 8), ' - ', COALESCE(p_notes, 'Colis retourné')),
            v_caller_id
        );

        v_items_restored := v_items_restored + v_item.quantity;
    END LOOP;

    -- Update delivery status
    UPDATE public.deliveries
    SET
        status = 'returned',
        notes = CASE 
            WHEN notes IS NULL OR notes = '' THEN p_notes
            WHEN p_notes IS NULL OR p_notes = '' THEN notes
            ELSE CONCAT(notes, E'\n[Retour]: ', p_notes)
        END
    WHERE id = p_delivery_id;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_id', p_delivery_id,
        'status', 'returned',
        'items_restored_count', v_items_restored,
        'updated_at', now()
    );
END;
$$;

