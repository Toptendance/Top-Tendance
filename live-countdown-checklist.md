# Top Tendance — Live Countdown Feature Checklist

> **Purpose**: Roadmap, specification, and implementation checklist for the dedicated `/live` broadcast countdown screen.  
> **Key Security Rule**: **Manager-Only Setup** — Only authenticated users with role `manager` can set or modify the countdown schedule, title, and settings. All other visitors and OBS browser sources see a clean, tamper-proof display.

---

## Phase 1: Database & Security Architecture (Manager-Only Control)

- [x] **1.1. Create Supabase Storage / Table for Live Settings**
  - Table name: `live_settings` (single active row or key-value config).
  - Columns:
    - `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
    - `title`: `text` (e.g., `"Vente Flash en Direct"`)
    - `subtitle`: `text` (e.g., `"Rejoignez-nous sur Facebook, Instagram & TikTok"`)
    - `target_time`: `timestamptz` (scheduled live event start date & time)
    - `is_active`: `boolean` (default `true`)
    - `theme`: `text` (default `'dark'`)
    - `updated_by`: `uuid` (references `profiles.id`)
    - `updated_at`: `timestamptz` (default `now()`)

- [x] **1.2. Configure Row Level Security (RLS)**
  - [x] `SELECT` policy: `public` / anonymous read allowed (so viewers and OBS can render the countdown).
  - [x] `INSERT / UPDATE / DELETE` policy: Strictly restricted to `auth.uid() IN (SELECT id FROM profiles WHERE role = 'manager')`.
  - [x] Ensure non-managers cannot write to the table under any circumstances.

- [ ] **1.3. Fallback / Quick Manager PIN Verification**
  - [ ] Support on-page manager authentication or quick PIN prompt if accessing from a streaming PC/OBS without existing cookie session.

---

## Phase 2: Page Architecture & Dedicated Route (`/live`)

- [x] **2.1. Create Next.js Route (`src/app/live/page.tsx`)**
  - [x] Fullscreen responsive canvas with zero default margins/paddings.
  - [x] Top Tendance luxury branding: Dark Obsidian palette (`#0E0E11` / `#1A1A1A`) with Champagne Gold & Ruby Rose glow effects.
  - [x] Display Top Tendance logo / brand name at top center.

- [x] **2.2. Robust Real-Time Countdown Engine**
  - [x] Tabular numerals (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter.
  - [x] Large responsive typography using CSS `clamp()` (`Days`, `Hours`, `Minutes`, `Seconds`).
  - [x] Local timezone accuracy handling (synced with Supabase server time).
  - [x] French / Tunisian bilingual labels (*Jours*, *Heures*, *Minutes*, *Secondes*).

- [x] **2.3. Zero-State ("We Are Live!") Animation**
  - [x] Smooth transition when countdown reaches `00:00:00:00`.
  - [x] Pulsing live badge: **🔴 « EN DIRECT SUR FACEBOOK & TIKTOK »**.
  - [x] Accessible status announcement (`role="alert"`, `aria-live="assertive"`).
  - [x] Optional subtle sound chime / gong at 0 (toggleable).

---

## Phase 3: Manager Setup Drawer / Modal UI

- [x] **3.1. Role Detection & Conditional Rendering**
  - [x] Fetch current user profile role via Supabase Auth (`profiles.role`).
  - [x] Only render the Settings Gear button (⚙️) if `role === 'manager'` or authenticated with Manager PIN.
  - [x] Completely strip/omit the configuration UI for regular viewers or anonymous OBS sources.

- [x] **3.2. Configuration Drawer Components**
  - [x] Input: Live Event Title.
  - [x] Input: Event Subtitle & Social channels text.
  - [x] Date/Time Picker: `datetime-local` input pre-populated with current scheduled time.
  - [x] Theme / Mode switcher (Luxury Dark / Boutique Light).
  - [x] Action buttons:
    - **"Enregistrer & Lancer"** (Saves directly to Supabase).
    - **"Plein Écran (OBS / Présentation)"** (Triggers native fullscreen).
    - **"Copier l'URL pour OBS"** (Copies clean browser source URL).

---

## Phase 4: OBS Studio & Broadcast Optimizations

- [x] **4.1. URL Parameters for Streamers**
  - [x] `?clean=true`: Automatically hides all helper icons, gear, and overlays for zero-distraction OBS capture.
  - [x] `?transparent=true`: Sets background to transparent for OBS webcam overlay scenes.

- [x] **4.2. Clean Fullscreen API Handling**
  - [x] Implement proper toggle for `document.requestFullscreen()` and `document.exitFullscreen()`.
  - [x] Listen to `fullscreenchange` and `Escape` key to prevent UI desync.

---

## Phase 5: Verification & Testing

- [ ] **5.1. Manager Permissions Test**
  - [ ] Login as `manager@toptendance.tn` → Open `/live` → Verify Gear icon & Settings Drawer appear.
  - [ ] Change title & date/time → Click Save → Verify countdown updates immediately.
- [ ] **5.2. Non-Manager / Incognito Test**
  - [ ] Open `/live` in private/incognito window (or as `cashier`) → Confirm NO gear icon, NO inputs, NO ability to tamper with time.
- [ ] **5.3. Responsiveness & Display Scaling**
  - [ ] Test on 1920×1080 (Standard TV / Stream), 4K monitor, and vertical mobile view.
- [ ] **5.4. Countdown Zero-Transition Test**
  - [ ] Set timer 10 seconds ahead and observe zero-state transition into "🔴 EN DIRECT".
