-- =============================================================================
-- supabase_step13_create_credit_sale_rpc.sql
-- Phase 1: Database Schema & Atomic RPC create_credit_sale
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ensure Tables Exist
-- -----------------------------------------------------------------------------

-- Customer Credits Table
CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    customer_cin TEXT,
    total_amount NUMERIC(12, 3) NOT NULL CHECK (total_amount >= 0),
    deposit_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (deposit_amount >= 0),
    remaining_balance NUMERIC(12, 3) NOT NULL CHECK (remaining_balance >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'partially_paid', 'settled', 'cancelled')),
    due_date DATE,
    notes TEXT,
    cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_credits_phone ON public.customer_credits(customer_phone);
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.customer_credits(status);

-- Credit Items Table
CREATE TABLE IF NOT EXISTS public.credit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id UUID NOT NULL REFERENCES public.customer_credits(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    size TEXT,
    color TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 3) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_items_credit_id ON public.credit_items(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_items_variant_id ON public.credit_items(variant_id);

-- Credit Payments Table (tracks repayment installments and initial deposits)
CREATE TABLE IF NOT EXISTS public.credit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id UUID NOT NULL REFERENCES public.customer_credits(id) ON DELETE CASCADE,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card')),
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_id ON public.credit_payments(credit_id);

-- -----------------------------------------------------------------------------
-- 2. Ensure stock_movements supports 'credit_sale'
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
    ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
        CHECK (movement_type IN ('sale', 'restock', 'return', 'adjustment', 'delivery_shipment', 'delivery_return', 'credit_sale'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Atomic RPC Function: create_credit_sale
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_credit_sale(
    p_customer_name   TEXT,
    p_customer_phone  TEXT,
    p_items           JSONB,
    p_deposit_amount  NUMERIC DEFAULT 0.000,
    p_deposit_method  TEXT DEFAULT NULL,
    p_due_date        DATE DEFAULT NULL,
    p_notes           TEXT DEFAULT NULL,
    p_cashier_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit_id        UUID;
    v_cashier_uuid     UUID;
    v_item             RECORD;
    v_variant_id       UUID;
    v_qty              INT;
    v_unit_price       NUMERIC(12, 3);
    v_subtotal         NUMERIC(12, 3);
    v_product_name     TEXT;
    v_sku              TEXT;
    v_size             TEXT;
    v_color            TEXT;
    v_current_stock    INT;
    v_total_amount     NUMERIC(12, 3) := 0.000;
    v_deposit_amount   NUMERIC(12, 3);
    v_remaining_balance NUMERIC(12, 3);
    v_status           TEXT;
    v_items_count      INT;
BEGIN
    -- 1. Identify cashier ID (passed parameter or auth.uid())
    v_cashier_uuid := COALESCE(p_cashier_id, auth.uid());

    -- 2. Validate customer information
    IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
        RAISE EXCEPTION 'Le nom du client est obligatoire';
    END IF;

    IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
        RAISE EXCEPTION 'Le numéro de téléphone du client est obligatoire';
    END IF;

    -- 3. Validate items payload
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'La liste des articles est invalide';
    END IF;

    v_items_count := jsonb_array_length(p_items);
    IF v_items_count = 0 THEN
        RAISE EXCEPTION 'Le panier de vente à crédit ne peut pas être vide';
    END IF;

    -- 4. Calculate total amount & validate items
    FOR v_item IN
        SELECT
            (elem->>'variant_id')::UUID AS variant_id,
            (elem->>'quantity')::INT AS quantity,
            (elem->>'unit_price')::NUMERIC(12, 3) AS unit_price
        FROM jsonb_array_elements(p_items) AS elem
    LOOP
        IF v_item.variant_id IS NULL THEN
            RAISE EXCEPTION 'Identifiant de variante manquant dans le panier';
        END IF;

        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantité invalide pour l article: %', v_item.variant_id;
        END IF;

        IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
            RAISE EXCEPTION 'Prix unitaire invalide pour la variante: %', v_item.variant_id;
        END IF;

        v_total_amount := v_total_amount + (v_item.unit_price * v_item.quantity);
    END LOOP;

    -- 5. Validate deposit and deposit method
    v_deposit_amount := COALESCE(p_deposit_amount, 0.000);
    IF v_deposit_amount < 0 THEN
        RAISE EXCEPTION 'Le montant de l acompte ne peut pas être négatif';
    END IF;

    IF v_deposit_amount > v_total_amount THEN
        RAISE EXCEPTION 'L acompte (%.3f DT) ne peut pas dépasser le montant total (%.3f DT)', v_deposit_amount, v_total_amount;
    END IF;

    IF v_deposit_amount > 0 THEN
        IF p_deposit_method IS NULL OR p_deposit_method NOT IN ('cash', 'card') THEN
            RAISE EXCEPTION 'Veuillez préciser le mode de règlement de l acompte (espèces ou carte)';
        END IF;
    END IF;

    -- 6. Compute remaining balance and status
    v_remaining_balance := v_total_amount - v_deposit_amount;

    IF v_remaining_balance = 0 THEN
        v_status := 'settled';
    ELSIF v_deposit_amount > 0 THEN
        v_status := 'partially_paid';
    ELSE
        v_status := 'pending';
    END IF;

    -- 7. Insert into customer_credits
    INSERT INTO public.customer_credits (
        customer_name,
        customer_phone,
        total_amount,
        deposit_amount,
        remaining_balance,
        status,
        due_date,
        notes,
        cashier_id
    ) VALUES (
        trim(p_customer_name),
        trim(p_customer_phone),
        v_total_amount,
        v_deposit_amount,
        v_remaining_balance,
        v_status,
        p_due_date,
        nullif(trim(p_notes), ''),
        v_cashier_uuid
    ) RETURNING id INTO v_credit_id;

    -- 8. Loop items: Lock variant, check stock, insert credit_items, deduct stock, log movement
    FOR v_item IN
        SELECT
            (elem->>'variant_id')::UUID AS variant_id,
            (elem->>'quantity')::INT AS quantity,
            (elem->>'unit_price')::NUMERIC(12, 3) AS unit_price,
            COALESCE(elem->>'product_name', 'Article') AS product_name,
            COALESCE(elem->>'sku', 'N/A') AS sku,
            elem->>'size' AS size,
            elem->>'color' AS color
        FROM jsonb_array_elements(p_items) AS elem
    LOOP
        v_variant_id   := v_item.variant_id;
        v_qty          := v_item.quantity;
        v_unit_price   := v_item.unit_price;
        v_subtotal     := v_unit_price * v_qty;
        v_product_name := trim(v_item.product_name);
        v_sku          := trim(v_item.sku);
        v_size         := nullif(trim(v_item.size), '');
        v_color        := nullif(trim(v_item.color), '');

        -- Lock variant row and check stock
        SELECT stock_quantity INTO v_current_stock
        FROM public.variants
        WHERE id = v_variant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Variante non trouvée pour l article (ID: %)', v_variant_id;
        END IF;

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Stock insuffisant pour % (SKU: %). Demandé: %, En stock: %',
                v_product_name, v_sku, v_qty, v_current_stock;
        END IF;

        -- Insert credit line item
        INSERT INTO public.credit_items (
            credit_id,
            variant_id,
            product_name,
            sku,
            size,
            color,
            quantity,
            unit_price,
            subtotal
        ) VALUES (
            v_credit_id,
            v_variant_id,
            v_product_name,
            v_sku,
            v_size,
            v_color,
            v_qty,
            v_unit_price,
            v_subtotal
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
            'credit_sale',
            CONCAT('Vente à crédit #', substring(v_credit_id::text from 1 for 8), ' - Client: ', trim(p_customer_name)),
            v_cashier_uuid
        );
    END LOOP;

    -- 9. Record initial deposit payment if > 0
    IF v_deposit_amount > 0 THEN
        INSERT INTO public.credit_payments (
            credit_id,
            amount,
            payment_method,
            received_by,
            notes
        ) VALUES (
            v_credit_id,
            v_deposit_amount,
            p_deposit_method,
            v_cashier_uuid,
            'Acompte initial versé à la vente'
        );
    END IF;

    -- 10. Return confirmation JSON
    RETURN jsonb_build_object(
        'success', true,
        'credit_id', v_credit_id,
        'customer_name', trim(p_customer_name),
        'customer_phone', trim(p_customer_phone),
        'total_amount', v_total_amount,
        'deposit_amount', v_deposit_amount,
        'remaining_balance', v_remaining_balance,
        'status', v_status,
        'created_at', now()
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Permissions & Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_credit_sale TO authenticated, service_role;

