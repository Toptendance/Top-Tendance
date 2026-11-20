# 🏷️ Barcode Label Print Fix Checklist
**Target:** HERMA TOP STICK A4/40 · 52.5 × 29.7 mm · 4 col × 10 rows · Canon G2010 inkjet

---

## ✅ Already Done (Verified in Code)

- [x] **`@page { size: A4 portrait; margin: 0mm }`** — zero page margins set in `globals.css`
- [x] **`.a4-print-sheet` grid** — `repeat(4, 52.5mm)` × `repeat(10, 29.7mm)`, correct dimensions
- [x] **`.a4-print-cell` size** — `52.5mm × 29.7mm`, `box-sizing: border-box`, `overflow: hidden`
- [x] **`#print-sheets-container`** — `position: absolute; left: 0; top: 0`, `width: 210mm`
- [x] **Visibility toggle** — `body * { visibility: hidden }` / `#print-sheets-container * { visibility: visible }`
- [x] **Page break** — `page-break-after: always` on each `.a4-print-sheet`, `avoid` on last child
- [x] **JsBarcode `viewBox`** — dynamically set after render so SVG scales correctly
- [x] **`margin: 0`** on JsBarcode call — no internal barcode margin bleeding into cell
- [x] **Dynamic bar width** — adjusted by barcode length (1.05 → 1.35) to prevent clipping
- [x] **Start-at-label-N** — `startPosition` state, prepends N−1 empty `.a4-print-cell` elements ✅
- [x] **Calibration offset X/Y** — applied as `transform: translate(Xmm, Ymm)` on `.a4-print-sheet`, persisted in `localStorage` ✅
- [x] **Calibration UI** — toggle panel in modal with 0.5 mm step inputs and reset button ✅
- [x] **Test/calibration page** — numbered 40-cell grid with printer name, prints full sheet ✅
- [x] **Canon G2010 tips block** — recommends A4, No Margins, 100% scale in the UI ✅
- [x] **Multi-item batch printing** — quantity stepper per item, sheet visualizer, color-coded preview ✅

---

## ❌ Still To Fix

### 1. Label Content Doesn't Fill the Cell (Core Issue)

The `SingleLabelItem` component uses Tailwind mm-unit classes (`w-[52.5mm] h-[29.7mm]`) which are
correct on paper, but the **SVG barcode container** uses `w-auto h-auto` with `max-h-[14mm]`, which causes
the barcode to stay small. The `my-auto` on the barcode wrapper also pushes content rather than distributing space.

**File:** `src/components/pos/BarcodeTagModal.tsx` lines 92–128

- [x] **SVG barcode:** Change `<svg>` class to `w-full h-auto` (remove `w-auto`) with `max-h-[14mm]` kept — forces it to stretch to cell width
- [x] **Barcode wrapper `<div>`:** Remove `my-auto`; it fights `justify-content: space-between`. Use just `w-full flex justify-center items-center overflow-hidden`
- [x] **JsBarcode params:** Bump `height` from `36` → `40`, `fontSize` from `8.5` → `9`, `textMargin` from `1` → `2`
- [x] **Inner padding:** Reduce sides to `2.5mm` and confirm nothing clips on 52.5mm width
- [x] **Root `<div>` of `SingleLabelItem`:** Confirm `justify-between` + `items-center` fills full 29.7mm height

```tsx
// Target shape of SingleLabelItem root div:
<div
  className="w-[52.5mm] h-[29.7mm] bg-white flex flex-col justify-between box-border overflow-hidden"
  style={{ padding: '1.5mm 2.5mm' }}
>

// Barcode wrapper:
<div className="w-full flex justify-center items-center overflow-hidden">
  <svg ref={svgRef} className="w-full h-auto block" style={{ maxHeight: '14mm' }} />
</div>
```

---

### 2. Blank Extra Page (html/body height)

**File:** `src/app/globals.css` lines 45–54

- [x] Change `height: 297mm !important` on `html, body` → `height: auto !important`
  - Fixed 297mm forces a 2nd empty page whenever total content overflows even 1px

