-- =============================================================================
-- supabase_step10_deliveries_schema.sql
-- Phase 4.1 — Database Schema for Deliveries
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number TEXT,
    courier_name TEXT NOT NULL DEFAULT 'Aramex', -- Aramex, Yalidine, Express, Livraison Propre
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_phone_alt TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    governorate TEXT NOT NULL, -- 24 gouvernorats tunisiens
    cod_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (cod_amount >= 0), -- Contre remboursement
    shipping_fee NUMERIC(12, 3) NOT NULL DEFAULT 7.000 CHECK (shipping_fee >= 0),
    status TEXT NOT NULL CHECK (status IN ('preparing', 'dispatched', 'in_transit', 'delivered', 'returned', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'remitted_by_courier')),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON public.deliveries(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON public.deliveries(tracking_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);

CREATE TABLE IF NOT EXISTS public.delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    size TEXT,
    color TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 3) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_variant_id ON public.delivery_items(variant_id);

