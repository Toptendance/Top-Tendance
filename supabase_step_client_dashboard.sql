-- Migration for Client Dashboard additions: Addresses and Customer Orders
-- Top Tendance

-- 1. Client Addresses Table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Domicile',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line TEXT NOT NULL,
    city TEXT NOT NULL,
    governorate TEXT NOT NULL,
    postal_code TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on customer_addresses
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_addresses_owner_policy" ON public.customer_addresses;
CREATE POLICY "customer_addresses_owner_policy" ON public.customer_addresses
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 2. Customer Wishlist Sync Table
CREATE TABLE IF NOT EXISTS public.customer_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, product_slug)
);

ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_wishlist_owner_policy" ON public.customer_wishlists;
CREATE POLICY "customer_wishlist_owner_policy" ON public.customer_wishlists
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 3. Add customer_id / customer_phone to sales if not exists to link in-store purchases
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN customer_phone TEXT;
    END IF;
END $$;

-- Update sales RLS policy to let customers read their own purchases (where customer_id = auth.uid())
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
CREATE POLICY "sales_select_policy" ON public.sales
    FOR SELECT TO authenticated
    USING (
        cashier_id = auth.uid() OR customer_id = auth.uid() OR public.is_manager()
    );

