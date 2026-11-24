# Checklist: Bake 1.30 (130%) Scale into Code (Option A)

**Objective**: Bake the proven 1.30 (130%) scaling factor directly into CSS/code so that Chrome print Scale stays on **Default (100%)** with **Marges: Aucune (None)**, producing edge-to-edge alignment on HERMA 8698 stickers without manual zoom input.

---

## Verified Physical Test Baseline
- **Scale at 130% in Chrome**: Confirmed physically aligned inside the HERMA 8698 pre-cut sticker cuts.
- **Factor to apply**: $1.30$ ($130\%$).

---

## Checklist

### Phase 1: Update CSS Zoom Factor in `globals.css`
- [x] **1.1** In `src/app/globals.css`, locate `#print-sheets-container` inside `@media print`
- [x] **1.2** Change `zoom: 1.1428 !important;` to `zoom: 1.30 !important;`

### Phase 2: Update Calibration Offset Divisors in `BarcodeTagModal.tsx`
- [x] **2.1** In `src/components/pos/BarcodeTagModal.tsx`, update the offset style on `#print-sheets-container`:
  - `left: \`${offsetX / 1.30}mm\``
  - `top: \`${offsetY / 1.30}mm\``
- [x] **2.2** Update the modal UI guideline message:
  - Format: **A4**
  - Marges: **Aucune (None)**
  - Échelle: **100% (Par défaut / Default)**

### Phase 3: Build Verification & Testing
- [x] **3.1** Run `npx tsc --noEmit` and confirm exit code 0.
- [ ] **3.2** Open print modal on `localhost:3000/inventory` and trigger print.
- [ ] **3.3** Verify Chrome preview on **Scale: Default (100%)**:
  - 4 columns stretch edge-to-edge across the 210mm sheet.
  - Page count displays **1 sheet of paper**.
