-- =============================================================================
-- supabase_step17_live_video_settings.sql
-- Add video configuration columns to live_settings
-- =============================================================================

ALTER TABLE public.live_settings 
ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '/videos/countdown-bg.mp4',
ADD COLUMN IF NOT EXISTS video_mode TEXT DEFAULT 'background',
ADD COLUMN IF NOT EXISTS video_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS video_opacity NUMERIC DEFAULT 0.45;

-- Set defaults on existing rows
UPDATE public.live_settings 
SET video_url = COALESCE(video_url, '/videos/countdown-bg.mp4'),
    video_mode = COALESCE(video_mode, 'background'),
    video_enabled = COALESCE(video_enabled, true),
    video_opacity = COALESCE(video_opacity, 0.45);
