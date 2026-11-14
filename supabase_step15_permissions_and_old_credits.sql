-- =============================================================================
-- supabase_step15_permissions_and_old_credits.sql
-- Phase 1 & Phase 6: Database & Backend RPC Updates for Cashier Permissions,
-- Historic Credits, and Data Confidentiality (Managers vs Cashiers)
-- =============================================================================

-- 1. Helper function is_staff() (ensures cashier and manager roles are recognized)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('cashier', 'manager')
    );
$$;

-- 2. Update get_sales_analytics RPC:
-- Accessible to both 'manager' and 'cashier'.
-- For cashiers: sensitive cost/profit metrics (total_cost, net_profit) are strictly masked (0 / null)
-- to protect business confidentiality while giving full visibility on turnover and sales volume.
CREATE OR REPLACE FUNCTION public.get_sales_analytics(
    p_start_date TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_gross_revenue NUMERIC(12, 3) := 0.000;
    v_total_cost NUMERIC(12, 3) := 0.000;
    v_net_profit NUMERIC(12, 3) := 0.000;
    v_sales_count INT := 0;
    v_payment_breakdown JSONB;
    v_best_sellers JSONB;
BEGIN
    -- Enforce staff role (cashier or manager)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, role INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.role NOT IN ('manager', 'cashier') THEN
        RAISE EXCEPTION 'Forbidden: Only managers and cashiers can view analytics';
    END IF;

    -- Aggregate sales revenue
    SELECT 
        COALESCE(SUM(final_amount), 0.000),
        COUNT(id)
    INTO 
        v_gross_revenue,
        v_sales_count
    FROM public.sales
    WHERE created_at BETWEEN p_start_date AND p_end_date;

    -- Only compute cost and net profit if manager
    IF v_profile.role = 'manager' THEN
        SELECT 
            COALESCE(SUM(si.unit_cost * si.quantity), 0.000)
        INTO 
            v_total_cost
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE s.created_at BETWEEN p_start_date AND p_end_date;

        v_net_profit := v_gross_revenue - v_total_cost;
    ELSE
        -- Cashier: masked
        v_total_cost := 0.000;
        v_net_profit := 0.000;
    END IF;

    -- Payment method breakdown
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'method', payment_method,
                'count', cnt,
                'total', sm
            )
        ), '[]'::JSONB)
    INTO v_payment_breakdown
    FROM (
        SELECT 
            payment_method, 
            COUNT(id) as cnt, 
            SUM(final_amount) as sm
        FROM public.sales
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY payment_method
    ) p;

    -- Best sellers
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'sku', v.sku,
                'variant_id', si.variant_id,
                'quantity_sold', sum_qty,
                'revenue', sum_rev
            )
        ), '[]'::JSONB)
    INTO v_best_sellers
    FROM (
        SELECT 
            si.variant_id,
            SUM(si.quantity) as sum_qty,
            SUM(si.subtotal) as sum_rev
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE s.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY si.variant_id
        ORDER BY sum_qty DESC
        LIMIT 10
    ) si
    JOIN public.variants v ON v.id = si.variant_id;

    RETURN jsonb_build_object(
        'gross_revenue', v_gross_revenue,
        'total_cost', CASE WHEN v_profile.role = 'manager' THEN to_jsonb(v_total_cost) ELSE 'null'::JSONB END,
        'net_profit', CASE WHEN v_profile.role = 'manager' THEN to_jsonb(v_net_profit) ELSE 'null'::JSONB END,
        'sales_count', v_sales_count,
        'payment_breakdown', v_payment_breakdown,
        'best_sellers', v_best_sellers
    );
END;
$$;


-- 3. Update get_stock_valuation RPC:
-- Accessible to staff (cashier & manager).
-- For cashiers: stock valuation at cost and profit margin percentage are masked (null).
CREATE OR REPLACE FUNCTION public.get_stock_valuation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_total_inventory_cost NUMERIC(12, 3) := 0.000;
    v_total_inventory_retail NUMERIC(12, 3) := 0.000;
    v_total_stock_units INT := 0;
BEGIN
    -- Enforce staff role (cashier or manager)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, role INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.role NOT IN ('manager', 'cashier') THEN
        RAISE EXCEPTION 'Forbidden: Only managers and cashiers can view stock valuation';
    END IF;

    IF v_profile.role = 'manager' THEN
        SELECT 
            COALESCE(SUM(v.stock_quantity * COALESCE(vc.cost_price, 0.000)), 0.000),
            COALESCE(SUM(v.stock_quantity * v.selling_price), 0.000),
            COALESCE(SUM(v.stock_quantity), 0)
        INTO 
            v_total_inventory_cost,
            v_total_inventory_retail,
            v_total_stock_units
        FROM public.variants v
        LEFT JOIN public.variant_costs vc ON vc.variant_id = v.id
        WHERE v.is_active = true;

        RETURN jsonb_build_object(
            'total_stock_valuation_cost', v_total_inventory_cost,
            'total_stock_valuation_retail', v_total_inventory_retail,
            'total_stock_units', v_total_stock_units,
            'estimated_margin_percent', 
                CASE 
                    WHEN v_total_inventory_retail > 0 
                    THEN ROUND(((v_total_inventory_retail - v_total_inventory_cost) / v_total_inventory_retail) * 100, 2)
                    ELSE 0.00 
                END
        );
    ELSE
        -- Cashier: Only retail valuation and stock units (no cost price or margin percent)
        SELECT 
            COALESCE(SUM(v.stock_quantity * v.selling_price), 0.000),
            COALESCE(SUM(v.stock_quantity), 0)
        INTO 
            v_total_inventory_retail,
            v_total_stock_units
        FROM public.variants v
        WHERE v.is_active = true;

        RETURN jsonb_build_object(
            'total_stock_valuation_cost', 'null'::JSONB,
            'total_stock_valuation_retail', v_total_inventory_retail,
            'total_stock_units', v_total_stock_units,
            'estimated_margin_percent', 'null'::JSONB
        );
    END IF;
END;
$$;


-- 4. Verify and Ensure RLS Policies for customer_credits, credit_items, and credit_payments
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_credits_staff_all" ON public.customer_credits;
CREATE POLICY "customer_credits_staff_all" ON public.customer_credits
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "credit_items_staff_all" ON public.credit_items;
CREATE POLICY "credit_items_staff_all" ON public.credit_items
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "credit_payments_staff_all" ON public.credit_payments;
CREATE POLICY "credit_payments_staff_all" ON public.credit_payments
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());


-- 5. Ensure schema supports historic debt entry without items
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'credit_items' 
          AND column_name = 'variant_id' 
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.credit_items ALTER COLUMN variant_id DROP NOT NULL;
    END IF;
END $$;