```css
/* BEFORE */
html, body {
  width: 210mm !important;
  height: 297mm !important;   /* ← causes blank page */
}

/* AFTER */
html, body {
  width: 210mm !important;
  height: auto !important;    /* ✅ no phantom extra page */
}
```

---

### 3. Calibration Offset Applied to Wrong Element

**File:** `src/components/pos/BarcodeTagModal.tsx` lines 309, 327

Currently the `transform: translate(Xmm, Ymm)` is applied **per `.a4-print-sheet`**.
This is problematic because:
- `transform` on a grid child can cause subpixel rounding issues per page
- Each page shifts independently (bad for multi-page jobs)

- [x] Move the `style={{ transform: ... }}` from `.a4-print-sheet` up to `#print-sheets-container` div
- [x] Use `left` / `top` offset instead of transform for more reliable print positioning:

```tsx
// On #print-sheets-container div — REPLACE className="hidden print:block" with:
<div
  id="print-sheets-container"
  className="hidden print:block"
  style={{ left: `${offsetX}mm`, top: `${offsetY}mm` }}
>

// Remove transform from EACH .a4-print-sheet:
<div key={`page-${pageIdx}`} className="a4-print-sheet">  {/* no style= */}
```

> NOTE: `#print-sheets-container` already has `position: absolute` in the print CSS,
> so `left`/`top` offsets will work correctly and affect all pages uniformly.

---

### 4. `.a4-print-cell` Missing `display: flex` in Print CSS

**File:** `src/app/globals.css` lines 112–118

The cell itself has no flex declaration in `@media print`. The child `SingleLabelItem` div
carries all the layout but the cell wrapper should explicitly stretch its child.

- [x] Add `display: flex !important` and `align-items: stretch !important` to `.a4-print-cell`:

```css
.a4-print-cell {
  width: 52.5mm !important;
  height: 29.7mm !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  background: #ffffff !important;
  display: flex !important;           /* ADD */
  align-items: stretch !important;    /* ADD: child fills full cell height */
}
```

---

## 🔬 Verification Steps

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open print modal, click **Page de test** | Chrome preview shows 40 numbered cells in 4×10 grid |
| 2 | Print test page on plain paper at 100%, No Margins | 4 columns × 10 rows fit exactly on A4 |
| 3 | Hold test page over HERMA sheet against light | Numbers align with sticker cells |
| 4 | If drift: use **Ajuster le décalage** sliders (0.5mm steps) | Offset saved, corrects all pages uniformly |
| 5 | Real label print (1 item, 1 copy) | Barcode fills ~90% of cell width, text readable, no clipping |
| 6 | Multi-page print (> 40 labels) | Each page correct, **no blank extra page** at end |
| 7 | Start-at-label test (set N = 5) | First 4 cells blank, label starts at position 5 |
| 8 | Partial sheet reuse (N = 13, row 2 col 1) | Print starts exactly at the right sticker |

---

## 🛠️ Implementation Order

```
1. Fix html/body → height: auto           (globals.css)
2. Fix .a4-print-cell → add display:flex  (globals.css)
3. Fix SingleLabelItem SVG → w-full       (BarcodeTagModal.tsx)
4. Fix barcode wrapper → remove my-auto   (BarcodeTagModal.tsx)
5. Move offset → #print-sheets-container  (BarcodeTagModal.tsx)
6. Test page print verification           (plain paper)
7. Light-table alignment test             (HERMA sheet)
```

---

## 📐 Reference: HERMA A4/40 Physical Spec

| Property | Value |
|----------|-------|
| Sheet size | 210 × 297 mm (A4) |
| Label size | 52.5 × 29.7 mm |
| Columns | 4 |
| Rows | 10 |
| Labels per sheet | 40 |
| All margins & gaps | 0 mm |
| Safe inner padding | ~1.5mm top/bottom, ~2.5mm left/right |

> **IMPORTANT:** Chrome must be set to **No margins** and **100% scale** in the print dialog.
> Never use "Fit to page" — it rescales the grid and breaks physical alignment.

> **TIP:** After any CSS change, always do a **hard reload** (`Ctrl+Shift+R`) before printing,
> as Chrome aggressively caches print stylesheets.
