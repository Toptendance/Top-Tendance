# Top Tendance — Live Timer & Realtime Sync Reliability Checklist

> **Purpose**: Technical specification and phased roadmap to ensure 100% reliable countdown configuration, instant multi-screen synchronization (OBS, second tabs, staff PCs), and prevention of expired date bugs.  
> **Status**: Planning Mode — Implementation on hold until approved.

---

## Phase 1: Database Realtime Publication Setup

- [x] **1.1. Supabase Realtime Publication Activation**
  - [x] Add `public.live_settings` to the `supabase_realtime` publication in PostgreSQL:
    ```sql
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_settings;
    ```
  - [x] Verify using `pg_publication_tables` that `live_settings` is actively tracked for real-time broadcasts.
  - [x] Ensure `SELECT` RLS policy continues to allow unauthenticated anonymous connections (OBS browser sources and guests) to receive real-time postgres changes.

---

## Phase 2: Smart Date & Expiration Handling (`src/app/live/page.tsx`)

- [x] **2.1. Intelligent Modal Initialization & Auto-Reset**
  - [x] When opening the Configuration modal, check if `settings.target_time` is already in the past.
  - [x] If expired: Automatically reset `editTime` to **Today + 30 minutes** (rounded to the nearest 5-minute interval).
  - [x] Never pre-fill the form with an expired date from yesterday.

- [x] **2.2. Past-Date Prevention & Form Validation**
  - [x] Add `min={currentLocalDateTime}` to `<input type="datetime-local">` to block past date selection in native browser pickers.
  - [x] Add live validation: If the selected `editTime` timestamp is `<= Date.now()`, show a prominent warning badge:
    *"⚠️ L'heure choisie est déjà passée. Veuillez choisir une heure future."*
  - [x] Disable the **"Enregistrer & Lancer"** button while the selected date/time is in the past.

- [x] **2.3. 1-Click Quick Launch Presets**
  - [x] Add one-click preset buttons directly above or below the datetime input:
    - `+15 min` (Starts in 15 minutes from now)
    - `+30 min` (Starts in 30 minutes from now)
    - `+1 heure` (Starts in 1 hour from now)
    - `Ce soir 20h00` (Sets today at 20:00, or tomorrow if 20:00 already passed)
  - [x] Clicking a preset immediately updates `editTime` with the correct current date and time.

---

## Phase 3: Immediate State Update & Countdown Engine Hardening

- [x] **3.1. Optimistic Local State Update**
  - [x] In `handleSaveSettings()`, immediately update local state `setSettings({ ...payload, id: targetId })` upon submission.
  - [x] Recalculate remaining time synchronously so the timer starts counting down immediately on the manager's screen without waiting for network or realtime response.
  - [x] Close the configuration drawer cleanly with visual confirmation.

- [x] **3.2. Eliminate Initial Render Race Condition ("Flicker")**
  - [x] Compute initial `timeLeft` synchronously during the first render from `targetTimestamp`, instead of defaulting to `totalSeconds: 0`.
  - [x] Prevent `isLive` from prematurely evaluating to `true` while the page is mounting or fetching settings.
  - [x] Ensure that pasting `/live` or `/live?clean=true` into a fresh tab immediately renders the countdown clock without any visual glitch.

---

## Phase 4: Multi-Screen & OBS Synchronization Testing

- [ ] **4.1. Manager Launch Verification**
  - [ ] Open `/live` on manager PC → Open Configuration → Click `+15 min` → Click "Enregistrer & Lancer".
  - [ ] Confirm countdown immediately starts ticking down from `00:14:59` on the manager's screen.

- [ ] **4.2. Pasted Link & OBS Fresh Tab Test**
  - [ ] Copy the clean URL `/live?clean=true` (or regular `/live`).
  - [ ] Open in an incognito window / second browser without logging in.
  - [ ] Confirm the exact same countdown is running in sync to the second.

- [ ] **4.3. Realtime Multi-Tab Broadcast Test**
  - [ ] Keep both tabs side-by-side.
  - [ ] Change the title or add 10 minutes in the manager tab.
  - [ ] Confirm the second tab updates instantly without refreshing.

- [ ] **4.4. Zero-State ("We Are Live!") Transition Test**
  - [ ] Launch a 1-minute countdown.
  - [ ] Confirm chime plays at `00:00:00` and display smoothly transitions to "NOUS SOMMES EN DIRECT !".
