# Top Tendance — Live Navigation Shortcut Checklist

> **Purpose**: Roadmap and specification for adding direct, one-click access to the Live Countdown screen (`/live`) from the Manager & Staff navigation across desktop and mobile.  
> **Status**: Planning Mode — Implementation on hold until approved.

---

## 1. Desktop Navigation Header (`src/components/common/Header.tsx`)

- [x] **1.1. Main Staff Top Bar Shortcut**
  - [x] Add an **"Écran Live"** badge/pill next to *"Caisse POS"* in the staff navigation bar.
  - [x] Style with brand aesthetic: rose/ruby soft glow, live pulsing dot (`🔴`), rounded pill.
  - [x] Direct link to `/live`.

- [x] **1.2. Staff Account Dropdown Menu**
  - [x] Add an item **"Écran Live Countdown"** inside the user profile dropdown under staff links.
  - [x] Use `Radio` or `Tv` icon from `lucide-react`.
  - [x] Closes dropdown automatically on click.

---

## 2. Mobile Navigation Drawer (`src/components/common/MobileMenu.tsx`) — *Omitted (Live is PC-only)*

- [x] ~~**2.1. Staff Operations Section** (Skipped: Not needed as Live streaming is managed exclusively on PC)~~

---

## 3. Manager Inventory & Dashboard (`src/app/inventory/page.tsx`)

- [x] **3.1. Inventory Header Quick Action**
  - [x] Add a quick-launch button **"Lancer Live"** at the top of the manager dashboard next to *"Nouveau Produit"*.
  - [x] Opens `/live` in a new tab or direct navigation.

---

## 4. Role & Permission Security

- [x] **4.1. Role Guarding**
  - [x] Strictly visible to authenticated staff (`manager` or `cashier`).
  - [x] 100% hidden from regular customers, clients, and unauthenticated guests.

---

## 5. Verification & Acceptance Testing

- [ ] **5.1. Manager Desktop Test**
  - [ ] Login as `manager@toptendance.tn` → Verify Live button appears in top bar and dropdown.
- [ ] **5.2. Customer / Incognito Test**
  - [ ] Open site as guest or customer → Confirm NO live staff buttons are visible anywhere.
