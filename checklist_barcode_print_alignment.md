# Plan & Checklist: Barcode Label Printing & Alignment (Planche A4 4x10)

## 1. Analysis of the User's Screenshot & Current Behavior

### Paper In Use:
- **Model**: **HERMA TOP STICK A4/40 (Ref 5066 / 8698 / 8740)**
- **Sheet Dimensions**: A4 (210 mm × 297 mm)
- **Label Dimensions**: 52.5 mm × 29.7 mm
- **Layout**: 4 columns × 10 rows = 40 labels / page
- **Physical Margins on Sheet**: **0 mm** all around:
  - $4 \times 52.5\text{ mm} = 210\text{ mm}$ (Zero left/right margin, 0 mm horizontal pitch)
  - $10 \times 29.7\text{ mm} = 297\text{ mm}$ (Zero top/bottom margin, 0 mm vertical pitch)

---

### Observed Symptoms in Print Preview (Canon G2010):
1. **Staircase / Indented Layout ("Escalier")**:
   - The preview shows 6 labels in total.
   - **Row 1**: Positions 1 & 2 are completely blank. Labels appear only in Positions 3 & 4.
   - **Row 2**: Positions 5, 6, 7 & 8 contain the remaining 4 labels.
   - **Cause**: In `BarcodeTagModal.tsx`, the `startPosition` is currently set to `3` (either typed in or accidentally clicked on cell #3 in the interactive 40-cell grid preview). The logic inserts `startPosition - 1` empty cells (`skip-0`, `skip-1`), shifting the labels onto cell #3 and #4 of the first row.
   - **Stock Quantity Multiplier**: `IDEALIS` printed 5 times and `MARQUIZ` printed 1 time because multi-select initialized `printQty` from `variant.stock_quantity`.

2. **Downwards & Left-Heavy Margin Drift (Regression Breakdown)**:
   - The first row of labels starts ~28–30mm below the top edge of the paper instead of the top edge.
   - Horizontally, the 4 columns span ~280px out of a 318px preview width (~88% coverage), leaving an exaggerated right margin (~31mm) and pushing the labels off-center.
   - **Key Root Causes Identified**:
     - **Containing Block Glitch in Chromium**: `#print-sheets-container` is currently nested inside `<div className="fixed inset-0 z-50 ... overflow-y-auto">`. In Chromium print rendering, a parent with `fixed`, `overflow`, or padding creates an arbitrary containing block offset instead of binding cleanly to page `(0,0)`.
     - **Cached LocalStorage Calibration**: `localStorage.getItem('herma_a4_offset_x')` and `_y` may have saved non-zero values during previous testing, silently translating (`transform: translate(X, Y)`) the print block.
     - **Canon G2010 Hardware Margins vs Borderless**: Canon G2010 inkjet printers physically enforce unprintable borders (~3.4mm sides, 3mm top, 5mm bottom) on plain paper. Chrome scales or displaces the 210×297mm layout to accommodate those margins unless "Sans bordure / Borderless" or exact 100% scale is applied.

---

## 2. Step-by-Step Implementation Checklist

### Phase 1: Clarification & Paper Format Confirmation
- [x] Confirm exact label paper brand and dimensions:
  - **HERMA TOP STICK A4/40 (52.5 × 29.7 mm)**
  - 4 columns × 10 rows (40 labels per sheet)
  - 0 mm top/bottom/left/right margins, 0 mm gap between labels
- [x] Confirm desired default behavior: Always start at position 1 (top-left) unless explicitly chosen by the user.

### Phase 2: Start Position & Visualizer Guardrails (`BarcodeTagModal.tsx`)
- [x] **Default Start Position Guarantee**:
  - `startPosition` is guaranteed to reset to `1` every time the modal opens or a new variant/batch is loaded.
  - Added a prominent "Remettre à la case 1" (Reset to #1) button next to the input.
- [x] **Accidental Click Prevention & Visual Alerts**:
  - Added clear visual badge: `Départ : Case #1 (Haut-Gauche)` when at position 1.
  - When `startPosition > 1`, a distinct alert banner is shown:
    `⚠️ Décalage actif (Planche entamée) : Les cases 1 à X seront laissées vides...` with a one-click `Annuler` button.
  - In the 40-cell grid preview, the active starting cell is highlighted with a focused ring when `startPosition > 1`.

### Phase 3: Print CSS & Printer Alignment Engine
- [x] **Standardize Page Box & Sizing in `@media print`**:
  - Neutralized the modal overlay in print mode (`.barcode-modal-wrapper` position: static, padding: 0, margin: 0, overflow: visible) to prevent Chrome scroll/padding coordinate drift.
  - Enforced `.a4-print-sheet` exact physical dimensions: `width: 210mm; min-height: 297mm; max-height: 297mm; height: 297mm`.
- [ ] **Fix Chrome "10 Sheets of Paper" Grid Bug**:
  - Replace `grid-template-rows: repeat(10, 29.7mm)` with a non-fragmenting layout (`display: flex; flex-wrap: wrap;`) so that all 10 rows (40 stickers) stay on **1 single sheet of paper** instead of Chrome breaking after each row.
  - Set `@page { size: 210mm 297mm !important; margin: 0mm !important; }` for exact millimeter scaling.
- [x] **Calibration & Offset Safety**:
  - Added a dedicated "Réinitialiser le décalage (0, 0)" button to easily wipe stale `herma_a4_offset_x` / `herma_a4_offset_y` values from `localStorage`.
  - Prominently displays the current active offset badge (`X: 0mm | Y: 0mm`).
  - Added a quick `Reset (0,0)` link whenever offsets are non-zero.
- [x] **Canon G2010 Specific Guidelines in UI**:
  - Added an inline helper guide in the modal UI:
    - *Format de papier : A4*
    - *Marges : Aucune (None)*
    - *Échelle : 100% (Par défaut / Ne pas adapter à la page)*
    - *Si décalage matériel Canon : activer "Sans bordure" ou utiliser l'ajusteur de décalage en mm.*

### Phase 4: Label Content & Barcode Density Polish
- [x] **Ensure barcode SVG rendering handles short and long barcodes without overflowing the `52.5mm × 29.7mm` cell**:
  - Dynamically calculates bar width based on barcode length (e.g. 1.05 for >16 chars, 1.2 for >13 chars, 1.35 for standard codes).
  - Automatically sets vector `viewBox` on the SVG to allow responsive scaling without distortion or bar clipping.
  - Guaranteed quiet zones on both sides for seamless reading by 1D laser & smartphone cameras.
- [x] **Keep text truncation and font sizes legible and crisp for barcode scanners**:
  - Clear product name display with bold uppercase styling and safety ellipsis truncation.
  - Crisp monospaced SKU and variant attributes (Size & Color).
  - High-contrast prices in DT with formatted monospace numerals.
  - Updated test page reference label to Canon G2010.

### Phase 5: Verification & Validation Testing
- [ ] Test printing starting at position 1 (should fill top-left immediately, 4 per row, no gaps).
- [ ] Test starting at position 3, 5, etc. (verifying intentional gap behavior).
- [ ] Test multi-product batch printing across multiple pages.
- [ ] Verify test calibration sheet on plain A4 paper overlaid onto the physical sticker sheet.
