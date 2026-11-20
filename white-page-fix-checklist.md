# 🖨️ Checklist — Fix White Page & Restore HERMA A4/40 Print View

## 1. Issue Description
- In print preview and "Save as PDF", the generated output is a **100% blank white page**.
- **Root Cause**: `#print-sheets-container` has Tailwind class `hidden` (`display: none`), and in `src/app/globals.css` under `@media print`, `#print-sheets-container` is missing `display: block !important`.
- In CSS, `visibility: visible` on child elements has **no effect** when an ancestor has `display: none`.

---

## 2. Implementation Steps

### Step 1: Update `src/app/globals.css`
- [x] Add `display: block !important;` to `#print-sheets-container` inside the `@media print` block.
- [x] Verify that `#print-sheets-container` retains:
  - `position: absolute !important;`
  - `left: 0 !important; top: 0 !important;`
  - `width: 210mm !important;`
  - `margin: 0 !important; padding: 0 !important;`
  - `box-sizing: border-box !important;`
  - `background: #ffffff !important;`

### Step 2: Update `src/components/pos/BarcodeTagModal.tsx`
- [x] Ensure `<div id="print-sheets-container" className="hidden print:block">` has `print:block` (or relies on the CSS rule in `globals.css`) so it is hidden on-screen but fully rendered during print.

### Step 3: TypeScript & Build Validation
- [x] Run `npx tsc --noEmit` to confirm 0 type errors.

---

## 3. Verification & Acceptance Criteria
- [ ] **Print Preview / Save as PDF**: Page is no longer blank white; tickets and barcodes are clearly visible.
- [ ] **HERMA A4/40 Grid Alignment**:
  - Labels render inside the 4-column × 10-row grid (52.5mm × 29.7mm per cell).
  - Selected tickets appear in the designated slots based on `startPosition`.
- [ ] **Start Position Verification**:
  - If printing 4 tickets starting at position #1: Cells 1 to 4 are filled, remaining cells are blank.
  - If printing 4 tickets starting at position #5: Cells 1 to 4 are skipped (empty), cells 5 to 8 are filled.
- [ ] **Multi-page Test**: More than 40 tickets properly page-break to a second A4 sheet.
