-- =============================================================================
-- supabase_step16_live_settings.sql
-- Phase 1 — Database Table & Security for Live Stream Countdown
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.live_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Vente Flash en Direct',
    subtitle TEXT NOT NULL DEFAULT 'Rejoignez-nous sur Facebook, Instagram & TikTok',
    target_time TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    theme TEXT NOT NULL DEFAULT 'dark',
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.live_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "live_settings_select_public" ON public.live_settings;
DROP POLICY IF EXISTS "live_settings_manager_all" ON public.live_settings;

-- 1. Anyone (public, OBS, store screens) can read live countdown settings
CREATE POLICY "live_settings_select_public"
    ON public.live_settings
    FOR SELECT
    USING (true);

-- 2. Strictly ONLY managers can insert, update, or delete live settings
CREATE POLICY "live_settings_manager_all"
    ON public.live_settings
    FOR ALL
    TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- 3. Seed initial default row if empty
INSERT INTO public.live_settings (title, subtitle, target_time, is_active, theme)
SELECT 
    'Vente Flash en Direct',
    'Rejoignez-nous sur Facebook, Instagram & TikTok',
    date_trunc('hour', now() + interval '2 hours'),
    true,
    'dark'
WHERE NOT EXISTS (SELECT 1 FROM public.live_settings);
