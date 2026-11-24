# One-Click Print Fix — HERMA A4/40

**Goal**: Click "Imprimer" → Chrome print dialog opens → Hit Print → Done. No manual Scale/Margin fiddling.

---

## Root Cause

`globals.css` line 86 applies `zoom: 1.1428` to the print container.
This zoom makes Chrome think the content is **larger than A4**, so Chrome's default scale becomes ~87% (to fit it back in).
Result: user must manually set Scale → Default every time, or labels misalign.

**Fix**: Remove `zoom: 1.1428` — the CSS grid cells are already physically correct at 52.5mm × 29.7mm. No zoom is needed.

---

## Checklist

### Step 1 — `globals.css`: Replace zoom with transform
- [x] **1.1** Replace `zoom: 1.1428` with `transform: scale(1.1428); transform-origin: top left` on `#print-sheets-container`

### Step 2 — `BarcodeTagModal.tsx`: Remove zoom divisor from offset math
- [x] **2.1** Line 303: `left: \`${offsetX / 1.1428}mm\`` → `left: \`${offsetX}mm\``
- [x] **2.2** Line 304: `top: \`${offsetY / 1.1428}mm\`` → `top: \`${offsetY}mm\``

### Step 3 — Verify build
- [ ] **3.1** `npx tsc --noEmit` → exit code 0

### Step 4 — Test
- [ ] **4.1** Open print modal → click "Imprimer"
- [ ] **4.2** Chrome print dialog → Scale shows **Default** automatically (no manual change needed)
- [ ] **4.3** Preview shows 4 stickers full width, 1 sheet
- [ ] **4.4** Hit Print ✅

---

## Files to change (2 lines total)
| File | Change |
|------|--------|
| `src/app/globals.css` | Remove line 86: `zoom: 1.1428 !important;` |
| `src/components/pos/BarcodeTagModal.tsx` | Lines 303–304: remove `/ 1.1428` |
