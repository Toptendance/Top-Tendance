-- =============================================================================
-- supabase_step12_rls_credits_deliveries.sql
-- Phase 5.1 — Row Level Security (RLS) Policies for Credits & Deliveries
-- =============================================================================

-- 1. Helper function is_staff() (true for cashier and manager roles)
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

-- 2. Helper function get_auth_user_phone()
-- Resolves user's phone number either from auth user phone, customer_addresses, or sales/profile
CREATE OR REPLACE FUNCTION public.get_auth_user_phone()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        -- 1. From auth.users directly if phone auth was used
        (SELECT phone FROM auth.users WHERE id = auth.uid()),
        -- 2. From saved customer address (most recent)
        (SELECT phone FROM public.customer_addresses WHERE user_id = auth.uid() ORDER BY is_default DESC, created_at DESC LIMIT 1)
    );
$$;

-- =============================================================================
-- Enable RLS on Credits and Deliveries Tables
-- =============================================================================
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Drop Existing Policies (if any)
-- =============================================================================
DROP POLICY IF EXISTS "customer_credits_staff_all" ON public.customer_credits;
DROP POLICY IF EXISTS "credit_items_staff_all" ON public.credit_items;
DROP POLICY IF EXISTS "credit_payments_staff_all" ON public.credit_payments;

DROP POLICY IF EXISTS "deliveries_staff_all" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_customer_select" ON public.deliveries;

DROP POLICY IF EXISTS "delivery_items_staff_all" ON public.delivery_items;
DROP POLICY IF EXISTS "delivery_items_customer_select" ON public.delivery_items;

-- =============================================================================
-- Policies: Customer Credits (Staff only: Cashiers and Managers)
-- =============================================================================

-- Cashiers and Managers can read, insert, and update customer credits
CREATE POLICY "customer_credits_staff_all" ON public.customer_credits
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Cashiers and Managers can read, insert, and update credit items
CREATE POLICY "credit_items_staff_all" ON public.credit_items
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Cashiers and Managers can read, insert, and update credit payments
CREATE POLICY "credit_payments_staff_all" ON public.credit_payments
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- =============================================================================
-- Policies: Deliveries
-- =============================================================================

-- Cashiers and Managers can read, insert, update, delete all deliveries
CREATE POLICY "deliveries_staff_all" ON public.deliveries
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Regular customers can only read deliveries linked to their phone or user account
CREATE POLICY "deliveries_customer_select" ON public.deliveries
    FOR SELECT TO authenticated
    USING (
        created_by = auth.uid()
        OR recipient_phone = public.get_auth_user_phone()
        OR recipient_phone_alt = public.get_auth_user_phone()
        OR EXISTS (
            SELECT 1 FROM public.customer_addresses ca 
            WHERE ca.user_id = auth.uid() 
              AND (ca.phone = deliveries.recipient_phone OR ca.phone = deliveries.recipient_phone_alt)
        )
    );

-- =============================================================================
-- Policies: Delivery Items
-- =============================================================================

-- Cashiers and Managers have full access to delivery items
CREATE POLICY "delivery_items_staff_all" ON public.delivery_items
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Customers can view items belonging to deliveries they can view
CREATE POLICY "delivery_items_customer_select" ON public.delivery_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.deliveries d
            WHERE d.id = delivery_items.delivery_id
              AND (
                  d.created_by = auth.uid()
                  OR d.recipient_phone = public.get_auth_user_phone()
                  OR d.recipient_phone_alt = public.get_auth_user_phone()
                  OR EXISTS (
                      SELECT 1 FROM public.customer_addresses ca 
                      WHERE ca.user_id = auth.uid() 
                        AND (ca.phone = d.recipient_phone OR ca.phone = d.recipient_phone_alt)
                  )
              )
        )
    );

-- =============================================================================
-- Confirm Variant Costs remain strictly Manager-Only
-- =============================================================================
ALTER TABLE public.variant_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "variant_costs_manager_policy" ON public.variant_costs;
CREATE POLICY "variant_costs_manager_policy" ON public.variant_costs
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

