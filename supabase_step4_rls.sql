-- Step 4: Security & Row Level Security (RLS)
-- Top Tendance POS & Inventory

-- 1. Helper function is_manager()
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'manager'
    );
$$;

-- 2. Helper function is_authenticated()
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 3. Enable RLS on 100% of tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_all_manager_policy" ON public.categories;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_all_manager_policy" ON public.products;
DROP POLICY IF EXISTS "variants_select_policy" ON public.variants;
DROP POLICY IF EXISTS "variants_all_manager_policy" ON public.variants;
DROP POLICY IF EXISTS "variant_costs_manager_policy" ON public.variant_costs;
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
DROP POLICY IF EXISTS "sale_items_select_policy" ON public.sale_items;
DROP POLICY IF EXISTS "stock_movements_select_policy" ON public.stock_movements;

-- =========================================================================
-- Table Policies
-- =========================================================================

-- PROFILES
-- Users can read their own profile; managers can read all profiles.
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR public.is_manager()
    );

-- MANAGERS can insert/update profiles
CREATE POLICY "profiles_modify_policy" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- CATEGORIES
-- Read: cashier & manager
CREATE POLICY "categories_select_policy" ON public.categories
    FOR SELECT TO authenticated
    USING (true);

-- Insert/Update/Delete: manager only
CREATE POLICY "categories_all_manager_policy" ON public.categories
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- PRODUCTS
-- Read: Cashier sees active only; Manager sees all
CREATE POLICY "products_select_policy" ON public.products
    FOR SELECT TO authenticated
    USING (
        is_active = true OR public.is_manager()
    );

-- Insert/Update/Delete: manager only
CREATE POLICY "products_all_manager_policy" ON public.products
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- VARIANTS
-- Read: Cashier sees active only; Manager sees all
CREATE POLICY "variants_select_policy" ON public.variants
    FOR SELECT TO authenticated
    USING (
        is_active = true OR public.is_manager()
    );

-- Insert/Update/Delete: manager only
CREATE POLICY "variants_all_manager_policy" ON public.variants
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- VARIANT_COSTS
-- SELECT, INSERT, UPDATE strictly restricted to manager. Cashiers have ZERO access.
CREATE POLICY "variant_costs_manager_policy" ON public.variant_costs
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- SALES
-- Cashiers: SELECT only their own sales (cashier_id = auth.uid())
-- Managers: SELECT all
CREATE POLICY "sales_select_policy" ON public.sales
    FOR SELECT TO authenticated
    USING (
        cashier_id = auth.uid() OR public.is_manager()
    );

-- SALE_ITEMS
-- Cashiers: SELECT only items of their own sales
-- Managers: SELECT all
CREATE POLICY "sale_items_select_policy" ON public.sale_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sales s 
            WHERE s.id = sale_items.sale_id 
              AND (s.cashier_id = auth.uid() OR public.is_manager())
        )
    );

-- STOCK_MOVEMENTS
-- Cashiers: No direct access.
-- Managers: Full SELECT (read-only audit log)
CREATE POLICY "stock_movements_select_policy" ON public.stock_movements
    FOR SELECT TO authenticated
    USING (public.is_manager());

