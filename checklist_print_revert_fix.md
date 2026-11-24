# Print Fix Checklist — Revert & Stabilize

**Goal**: Get back to the last known working state, then lock it permanently.

---

## What broke (in order)

1. ~~Removed `zoom: 1.1428`~~ → labels physically too small
2. ~~Added `transform: scale(1.1428)`~~ → 24 sheets of paper bug
3. ~~Removed `/ 1.1428` from offsets~~ → offset math broken

---

## Step 1 — Revert `globals.css`: Restore `zoom: 1.1428`

- [x] **1.1** Replace `transform: scale(1.1428) + transform-origin` with `zoom: 1.1428` on `#print-sheets-container`

---

## Step 2 — Revert `BarcodeTagModal.tsx`: Restore offset divisors

- [x] **2.1** Line ~303: `left: \`${offsetX}mm\`` → `left: \`${offsetX / 1.1428}mm\``
- [x] **2.2** Line ~304: `top: \`${offsetY}mm\`` → `top: \`${offsetY / 1.1428}mm\``

---

## Step 3 — Add a permanent visible reminder in the print modal UI

The Chrome Scale dialog will always show **87.5% by default** when `zoom: 1.1428` is active.
This is not a bug — it's how Chrome reacts to the zoom that compensates for Canon G2010.

- [x] **3.1** In `BarcodeTagModal.tsx`, update the Canon G2010 blue info box to say clearly:
  > ⚠️ Dans Chrome : régler **Échelle → Défaut** (pas 87%)

---

## Step 4 — Verify build

- [ ] **4.1** `npx tsc --noEmit` → exit code 0

---

## Why `zoom: 1.1428` and Scale=Default is the only correct setup

| Setting | Physics |
|---------|---------|
| CSS cell = 52.5mm | Base size |
| `zoom: 1.1428` | Renders at 60mm layout size |
| Chrome sees 60mm > A4's 52.5mm → auto-shrinks to **87.5%** | Chrome default behavior |
| User sets Scale = **Default (100%)** | Overrides auto-shrink |
| Canon G2010 prints at **87.5%** of rendered size | Hardware fact |
| Net physical: 60mm × 87.5% = **52.5mm** ✅ | Exact HERMA cell size |

There is no CSS trick to skip the Scale=Default step.
The only fix is making the reminder impossible to miss in the UI.

---

## Files to change

| File | Change |
|------|--------|
| `src/app/globals.css` | Restore `zoom: 1.1428` (remove transform) |
| `src/components/pos/BarcodeTagModal.tsx` | Restore `/ 1.1428` divisors + improve UI text |
