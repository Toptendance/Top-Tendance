# Checklist: Permanent Fix for HERMA 8698 on Canon G2010

## Post-Mortem: What Went Wrong

1. **Removing the Driver Compensation (`zoom: 1.1428`)**:
   - The Canon G2010 driver applies an internal downscale pipeline that shrinks 210mm of CSS content down to 183.75mm (87.5% ratio, covering only 3.5 stickers instead of 4).
   - When we removed `zoom: 1.1428` in an attempt to make Chrome show "Default" scale automatically, we removed the compensation factor. As a result, the physical output shrank to ~46 × 24 mm per label, causing cumulative drift across columns and rows.

2. **Using `transform: scale(1.1428)` as a Workaround**:
   - Unlike `zoom`, CSS `transform` visually scales elements without resizing the layout box for print pagination.
   - Chrome detected visual boundary overflow across the A4 page box and split the content into **24 sheets of paper**.

3. **Fighting Browser Cache by Editing Working CSS**:
   - Chrome aggressively remembers whatever scale was last selected for a printer (e.g., custom 115% or 150%).
   - When a cached custom scale caused overflow or pagination issues, we changed the underlying CSS instead of resetting Chrome to `Scale: Default (100%)` and `Margins: None`.

4. **Codebase Drift**:
   - Uncommitted modifications stripped the `@media print` rules from `src/app/globals.css` and replaced `BarcodeTagModal.tsx` with an experimental iframe approach that completely lacked the `1.1428` zoom compensation.

---

## Action Checklist

### Phase 1: Restore Core Print CSS in `globals.css`
- [x] **1.1** Re-add the `@media print` block in `src/app/globals.css` with:
  - `@page { size: A4 portrait; margin: 0mm; }`
  - Zero-margin reset on `html, body`
  - `#print-sheets-container` with `zoom: 1.1428 !important;`
  - `.a4-print-sheet` strict 4x10 CSS grid (`repeat(4, 52.5mm)`, `repeat(10, 29.7mm)`)
  - `.a4-print-cell` set to `52.5mm × 29.7mm`

### Phase 2: Restore Modal Component in `BarcodeTagModal.tsx`
- [x] **2.1** Revert `src/components/pos/BarcodeTagModal.tsx` to the clean DOM `#print-sheets-container` structure from commit `3cf54a9`.
- [x] **2.2** Verify offset sliders apply the inverse factor:
  - `left: \`${offsetX / 1.1428}mm\``
  - `top: \`${offsetY / 1.1428}mm\``
- [x] **2.3** Ensure the in-modal instructions clearly emphasize:
  - Format: **A4**
  - Marges: **Aucune (None)**
  - Échelle: **100% (Par défaut / Default)**

### Phase 3: Validation & Build Verification
- [x] **3.1** Run `npx tsc --noEmit` and confirm exit code 0.
- [ ] **3.2** Open the preview dialog in Chrome and verify:
  - Scale: **Default (100%)**
  - Margins: **None**
  - Total Pages: **1 sheet of paper**
  - 4 columns fill the printable width edge-to-edge.
