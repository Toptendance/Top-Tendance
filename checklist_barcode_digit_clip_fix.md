# Checklist — Fix: Barcode Digits Clipped on Edge-Row Labels

**Component:** `src/components/pos/BarcodeTagModal.tsx`
**Date:** 2026-11-26
**Status:** ⬜ Not started

---

## Context

On a real print, the digits under the barcodes are cut in half in edge cells
(top row, bottom row, left column, right column). Interior cells are fine.
Margins in `globals.css` are correct — do not touch them.

---

## What JsBarcode 3.12.3 actually writes (confirmed from source)

**Installed version:** `3.12.3` (`node_modules/jsbarcode/package.json`)

The SVG renderer (`node_modules/jsbarcode/bin/renderers/svg.js`, `setSvgAttributes`):

```js
svg.setAttribute("width",   width  + "px");   // e.g. "246px"
svg.setAttribute("height",  height + "px");   // e.g. "52px"
svg.setAttribute("viewBox", "0 0 " + width + " " + height); // e.g. "0 0 246 52"  ✅ unitless
```

**Key finding:** JsBarcode already writes a **valid, unitless `viewBox`** (`"0 0 246 52"`).
The `width` and `height` attributes do carry `px` suffixes, but that is legal on SVG attributes.
The `viewBox` itself is correct and does not need to be rewritten.

---

## Root Cause (revised)

The custom post-processing block in the `useEffect` **reads back the `width` and `height` attributes**
(which are `"246px"`, `"52px"`) and **replaces the already-valid `viewBox`** with:

```
viewBox="0 0 246px 52px"   ← INVALID — overwrites JsBarcode's correct value
```

The `viewBox` attribute must contain bare numbers with no units.
A browser that receives `"0 0 246px 52px"` discards it or treats the SVG as having no intrinsic
aspect ratio. With no valid ratio, `h-auto` cannot compute a height from the CSS width, so the SVG
either renders at its native pixel height or collapses — and when that height exceeds `maxHeight`,
the digit row at the bottom is clipped by the `overflow-hidden` wrapper.

Interior cells have enough `maxHeight` budget to survive; edge cells do not, which is exactly
the observed failure pattern.

---

## Checklist

### Step 1 — Delete the custom `viewBox` override block [x] Done

**File:** [`src/components/pos/BarcodeTagModal.tsx`](file:///c:/Users/dell/Top%20Tendance/src/components/pos/BarcodeTagModal.tsx#L82-L87)
**Lines to remove:** 82–87

The entire block below serves no purpose: JsBarcode already wrote a correct `viewBox`.
Removing it stops the override that made it invalid.

**Before (lines 82–87 — delete this block entirely):**
```tsx
        // Set viewBox for responsive vector scaling without distortion or clipping
        const widthAttr = svgRef.current.getAttribute('width');
        const heightAttr = svgRef.current.getAttribute('height');
        if (widthAttr && heightAttr) {
          svgRef.current.setAttribute('viewBox', `0 0 ${widthAttr} ${heightAttr}`);
        }
```

**After (nothing — the six lines above are simply removed):**
```tsx
        // JsBarcode 3.12.3 already writes a valid unitless viewBox; no override needed.
```

> Leave a one-line comment so a future developer does not re-add the block.

---

### Step 2 — Set `width: '43mm'` for ALL cells, remove `isEdgeCell` condition [x] Done

**File:** [`src/components/pos/BarcodeTagModal.tsx`](file:///c:/Users/dell/Top%20Tendance/src/components/pos/BarcodeTagModal.tsx#L136-L145)

With a valid `viewBox` restored, the SVG scales proportionally to any CSS width.
Using `width: '100%'` on interior cells means the barcode fills whatever space the flex
column gives it — which varies by browser zoom and DPI rounding. Fixing all cells to
`43mm` gives every label the same, predictable quiet-zone width regardless of position.

Check whether `isEdgeCell` (line 55) is used anywhere else in the component. It is only
used in this one `style` prop, so it can be removed together with the condition.

**Before (lines 136–145):**
```tsx
      {/* Code128 Vector Barcode SVG with guaranteed quiet zones */}
      <div className="w-full flex justify-center items-center overflow-hidden">
        <svg
          ref={svgRef}
          className="h-auto block"
          style={{
            width: isEdgeCell ? '43mm' : '100%',
            maxHeight: svgMaxHeight,
          }}
        />
      </div>
```

**After:**
```tsx
      {/* Code128 Vector Barcode SVG with guaranteed quiet zones */}
      <div className="w-full flex justify-center items-center overflow-hidden">
        <svg
          ref={svgRef}
          className="h-auto block"
          style={{
            width: '43mm',
            maxHeight: svgMaxHeight,
          }}
        />
      </div>
```

Also remove the now-unused `isEdgeCell` derived variable (line 55):

**Before (line 55):**
```tsx
  const isEdgeCell = isTopRow || isBottomRow || isLeftCol || isRightCol;
```

**After (delete the line):**
```
  (line removed — isEdgeCell no longer used)
```

---

### Step 3 — Manual print test

- [ ] Print one full A4 sheet (all 40 cells filled with real barcodes)
- [ ] Verify digits are **fully visible** in all four corner cells, all top-row cells,
      all bottom-row cells, all left-column cells, all right-column cells
- [ ] Verify bars are not stretched or distorted in any cell
- [ ] Verify quiet zones (blank space left and right of bars) are present and roughly even
- [ ] Verify interior cells are still correct and unchanged
- [ ] If digit clipping remains after Step 1–2, inspect the SVG `viewBox` in browser DevTools
      (should be `"0 0 <number> <number>"` with no units) to confirm the override is gone

---

## What could break and how to check it

| Risk | Likelihood | How to detect | How to handle |
|------|------------|--------------|---------------|
| `43mm` SVG wider than the usable area in a narrow interior cell after padding change | Low — interior cells have `2.5mm` padding each side → `52.5 − 5 = 47.5mm` usable, so `43mm` fits | Check that the barcode is not cut on left/right in interior cells on a real print | Reduce to `41mm` if needed |
| `h-auto` still cannot compute height if another CSS rule overrides `viewBox` | Unlikely | Open DevTools → inspect SVG → confirm `viewBox` has no `px` units | Remove any other post-render setAttribute call |
| `isEdgeCell` removal misses a usage | None — only used in the one style prop | Search the file for `isEdgeCell` before deleting | Keep the variable if another usage is found |

---

## Do Not Touch

- `globals.css` — `@page`, grid, cell dimensions, `overflow: hidden`, `zoom: 1.30`
- `paddingTop / paddingBottom / paddingLeft / paddingRight` per-row/col logic
- `jsBarcodeHeight`, `jsBarcodeFontSize`, `jsBarcodeTextMargin` per-row tuning
- `maxHeight` values (`10.5mm`, `11.5mm`, `14mm`)
- `margin: 0` in JsBarcode options
- All other JsBarcode options (`barWidth`, `height`, `fontSize`, `textMargin`, `format`)

---

## Files to Edit

| File | What changes |
|------|-------------|
| `src/components/pos/BarcodeTagModal.tsx` | **Step 1:** Delete the 6-line `viewBox` override block (lines 82–87) |
| `src/components/pos/BarcodeTagModal.tsx` | **Step 2a:** Change `width: isEdgeCell ? '43mm' : '100%'` → `width: '43mm'` (line 141) |
| `src/components/pos/BarcodeTagModal.tsx` | **Step 2b:** Delete `const isEdgeCell = ...` (line 55) |
