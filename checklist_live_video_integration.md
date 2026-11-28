# Top Tendance — Live Countdown Video Integration Checklist

> **Purpose**: Roadmap, technical specifications, and implementation checklist for integrating video into the `/live` countdown broadcast screen.  
> **Status**: Planning Mode (Specification & Architecture — No code implementation yet).

---

## Phase 1: Video Asset Preparation & Storage

- [x] **1.1. Create Dedicated Asset Directory**
  - [x] Path: `public/videos/`
  - [x] Standard file naming: `countdown-bg.mp4` (or `countdown-teaser.mp4`)
  - [x] Add a lightweight fallback poster image: `public/videos/countdown-poster.jpg` for instant rendering while video buffers.

- [x] **1.2. Video Encoding & Format Validation**
  - [x] Container: **`.mp4`** (Validated: `countdown-bg.mp4`).
  - [x] Video Codec: **H.264 (AVC)** (Validated: AVC video stream).
  - [x] Audio: Muted by default (to be enforced in player for autoplay compliance).
  - [x] **Instagram & Facebook Fullscreen Optimization**:
    - **Aspect Ratio**: Confirmed **1080 × 1920 px (9:16 vertical)** — optimized for Instagram & Facebook Live.
    - **Display Scaling**: Fullscreen `object-fit: cover` with `w-screen h-screen` to eliminate black bars.
    - **Safe Zone Layout**: Keep visual focus centered to avoid Instagram/Facebook UI buttons (chat comments, hearts, top status bar).
  - [x] Compression & File Size: 61.8 MB (Duration: 01:13, Bitrate: 7 Mbps).
  - [x] Frame rate: **30 fps** (Validated: 30.00 fps).

---

## Phase 2: Configuration & Manager Controls

- [x] **2.1. Supabase / Live Settings Schema Support**
  - [x] Added video columns to `live_settings` in Supabase:
    - `video_url`: `text` (default `'/videos/countdown-bg.mp4'`).
    - `video_mode`: `text` (`'background'`, `'card'`, or `'reveal_on_live'`).
    - `video_enabled`: `boolean` (default `true`).
    - `video_opacity`: `numeric` (default `0.45`).

- [x] **2.2. Manager Settings Drawer Integration**
  - [x] Video display toggle and mode selector integrated in Manager Drawer:
    - Mode A: Plein Écran (Ambient Luxury Background Loop).
    - Mode B: Encadré (Featured Teaser Box / Player).
    - Mode C: Au Direct (Zero-State Live Reveal when timer hits 00:00:00).
  - [x] Opacity & Contrast slider control for background readability.

---

## Phase 3: Player Engine & OBS Studio Compatibility

- [x] **3.1. High-Performance HTML5 Video Element**
  - [x] Attributes: `autoPlay`, `loop`, `muted`, `playsInline`, `preload="auto"`, `poster="/videos/countdown-poster.jpg"`.
  - [x] CSS `object-fit: cover` with hardware-accelerated rendering (`[transform:translateZ(0)]`).
  - [x] Visual overlay layer (radial & linear contrast gradients) between video and text to guarantee 100% legibility of countdown numbers and logo.

- [x] **3.2. OBS Studio Broadcast Support**
  - [x] Ensure seamless loop without stuttering or black frames inside OBS Browser Source (DOM muted enforcement + onEnded replay fallback).
  - [x] Honor `?clean=true` URL parameter (displays pure clean visual with video and timer).
  - [x] Honor `?transparent=true` URL parameter (hides background video when streamer wants camera transparency).

---

## Phase 4: UI/UX & Responsive Layout Design

- [x] **4.1. Luxury Top Tendance Aesthetics**
  - [x] Dark obsidian tint and champagne gold glow overlays to blend the video seamlessly with the brand aesthetic.
  - [x] Subtle vignette effect around viewport edges.

- [x] **4.2. Mobile, Instagram & Facebook Safe Zones**
  - [x] True edge-to-edge fullscreen background (`object-fit: cover`) with zero letterboxing (no black bars).
  - [x] Margin / Safe-Zone compliance for Instagram & Facebook live overlays:
    - Top safe area: ~120px clearance for profile picture, live badge, and viewer count.
    - Bottom safe area: ~180px clearance for live chat comments, heart reactions, and input fields.
    - Centered countdown elements so everything remains perfectly visible and readable.

---

## Phase 5: Verification & Quality Assurance (Testing)

- [ ] **5.1. Autoplay Policy Verification**
  - [ ] Test cold page loads in Chrome, Safari, Firefox, and Edge (verify video starts playing without requiring user click).
- [ ] **5.2. OBS Studio Browser Source Test**
  - [ ] Add URL `http://localhost:3000/live?clean=true` in OBS Studio.
  - [ ] Confirm video loops continuously without memory leaks or CPU spikes.
- [ ] **5.3. Countdown Synchronization Test**
  - [ ] Verify that video playback does not disrupt or jitter the countdown timer engine (`calcTimeRemaining`).
- [ ] **5.4. Fallback Handling Test**
  - [ ] Test behavior when video file is missing or loading slowly (smooth fallback to current gradient background).
