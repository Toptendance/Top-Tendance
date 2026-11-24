# Plan & Checklist — HERMA A4/40 Sticker Alignment Issue

## 1. Context

### Paper Specification
- **Paper**: HERMA TOP STICK A4/40 (4,000 labels — 100 sheets × 40 labels)
- **Sheet format**: A4 ($210\text{ mm} \times 297\text{ mm}$)
- **Grid**: 4 columns × 10 rows = 40 labels per sheet
- **Label size**: $52.5\text{ mm} \times 29.7\text{ mm}$, zero margins, edge-to-edge

---

## 2. What Was Working & Why

The `zoom: 1.1428` in [src/app/globals.css](file:///c:/Users/dell/Top%20Tendance/src/app/globals.css) was **deliberately added on Nov 20** to fix a Canon G2010 hardware quirk:

> **Canon G2010 renders CSS `mm` units at 87.5% physical size.**
> Without the zoom: 4 stickers at 4 × 52.5mm = 210mm would print at **183.75mm** (only 3.5 cells wide).
> With `zoom: 1.1428` = (1 ÷ 0.875): The 4 stickers fill the full **210mm** edge-to-edge. ✅

This was verified and working correctly at:
- **Scale**: Default 100%
- **Margins**: None
- **Paper**: A4

**The CSS code has NOT changed and is correct.**

---

## 3. Root Cause of the Current Issue

The CSS is still correct. The problem is in Chrome's saved printer settings, NOT in the code.

Chrome saves separate print settings per printer in its local profile. These can be reset or changed by:
- Chrome browser updates
- Switching between different print destinations (PDF vs Canon G2010)
- Accidentally changing Scale in the print dialog

---

## 4. Resolution Checklist (Chrome Settings — No Code Needed)

### Step 1: Open the Print Dialog
- [ ] Open the sticker print modal and click the **Imprimer** button.

### Step 2: Verify Destination
- [ ] Make sure **Destination** = **Canon G2010 series** (not Save as PDF).

### Step 3: Expand "More Settings"
- [ ] Click **More settings** to expand the full options panel.

### Step 4: Set Exact Settings
- [ ] **Paper size**: `A4`
- [ ] **Margins**: `None` (Aucune)
- [ ] **Scale**: `Default` (not Custom, not 115%, not Fit to page)
- [ ] **Pages per sheet**: `1`
- [ ] **Color**: Black and white

### Step 5: Verify Preview
- [ ] The 4 sticker labels in Row 1 should now span **the full width** of the A4 page from left edge to right edge with zero blank gap on the right.
- [ ] The page count should read **"1 sheet of paper"** (not 6).

### Step 6: Print
- [ ] Click **Print** and verify on the physical HERMA sticker sheet that each label aligns exactly with its pre-cut sticker cell.

---

## 5. What NOT to Change in Code

> [!CAUTION]
> Do NOT remove `zoom: 1.1428 !important` from `src/app/globals.css`.
> Do NOT remove `/ 1.1428` from `BarcodeTagModal.tsx`.
> These are required corrections for the Canon G2010 hardware. Removing them will cause stickers to print at 87.5% size (3.5 cells wide instead of 4).
