-- Step 7: Reports & Analytics (Manager Only) Helper RPCs
-- Top Tendance POS & Inventory

-- 1. Daily sales and profit report RPC
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
    -- Enforce manager role
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, role INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.role != 'manager' THEN
        RAISE EXCEPTION 'Forbidden: Only managers can view analytics';
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

    -- Aggregate cost of goods sold from sale_items
    SELECT 
        COALESCE(SUM(si.unit_cost * si.quantity), 0.000)
    INTO 
        v_total_cost
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date;

    v_net_profit := v_gross_revenue - v_total_cost;

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
        'total_cost', v_total_cost,
        'net_profit', v_net_profit,
        'sales_count', v_sales_count,
        'payment_breakdown', v_payment_breakdown,
        'best_sellers', v_best_sellers
    );
END;
$$;


-- 2. Stock valuation RPC
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
    -- Enforce manager role
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
    END IF;

    SELECT id, role INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND OR v_profile.role != 'manager' THEN
        RAISE EXCEPTION 'Forbidden: Only managers can view stock valuation';
    END IF;

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
END;
$$;

