# 🖨️ Checklist — Fix QR/Barcode Print Layout for HERMA TOP STICK A4/40

## 🔍 Problem Summary

When printing labels, the tickets appear **only at the very top of the A4 page** in a narrow strip,
with the rest of the page completely blank. The labels are **not aligned** to the physical sticker
grid on the HERMA paper.

The user has also implemented a **"start position" feature** (choose which cell, 1–40, to begin
printing from), which must continue to work correctly after the fix.

---

## 📄 Target Paper Specifications — HERMA TOP STICK A4/40 (Ref. 8698)

| Property | Value |
|---|---|
| Sheet format | A4 (210mm × 297mm) |
| Labels per sheet | **40** |
| Grid layout | **4 columns × 10 rows** |
| Label width | **52.5 mm** |
| Label height | **29.7 mm** |
| Margin (top/left/right/bottom) | **0 mm** (labels fill the full A4 edge-to-edge) |
| Gap between labels | **0 mm** |
| Math check | 4 × 52.5mm = 210mm ✓ · 10 × 29.7mm = 297mm ✓ |

> **IMPORTANT:** The HERMA 8698 sheet is **zero-margin, zero-gap**. Labels must start exactly at
> the page edge. Any margin introduced by the browser print dialog or CSS will shift all labels off-grid.

---

## 🩺 Root Cause Diagnosis

### Bug 1 — `<style jsx global>` does not work in Next.js App Router ⚠️ CRITICAL
- The print CSS is written inside `<style jsx global>{...}</style>` in `BarcodeTagModal.tsx`
- This syntax is from **styled-jsx** which only works in the **Pages Router** (`/pages`)
- In the **App Router** (`/app`), styled-jsx is **not active** — the `@media print` block is **silently ignored**
- Result: `.a4-print-sheet` grid rules (`display: grid`, `grid-template-columns`, `grid-template-rows`) **never apply** at print time
- Labels render as plain block `<div>`, so only the first row appears as a horizontal strip at the top

### Bug 2 — `hidden print:block` conflicts with `display: grid`
- The print container uses Tailwind class `hidden print:block`
- `print:block` injects `display: block` in the print media query
- Even if Bug 1 were fixed, `display: block` would override `display: grid` on the sheet, collapsing the grid
- Correct behavior: visibility should be controlled by the CSS `visibility: hidden/visible` pattern — not `display`

### Bug 3 — `@page { margin: 0mm }` rule never reaches the browser
- Because Bug 1 blocks all styles from being injected, the `@page` zero-margin rule also fails
- Browser print dialog adds its own default margins (~10–12 mm), pushing all labels inward
- Labels are physically shifted off the sticker grid on the HERMA sheet

### Bug 4 — `transform: translate()` on the outer container breaks coordinates
- The calibration offset `transform` is applied to `#print-sheets-container`
- CSS `transform` on a `position: absolute` ancestor creates a new coordinate context
- This shifts the grid away from `left: 0; top: 0` (page origin) — labels miss their physical slot

---

## ✅ Fix Checklist

### Phase 1 — Move `@media print` CSS to `globals.css`

- [x] **1.1** Remove the entire `<style jsx global>{...}</style>` block from `BarcodeTagModal.tsx`
- [x] **1.2** Add all `@media print` rules to `src/app/globals.css`:
  - [x] `@page { size: A4 portrait; margin: 0mm; }` — eliminates browser default margins
  - [x] `html, body` reset for print (width: 210mm, height: 297mm, margin: 0, padding: 0)
  - [x] `.barcode-modal-wrapper` → `position: static; padding: 0; background: transparent`
  - [x] `body * { visibility: hidden }` — hides everything except the print container
  - [x] `#print-sheets-container, #print-sheets-container * { visibility: visible }` — shows only labels
  - [x] `#print-sheets-container { position: absolute; left: 0; top: 0; width: 210mm; margin: 0; padding: 0 }`
  - [x] `.a4-print-sheet { display: grid; grid-template-columns: repeat(4, 52.5mm); grid-template-rows: repeat(10, 29.7mm); width: 210mm; height: 297mm; page-break-after: always; break-after: page; margin: 0; padding: 0; overflow: hidden }`
  - [x] `.a4-print-sheet:last-child { page-break-after: avoid; break-after: avoid }`
  - [x] `.a4-print-cell { width: 52.5mm; height: 29.7mm; overflow: hidden; box-sizing: border-box }`

### Phase 2 — Fix the print container class in `BarcodeTagModal.tsx`

- [x] **2.1** Change `className="hidden print:block"` → `className="hidden"` (remove `print:block`)
  - Visibility is already controlled by `body * { visibility: hidden }` + `#print-sheets-container * { visibility: visible }`
  - Using Tailwind `print:block` would force `display: block`, collapsing the CSS grid

### Phase 3 — Fix the calibration offset `transform`

- [x] **3.1** Remove `transform: translate(offsetX mm, offsetY mm)` from the outer `#print-sheets-container` div
- [x] **3.2** Apply the same `transform` to each **inner** `.a4-print-sheet` div instead
  - The page container stays anchored at `left: 0; top: 0`
  - Only the label content shifts — printer calibration still works

### Phase 4 — Verify "Start Position" Logic Still Works

- [x] **4.1** Confirm `startPosition` state (1–40) correctly pre-fills empty cells before label data
- [x] **4.2** Confirm `buildPrintPages()` correctly computes `totalPages` and places labels at the right cell index
- [x] **4.3** Confirm empty/skipped cells render as full `52.5mm × 29.7mm` transparent divs (not `height: 0`)
  - Collapsed cells would shift following labels up and misalign the grid
- [x] **4.4** Verify the visual 4×10 grid preview in the UI still reflects start position correctly

### Phase 5 — Browser Print Dialog Settings (User Action — not code)

- [x] **5.1** In Chrome print dialog, confirm settings:
  - **Margins → None**
  - **Scale → 100% (Default)** — do NOT use "Fit to page"
  - **Paper size → A4**
  - **Background graphics → OFF**

### Phase 6 — Test & Validation

- [ ] **6.1** Print a **test/calibration page** on plain A4 paper first
  - Hold printed sheet over a blank HERMA sheet against light
  - All 40 numbered cells must align with the 40 physical sticker positions
- [ ] **6.2** Test **start position = 1** (full fresh sheet) — labels fill from top-left cell
- [ ] **6.3** Test **start position > 1** (partially used sheet) — empty cells appear correctly before labels
- [ ] **6.4** Test **multi-page print** (> 40 labels) — page break fires, second sheet fills from cell 1
- [ ] **6.5** Test **calibration offset sliders** (X/Y mm) — shift applies per sheet without breaking grid frame
- [ ] **6.6** Run `npx tsc --noEmit` — 0 TypeScript errors after all changes

---

## 📂 Files to Modify

| File | What Changes |
|---|---|
| `src/app/globals.css` | Add the full `@media print` block + `@page` rule |
| `src/components/pos/BarcodeTagModal.tsx` | Remove `<style jsx global>`, fix container class, move transform to inner sheet |

> **NOTE:** `SingleLabelItem` dimensions (52.5mm × 29.7mm) and content are already correct — no changes needed there.
> The entire issue is CSS injection method + container setup.

---

## 🎯 Expected Result After Fix

- All labels print precisely inside their physical sticker cells on the HERMA sheet ✓
- Zero-margin output — no browser-added whitespace shifting labels off the grid ✓
- Start position (1–40) correctly skips cells on a partially-used sheet ✓
- Multi-page jobs page-break cleanly between full sheets ✓
- Calibration X/Y mm sliders still work for fine-tuning printer hardware alignment ✓
