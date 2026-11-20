# 🖨️ Print Scale Correction Fix Checklist
**Problem:** Chrome renders CSS `mm` units at 87.5% of physical mm on Canon G2010
**Effect:** 4 labels physically land on 3.5 sticker cells instead of 4
**Fix:** Apply correction factor `1.1428` (= 1 ÷ 0.875) in `@media print` CSS

---

## 📐 Diagnosis Summary

| Measurement | Value |
|---|---|
| Expected grid width (CSS) | 210mm (4 × 52.5mm) |
| Actual printed width at 100% | 183.75mm (3.5 × 52.5mm) |
| Chrome mm rendering factor | 0.875 (87.5%) |
| Required correction factor | **1.1428** (114.28%) |
| Verification at 150% scale | ✅ Confirmed — 3 labels fit + 4th half-cut |

---

## ❌ To Fix

### 1. Apply Correction Factor to `#print-sheets-container`

**File:** `src/app/globals.css`

- [x] In `@media print`, add `zoom: 1.1428` to `#print-sheets-container`
- [x] Keep all existing mm dimensions unchanged — the correction is applied at container level only

```css
/* BEFORE */
#print-sheets-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 210mm;
}

/* AFTER */
#print-sheets-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 210mm;
  zoom: 1.1428; /* corrects Chrome 87.5% mm rendering on Canon G2010 */
}
```

> [!NOTE] `zoom` is used over `transform: scale()` because `zoom` affects layout flow
> and keeps the element's physical footprint correct. `scale()` would shrink/expand
> visually but the element's layout box stays the same size, causing overflow issues.

---

### 2. Verify Calibration Offset Still Works

**File:** `src/components/pos/BarcodeTagModal.tsx`

The calibration offset (`left`/`top` on `#print-sheets-container`) was moved in the previous fix.
After applying `zoom`, the `left`/`top` offset values in mm will also be zoomed — meaning
a `1mm` offset input from the user will physically apply `1.1428mm` on paper.

- [x] Divide `offsetX` and `offsetY` by the correction factor before applying to the style,
  so user-entered `1mm` = physical `1mm`:

```tsx
style={{
  left: `${offsetX / 1.1428}mm`,
  top:  `${offsetY / 1.1428}mm`,
}}
```

> [!IMPORTANT] If the user has never used calibration offsets (both are 0), this step has
> no visible effect. But it must be done to keep calibration accurate for future use.

---

### 3. Test Page Verification

- [ ] Print calibration test page at **100% scale, No Margins, A4** in Chrome
- [ ] Confirm 4 columns span the full width of the HERMA sheet (all 4 columns align with sticker columns)
- [ ] Confirm 10 rows span the full height of the HERMA sheet (all 10 rows align with sticker rows)
- [ ] Print 4 real labels — confirm each label fills exactly 1 sticker cell

---

## ⚠️ What NOT to Change

- Do **not** change any `mm` dimension values in the grid or cells — they are physically correct
- Do **not** change `@page { size: A4; margin: 0mm }` — it is correct
- Do **not** change `html, body { width: 210mm; height: auto }` — it is correct
- The `zoom` fix goes **only** on `#print-sheets-container` inside `@media print`

---

## 🔬 Expected Result After Fix

| Scenario | Before Fix | After Fix |
|---|---|---|
| 4 labels at 100% Chrome scale | Spans 3.5 sticker cells | Spans exactly 4 sticker cells ✅ |
| Print dialog scale needed | 150% (broken) | 100% ✅ |
| Calibration offset 1mm input | Applies ~1.14mm physically | Applies exactly 1mm physically ✅ |
| Multi-page print | Pages misaligned | All pages uniformly correct ✅ |
