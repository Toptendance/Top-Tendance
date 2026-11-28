'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import {
  Volume2,
  VolumeX,
  Settings,
  X,
  Lock,
  KeyRound,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Save,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
} from 'lucide-react';

interface LiveSettings {
  id: string;
  title: string;
  subtitle: string;
  target_time: string;
  is_active: boolean;
  theme: string;
}

interface TimeRemaining {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  totalSeconds: number;
}

function formatForDateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getFutureDefaultTime(targetTimeStr?: string | null): string {
  if (targetTimeStr) {
    const targetDate = new Date(targetTimeStr);
    // If targetDate is valid and strictly in the future (at least 60 seconds ahead)
    if (!isNaN(targetDate.getTime()) && targetDate.getTime() > Date.now() + 60000) {
      return formatForDateTimeLocal(targetDate);
    }
  }

  // If expired or missing, default to Now + 30 minutes, rounded to nearest 5 minutes
  const future = new Date(Date.now() + 30 * 60 * 1000);
  const remainder = future.getMinutes() % 5;
  if (remainder !== 0) {
    future.setMinutes(future.getMinutes() + (5 - remainder));
  }
  future.setSeconds(0, 0);
  return formatForDateTimeLocal(future);
}

function calcTimeRemaining(targetTs: number | null): TimeRemaining {
  if (!targetTs) {
    return { days: '00', hours: '00', minutes: '00', seconds: '00', totalSeconds: 0 };
  }
  const now = Date.now();
  const diff = Math.max(0, Math.floor((targetTs - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days: pad(Math.floor(diff / 86400)),
    hours: pad(Math.floor((diff % 86400) / 3600)),
    minutes: pad(Math.floor((diff % 3600) / 60)),
    seconds: pad(diff % 60),
    totalSeconds: diff,
  };
}

function LiveContent() {
  const searchParams = useSearchParams();

  // 4.1 URL Parameters for OBS / Broadcast
  const isCleanMode =
    searchParams.get('clean') === 'true' || searchParams.get('clean') === '1';
  const isTransparentMode =
    searchParams.get('transparent') === 'true' ||
    searchParams.get('transparent') === '1' ||
    searchParams.get('bg') === 'transparent';

  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const wasPositiveDiffRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplayBlockedRef = useRef(false);

  // Attempt unmuted autoplay for OBS Studio; fallback to muted autoplay if browser blocks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleFirstInteraction() {
      if (!autoplayBlockedRef.current || !videoRef.current) return;
      autoplayBlockedRef.current = false;
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
      setSoundEnabled(true);
      window.removeEventListener('pointerdown', handleFirstInteraction);
    }

    async function initVideoPlayback() {
      if (!video) return;
      try {
        video.muted = false;
        await video.play();
        autoplayBlockedRef.current = false;
        setSoundEnabled(true);
      } catch {
        video.muted = true;
        autoplayBlockedRef.current = true;
        setSoundEnabled(false);
        video.play().catch(() => {});
        window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
      }
    }

    initVideoPlayback();

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
    };
  }, []);

  // Manager Authentication & Role State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isManagerAuthOpen, setIsManagerAuthOpen] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Settings Drawer (Manager Only)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('Vente Flash en Direct');
  const [editSubtitle, setEditSubtitle] = useState('Rejoignez-nous sur Facebook, Instagram & TikTok');
  const [editTime, setEditTime] = useState('');
  const [editTheme, setEditTheme] = useState<'dark' | 'light'>('dark');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedObsUrl, setCopiedObsUrl] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isManager = userProfile?.role === 'manager';

  // Check if selected target time is in the past
  const isTimeInPast = useMemo(() => {
    if (!editTime) return false;
    const t = new Date(editTime).getTime();
    return !isNaN(t) && t <= Date.now();
  }, [editTime]);

  const minDateTime = useMemo(() => {
    return formatForDateTimeLocal(new Date());
  }, [isSettingsOpen]);

  // Quick 1-Click Preset Handlers
  const applyPresetMinutes = useCallback((minutes: number) => {
    const target = new Date(Date.now() + minutes * 60 * 1000);
    target.setSeconds(0, 0);
    setEditTime(formatForDateTimeLocal(target));
  }, []);

  const applyTonightPreset = useCallback(() => {
    const now = new Date();
    const tonight = new Date();
    tonight.setHours(20, 0, 0, 0);
    if (tonight.getTime() <= now.getTime()) {
      tonight.setDate(tonight.getDate() + 1);
    }
    setEditTime(formatForDateTimeLocal(tonight));
  }, []);

  // Intelligent Modal Open Handler (Auto-resets expired target_time to Today + 30 min)
  const handleOpenSettings = useCallback(() => {
    setEditTime(getFutureDefaultTime(settings?.target_time));
    if (settings) {
      setEditTitle(settings.title);
      setEditSubtitle(settings.subtitle);
      setEditTheme((settings.theme as 'dark' | 'light') || 'dark');
    }
    setIsSettingsOpen(true);
  }, [settings]);

  const [timeLeft, setTimeLeft] = useState<TimeRemaining>({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
    totalSeconds: 0,
  });

  // 2. Fetch User Profile & Role Detection
  useEffect(() => {
    async function checkUserRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user);
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Error fetching role:', err);
      }
    }

    checkUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUserProfile(profile);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 4.2 Clean Fullscreen API Handling (Sync state & Escape listener)
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  // Keyboard shortcut (Ctrl + Shift + M) and Escape handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        if (!isManager) {
          setIsManagerAuthOpen(true);
        } else {
          if (isSettingsOpen) {
            setIsSettingsOpen(false);
          } else {
            handleOpenSettings();
          }
        }
      }
      if (e.key === 'Escape') {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isManagerAuthOpen) {
          setIsManagerAuthOpen(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManager, isSettingsOpen, isManagerAuthOpen]);

  // 3. Fetch & Subscribe to Live Settings
  useEffect(() => {
    async function fetchLiveSettings() {
      try {
        const { data, error } = await supabase
          .from('live_settings')
          .select('*')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Failed to load live settings:', error);
        } else if (data) {
          setSettings(data);
          setEditTitle(data.title);
          setEditSubtitle(data.subtitle);
          setEditTheme((data.theme as 'dark' | 'light') || 'dark');
          if (data.target_time) {
            setEditTime(getFutureDefaultTime(data.target_time));
            const ts = new Date(data.target_time).getTime();
            if (!isNaN(ts)) {
              setTimeLeft(calcTimeRemaining(ts));
              wasPositiveDiffRef.current = ts > Date.now();
            }
          }
        } else {
          setEditTime(getFutureDefaultTime(null));
        }
      } catch (err) {
        console.error('Unexpected error loading live settings:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLiveSettings();

    const channel = supabase
      .channel('live-settings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_settings' },
        (payload) => {
          if (payload.new && (payload.new as any).is_active) {
            const updated = payload.new as LiveSettings;
            setSettings(updated);
            setEditTitle(updated.title);
            setEditSubtitle(updated.subtitle);
            setEditTheme((updated.theme as 'dark' | 'light') || 'dark');
            setEditTime(getFutureDefaultTime(updated.target_time));
            if (updated.target_time) {
              const ts = new Date(updated.target_time).getTime();
              if (!isNaN(ts)) {
                setTimeLeft(calcTimeRemaining(ts));
                wasPositiveDiffRef.current = ts > Date.now();
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 4. Target Time Calculation
  const targetTimestamp = useMemo(() => {
    if (!settings?.target_time) return null;
    const ts = new Date(settings.target_time).getTime();
    return isNaN(ts) ? null : ts;
  }, [settings?.target_time]);

  // 5. Robust High-Precision Countdown Engine
  useEffect(() => {
    if (!targetTimestamp) return;

    function pad(n: number) {
      return String(n).padStart(2, '0');
    }

    function calculateTime() {
      const remaining = calcTimeRemaining(targetTimestamp);

      if (remaining.totalSeconds > 0) {
        wasPositiveDiffRef.current = true;
      }

      setTimeLeft(remaining);
    }

    calculateTime();
    const timer = setInterval(calculateTime, 250);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  // Handle Manager In-Page Authentication
  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: managerEmail.trim(),
        password: managerPassword,
      });

      if (error) throw error;

      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (pError || !profile) {
        throw new Error('Profil utilisateur introuvable');
      }

      if (profile.role !== 'manager') {
        throw new Error('Accès refusé : Ce compte n’a pas le rôle Manager');
      }

      setUserProfile(profile);
      setIsManagerAuthOpen(false);
      setManagerPassword('');
      handleOpenSettings();
    } catch (err: any) {
      setAuthError(err.message || 'Identifiants invalides');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle Save & Launch Countdown (Manager Only)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    setIsSaving(true);

    try {
      if (!editTime) {
        alert('Veuillez sélectionner une date et heure de début.');
        return;
      }

      if (new Date(editTime).getTime() <= Date.now()) {
        alert('Impossible de lancer un compte à rebours avec une date déjà passée.');
        return;
      }

      const isoTargetTime = new Date(editTime).toISOString();
      const payload = {
        title: editTitle.trim(),
        subtitle: editSubtitle.trim(),
        target_time: isoTargetTime,
        theme: editTheme,
        is_active: true,
        updated_by: currentUser?.id,
        updated_at: new Date().toISOString(),
      };

      // 1. Optimistic UI update: Immediately update state and recalculate countdown
      const targetId = settings?.id || 'live-active-settings';
      const optimisticSettings: LiveSettings = {
        id: targetId,
        title: payload.title,
        subtitle: payload.subtitle,
        target_time: payload.target_time,
        is_active: payload.is_active,
        theme: payload.theme,
      };
      setSettings(optimisticSettings);

      const targetTs = new Date(isoTargetTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((targetTs - now) / 1000));
      const pad = (n: number) => String(n).padStart(2, '0');
      setTimeLeft({
        days: pad(Math.floor(diff / 86400)),
        hours: pad(Math.floor((diff % 86400) / 3600)),
        minutes: pad(Math.floor((diff % 3600) / 60)),
        seconds: pad(diff % 60),
        totalSeconds: diff,
      });
      wasPositiveDiffRef.current = diff > 0;

      // Close settings drawer immediately
      setIsSettingsOpen(false);

      // 2. Persist to Supabase Database
      if (settings?.id) {
        const { error } = await supabase
          .from('live_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('live_settings')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (inserted) {
          setSettings(inserted as LiveSettings);
        }
      }
    } catch (err: any) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Native Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  // Copy Clean OBS URL
  const copyObsUrl = () => {
    const url = `${window.location.origin}/live?clean=true`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedObsUrl(true);
      setTimeout(() => setCopiedObsUrl(false), 2500);
    });
  };

  const isLive =
    !loading &&
    targetTimestamp !== null &&
    targetTimestamp <= Date.now() &&
    timeLeft.totalSeconds === 0;
  const currentTheme = settings?.theme || 'dark';
  const isLightTheme = currentTheme === 'light';
  const title = settings?.title || 'Vente Flash en Direct';
  const subtitle = settings?.subtitle || 'Rejoignez-nous sur Facebook, Instagram & TikTok';

  // Compute background style based on transparent mode & theme
  const backgroundStyle = useMemo(() => {
    if (isTransparentMode) {
      return {
        backgroundColor: 'transparent',
        backgroundImage: 'none',
      };
    }

    if (isLive) {
      return {
        backgroundColor: isLightTheme ? '#F9F6F0' : '#0B0A0F',
        backgroundImage: isLightTheme
          ? `
            radial-gradient(ellipse at 50% 50%, rgba(232, 38, 95, 0.22) 0%, rgba(212, 175, 55, 0.15) 45%, #F9F6F0 85%),
            radial-gradient(circle at 50% 20%, rgba(232, 38, 95, 0.15) 0%, transparent 50%)
          `
          : `
            radial-gradient(ellipse at 50% 50%, rgba(232, 38, 95, 0.32) 0%, rgba(212, 175, 55, 0.12) 40%, rgba(11, 10, 15, 0.98) 80%),
            radial-gradient(circle at 50% 20%, rgba(232, 38, 95, 0.2) 0%, transparent 50%)
          `,
      };
    }

    return {
      backgroundColor: isLightTheme ? '#F9F6F0' : '#0B0A0F',
      backgroundImage: isLightTheme
        ? `
          radial-gradient(ellipse at 50% 45%, rgba(232, 38, 95, 0.12) 0%, rgba(212, 175, 55, 0.08) 32%, #F9F6F0 75%),
          radial-gradient(circle at 85% 15%, rgba(232, 38, 95, 0.06) 0%, transparent 40%),
          radial-gradient(circle at 15% 85%, rgba(212, 175, 55, 0.05) 0%, transparent 40%)
        `
        : `
          radial-gradient(ellipse at 50% 45%, rgba(232, 38, 95, 0.18) 0%, rgba(212, 175, 55, 0.08) 32%, rgba(11, 10, 15, 0.95) 70%),
          radial-gradient(circle at 85% 15%, rgba(232, 38, 95, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 15% 85%, rgba(212, 175, 55, 0.06) 0%, transparent 40%)
        `,
    };
  }, [isTransparentMode, isLive, isLightTheme]);

  return (
    <div
      className={`fixed inset-0 z-[100] w-screen h-screen overflow-hidden flex flex-col justify-between items-center select-none transition-colors duration-700 ${isLightTheme ? 'text-charcoal' : 'text-[#F5F0FF]'
        }`}
      style={backgroundStyle}
    >
      <video
        ref={videoRef}
        src="/videos/countdown-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />

      {/* Top ambient glow bar (hidden in transparent mode) */}
      {!isTransparentMode && (
        <div
          className={`absolute top-0 inset-x-0 h-[3px] transition-all duration-700 ${isLive
              ? 'bg-gradient-to-r from-transparent via-[#E8265F] to-transparent shadow-[0_0_20px_#E8265F]'
              : 'bg-gradient-to-r from-transparent via-[#E8265F]/60 to-transparent'
            }`}
        />
      )}

      {/* Discrete Manager Settings Gear Button (Rendered ONLY if authenticated as manager AND NOT in clean mode) */}
      {isManager && !isCleanMode && (
        <div className="absolute top-6 right-6 z-50 animate-fadeIn">
          <button
            onClick={handleOpenSettings}
            className={`group flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all shadow-lg backdrop-blur-md ${isLightTheme
                ? 'bg-white/80 hover:bg-[#E8265F]/10 border-charcoal/10 hover:border-[#E8265F]/40 text-charcoal'
                : 'bg-white/[0.06] hover:bg-[#E8265F]/20 border-white/[0.12] hover:border-[#E8265F]/50 text-white/70 hover:text-white'
              }`}
            title="Paramètres du Live (Réservé au Manager)"
            aria-label="Configuration Manager"
          >
            <Settings className="w-4 h-4 text-[#D4AF37] group-hover:rotate-45 transition-transform duration-300" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Configuration
            </span>
          </button>
        </div>
      )}

      {/* Top Header — Top Tendance Luxury Brand Mark (Safe Zone for IG / FB top bars) */}
      <header className="w-full pt-12 sm:pt-14 md:pt-10 px-4 sm:px-6 flex flex-col items-center text-center z-10">
        <div
          onClick={() => {
            if (!isManager && !isCleanMode) setIsManagerAuthOpen(true);
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md mb-3 transition-all duration-500 ${!isCleanMode ? 'cursor-pointer' : ''
            } ${isLive
              ? 'bg-[#E8265F]/20 border-[#E8265F]/50 shadow-[0_0_25px_rgba(232,38,95,0.5)]'
              : isLightTheme
                ? 'bg-black/[0.04] border-black/[0.08] hover:border-black/20'
                : 'bg-white/[0.04] border-white/[0.08] hover:border-white/20'
            }`}
          title={!isCleanMode ? (isManager ? 'Connecté en tant que Manager' : 'Connexion Manager (Ctrl + Shift + M)') : undefined}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-[#E8265F] animate-ping' : 'bg-[#E8265F] animate-pulse'
              }`}
          />
          <span
            className={`text-[10px] sm:text-xs font-bold tracking-[0.22em] uppercase ${isLive ? 'text-white' : isLightTheme ? 'text-charcoal/80' : 'text-white/70'
              }`}
          >
            {isLive ? 'EN DIRECT MAINTENANT' : 'Événement Officiel'}
          </span>
        </div>

        <h1
          onClick={() => {
            if (!isManager && !isCleanMode) setIsManagerAuthOpen(true);
          }}
          className={`font-serif text-2xl sm:text-4xl md:text-5xl font-bold tracking-[0.25em] sm:tracking-[0.3em] uppercase drop-shadow-sm ${!isCleanMode ? 'cursor-pointer' : ''
            } ${isLightTheme ? 'text-charcoal' : 'text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]'
            }`}
        >
          TOP TENDANCE
        </h1>
        <p className="mt-1 text-[10px] sm:text-xs tracking-[0.25em] uppercase text-[#D4AF37] font-semibold">
          Maison de Mode • Tunisie
        </p>

        {/* Delicate divider ornament */}
        <div className="mt-2.5 sm:mt-3 flex items-center gap-3">
          <div className={`w-10 sm:w-12 h-[1px] bg-gradient-to-r from-transparent ${isLightTheme ? 'to-charcoal/20' : 'to-white/20'}`} />
          <div className="w-1.5 h-1.5 rotate-45 border border-[#D4AF37]/70 bg-[#D4AF37]/30" />
          <div className={`w-10 sm:w-12 h-[1px] bg-gradient-to-l from-transparent ${isLightTheme ? 'to-charcoal/20' : 'to-white/20'}`} />
        </div>
      </header>

      {/* Main Center Stage (Instagram / Facebook Safe-Zone Centered: Clearance for Comments & Header) */}
      <main className="flex-1 w-full max-w-5xl px-3 sm:px-6 flex flex-col items-center justify-center text-center z-10 py-4 sm:py-6 my-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#E8265F]/30 border-t-[#E8265F] rounded-full animate-spin" />
            <span className="text-xs tracking-[0.2em] uppercase opacity-50">Chargement...</span>
          </div>
        ) : isLive ? (
          /* ZERO-STATE ("WE ARE LIVE!") DISPLAY */
          <div
            className="flex flex-col items-center w-full max-w-4xl transition-all duration-700 animate-fadeIn"
            role="alert"
            aria-live="assertive"
          >
            <div className="inline-flex items-center gap-3 px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#E8265F]/20 border border-[#E8265F]/40 backdrop-blur-md mb-5 sm:mb-8 animate-pulse shadow-[0_0_40px_rgba(232,38,95,0.4)]">
              <span className="w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-[#E8265F] animate-ping" />
              <span className="text-xs sm:text-sm md:text-base font-bold tracking-[0.25em] uppercase text-white">
                🔴 EN DIRECT SUR FACEBOOK &amp; TIKTOK
              </span>
            </div>

            <h2 className="font-serif text-3xl sm:text-6xl md:text-8xl font-black tracking-tight drop-shadow-[0_4px_40px_rgba(232,38,95,0.7)] leading-tight mb-3 sm:mb-6">
              NOUS SOMMES EN DIRECT !
            </h2>

            <p className="text-sm sm:text-xl md:text-2xl opacity-90 font-light tracking-wide max-w-2xl leading-relaxed">
              La diffusion a commencé. Rejoignez-nous dès maintenant sur nos réseaux officiels pour découvrir la collection !
            </p>
          </div>
        ) : (
          /* COUNTDOWN CLOCK DISPLAY */
          <div className="flex flex-col items-center w-full">
            <h2 className={`font-serif text-xl sm:text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-6 sm:mb-10 ${isLightTheme ? 'text-charcoal' : 'text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]'
              }`}>
              {title}
            </h2>

            <div
              className="flex items-center justify-center gap-1.5 sm:gap-4 md:gap-6 lg:gap-8 w-full max-w-4xl"
              aria-live="off"
            >
              {/* Jours */}
              <div className="flex flex-col items-center min-w-[58px] sm:min-w-[100px] md:min-w-[140px] lg:min-w-[180px]">
                <span className={`font-sans font-black tabular-nums tracking-tight text-4xl sm:text-6xl md:text-8xl lg:text-9xl leading-none ${isLightTheme ? 'text-charcoal' : 'text-white drop-shadow-[0_4px_20px_rgba(255,255,255,0.15)]'
                  }`}>
                  {timeLeft.days}
                </span>
                <span className="text-[9px] sm:text-xs md:text-sm font-bold tracking-[0.2em] sm:tracking-[0.25em] uppercase opacity-60 mt-1.5 sm:mt-4">
                  Jours
                </span>
              </div>

              <span className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-[#E8265F] -mt-3 sm:-mt-6 select-none opacity-80">
                :
              </span>

              {/* Heures */}
              <div className="flex flex-col items-center min-w-[58px] sm:min-w-[100px] md:min-w-[140px] lg:min-w-[180px]">
                <span className={`font-sans font-black tabular-nums tracking-tight text-4xl sm:text-6xl md:text-8xl lg:text-9xl leading-none ${isLightTheme ? 'text-charcoal' : 'text-white drop-shadow-[0_4px_20px_rgba(255,255,255,0.15)]'
                  }`}>
                  {timeLeft.hours}
                </span>
                <span className="text-[9px] sm:text-xs md:text-sm font-bold tracking-[0.2em] sm:tracking-[0.25em] uppercase opacity-60 mt-1.5 sm:mt-4">
                  Heures
                </span>
              </div>

              <span className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-[#E8265F] -mt-3 sm:-mt-6 select-none opacity-80">
                :
              </span>

              {/* Minutes */}
              <div className="flex flex-col items-center min-w-[58px] sm:min-w-[100px] md:min-w-[140px] lg:min-w-[180px]">
                <span className={`font-sans font-black tabular-nums tracking-tight text-4xl sm:text-6xl md:text-8xl lg:text-9xl leading-none ${isLightTheme ? 'text-charcoal' : 'text-white drop-shadow-[0_4px_20px_rgba(255,255,255,0.15)]'
                  }`}>
                  {timeLeft.minutes}
                </span>
                <span className="text-[9px] sm:text-xs md:text-sm font-bold tracking-[0.2em] sm:tracking-[0.25em] uppercase opacity-60 mt-1.5 sm:mt-4">
                  Minutes
                </span>
              </div>

              <span className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-[#E8265F] -mt-3 sm:-mt-6 select-none opacity-80">
                :
              </span>

              {/* Secondes */}
              <div className="flex flex-col items-center min-w-[58px] sm:min-w-[100px] md:min-w-[140px] lg:min-w-[180px]">
                <span className="font-sans font-black tabular-nums tracking-tight text-4xl sm:text-6xl md:text-8xl lg:text-9xl text-[#E8265F] drop-shadow-[0_4px_25px_rgba(232,38,95,0.4)] leading-none">
                  {timeLeft.seconds}
                </span>
                <span className="text-[9px] sm:text-xs md:text-sm font-bold tracking-[0.2em] sm:tracking-[0.25em] uppercase text-[#E8265F]/80 mt-1.5 sm:mt-4">
                  Secondes
                </span>
              </div>
            </div>

            <p className="mt-6 sm:mt-10 text-xs sm:text-base md:text-lg opacity-75 font-light tracking-wide max-w-xl px-2">
              {subtitle}
            </p>
          </div>
        )}
      </main>

      {/* Bottom Footer Info & Quick Controls (Hidden in Clean Mode, Safe Clearance for IG/FB Comments) */}
      {!isCleanMode && (
        <footer className="w-full pb-8 sm:pb-8 px-4 sm:px-6 flex items-center justify-between z-10 opacity-70 text-[11px] sm:text-xs tracking-wider">
          <p className="flex items-center gap-2">
            <span>toptendance.net</span>
            <span>•</span>
            <span>Facebook &bull; Instagram &bull; TikTok</span>
          </p>

          <div className="flex items-center gap-2">
            {/* Quick Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-full border transition ${isLightTheme
                  ? 'bg-black/[0.04] hover:bg-black/[0.08] border-black/10 text-charcoal'
                  : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.08] text-white'
                }`}
              title={isFullscreen ? 'Quitter le Plein Écran' : 'Activer le Plein Écran'}
              aria-label={isFullscreen ? 'Quitter le Plein Écran' : 'Activer le Plein Écran'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#D4AF37]" /> : <Maximize2 className="w-4 h-4 text-[#D4AF37]" />}
            </button>

            {/* Toggle Audio Sound Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                autoplayBlockedRef.current = false;
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (videoRef.current) {
                  videoRef.current.muted = !next;
                  if (next) {
                    videoRef.current.play().catch(() => {});
                  }
                }
              }}
              className={`p-2 rounded-full border transition ${isLightTheme
                  ? 'bg-black/[0.04] hover:bg-black/[0.08] border-black/10'
                  : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.08]'
                }`}
              title={soundEnabled ? 'Son activé' : 'Son coupé'}
              aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-[#E8265F]" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </footer>
      )}

      {/* ============================================================== */}
      {/* MANAGER CONFIGURATION DRAWER / MODAL                           */}
      {/* ============================================================== */}
      {isSettingsOpen && isManager && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#14121F] border border-white/[0.15] rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative text-left my-8">
            <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#E8265F]/20 border border-[#E8265F]/40 text-[#E8265F]">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-serif tracking-wide">
                    Paramètres du Live
                  </h3>
                  <p className="text-xs text-white/50">
                    Configuration exclusive du compte à rebours Manager
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                  Titre de l’événement
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex: Vente Flash en Direct"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#E8265F] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                  Sous-titre &amp; Réseaux Sociaux
                </label>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="Ex: Rejoignez-nous sur Facebook, Instagram & TikTok"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#E8265F] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                  Date et Heure de Début (Heure locale)
                </label>
                <input
                  type="datetime-local"
                  value={editTime}
                  min={minDateTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  required
                  className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm focus:outline-none transition scheme-dark ${isTimeInPast
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-white/[0.15] focus:border-[#E8265F]'
                    }`}
                />

                {/* 1-Click Quick Launch Presets */}
                <div className="mt-2.5 flex items-center flex-wrap gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/50 mr-0.5">
                    Raccourcis :
                  </span>
                  <button
                    type="button"
                    onClick={() => applyPresetMinutes(15)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-[#E8265F]/20 hover:text-[#E8265F] hover:border-[#E8265F]/40 border border-white/10 text-white/80 text-[11px] font-semibold transition cursor-pointer"
                  >
                    +15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetMinutes(30)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-[#E8265F]/20 hover:text-[#E8265F] hover:border-[#E8265F]/40 border border-white/10 text-white/80 text-[11px] font-semibold transition cursor-pointer"
                  >
                    +30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetMinutes(60)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-[#E8265F]/20 hover:text-[#E8265F] hover:border-[#E8265F]/40 border border-white/10 text-white/80 text-[11px] font-semibold transition cursor-pointer"
                  >
                    +1 heure
                  </button>
                  <button
                    type="button"
                    onClick={applyTonightPreset}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-[#D4AF37]/20 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 border border-white/10 text-white/80 text-[11px] font-semibold transition cursor-pointer"
                  >
                    Ce soir 20h00
                  </button>
                </div>

                {isTimeInPast && (
                  <div className="mt-2 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>⚠️ L’heure choisie est déjà passée. Veuillez choisir une heure future.</span>
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-white/40">
                  Le compte à rebours se synchronise automatiquement sur tous les écrans et flux OBS connectés.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                  Ambiance Visuelle
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditTheme('dark')}
                    className={`flex items-center justify-center gap-2.5 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition ${editTheme === 'dark'
                        ? 'bg-[#E8265F]/20 border-[#E8265F] text-white shadow-lg shadow-[#E8265F]/20'
                        : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
                      }`}
                  >
                    <Moon className="w-4 h-4 text-[#D4AF37]" />
                    Obsidian Sombre
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditTheme('light')}
                    className={`flex items-center justify-center gap-2.5 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition ${editTheme === 'light'
                        ? 'bg-[#E8265F]/20 border-[#E8265F] text-white shadow-lg shadow-[#E8265F]/20'
                        : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
                      }`}
                  >
                    <Sun className="w-4 h-4 text-[#D4AF37]" />
                    Boutique Lin
                  </button>
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold transition"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#D4AF37]" /> : <Maximize2 className="w-4 h-4 text-[#D4AF37]" />}
                  <span>{isFullscreen ? 'Quitter Plein Écran' : 'Plein Écran (OBS)'}</span>
                </button>

                <button
                  type="button"
                  onClick={copyObsUrl}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold transition"
                >
                  {copiedObsUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#D4AF37]" />}
                  <span>{copiedObsUrl ? 'URL Copiée !' : 'Copier URL OBS'}</span>
                </button>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/10">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUserProfile(null);
                    setCurrentUser(null);
                    setIsSettingsOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400 transition"
                  title="Verrouiller l'écran et se déconnecter"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Verrouiller</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || isTimeInPast || !editTime}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E8265F] hover:bg-[#d01e51] text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-[#E8265F]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Enregistrement...' : 'Enregistrer & Lancer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MANAGER QUICK-AUTH MODAL (Triggered only when manager needs to sign in) */}
      {/* ============================================================== */}
      {isManagerAuthOpen && !isManager && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14121F] border border-white/[0.15] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-left">
            <button
              onClick={() => {
                setIsManagerAuthOpen(false);
                setAuthError(null);
              }}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-[#E8265F]/20 border border-[#E8265F]/40 text-[#E8265F]">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-serif">
                  Accès Responsable
                </h3>
                <p className="text-xs text-white/60">
                  Connectez-vous pour configurer le compte à rebours
                </p>
              </div>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleManagerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Email Manager
                </label>
                <input
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder="manager@toptendance.tn"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#E8265F] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.15] text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#E8265F] transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsManagerAuthOpen(false);
                    setAuthError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8265F] hover:bg-[#d01e51] text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-[#E8265F]/30 disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {isAuthSubmitting ? 'Connexion...' : 'Déverrouiller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[100] w-screen h-screen bg-[#0B0A0F] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#E8265F]/30 border-t-[#E8265F] rounded-full animate-spin" />
        </div>
      }
    >
      <LiveContent />
    </Suspense>
  );
}
