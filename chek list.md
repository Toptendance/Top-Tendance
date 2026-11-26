# Plan & Checklist: Canon G2010 A4 Outer-Edge Label Printing Fix

**Project**: Top Tendance  
**Target Printer**: Canon PIXMA G2010 (Inkjet)  
**Target Sheet**: HERMA 8698 (A4, 40 labels, 4 columns × 10 rows, 52.5 × 29.7 mm)  
**Document**: `chek list.md`  
**Status**: PLAN ONLY (Awaiting user approval before any code modifications)

---

## 1. Problem Statement & Context

### Physical Symptoms on Paper (Canon G2010)
Even though the generated PDF preview is correct on screen:
1. **Top Row (Row 0)**: Content is physically cut off at the top edge of the sheet.
2. **Left Column (Col 0)**: Leftmost text characters are slightly clipped.
3. **Bottom Row (Row 9)**: Barcodes are distorted and the footer ("Top Tendance" + Price) is missing/cut off.
   * *Note*: The exact cause of the bottom barcode distortion is unconfirmed until a physical print test. The 7mm bottom margin moves the content out of the printer's mechanical paper-exit roller zone.
4. **Interior Cells (Rows 1–8, Cols 1–2)**: Print with high quality and correct alignment.

### Key Print Calibration Factors
- In the generated PDF, the column pitch is approximately $52.3\text{ mm}$ for a $52.5\text{ mm}$ CSS cell, confirming the effective output scale is $\approx 1.0$.
- `zoom: 1.30 !important;` in `src/app/globals.css` is retained **strictly unchanged**.
- **Do NOT divide safe margins by 1.30**. All edge margins are applied directly in CSS millimeters.
- The test page is left unchanged and removed from this plan; physical testing is conducted directly on plain paper using products already marked as printed.
- Testing must **never** call `handlePrint(false)`, which marks products as printed in the database before the print dialog opens.

---

## 2. Strict Invariants (Unchanged Parameters)

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| **Page Format** | `A4 portrait` (`210mm × 297mm`) | Standard HERMA 8698 sheet size |
| **Grid Layout** | 4 columns × 10 rows (40 cells) | Exact physical sticker layout |
| **Cell Dimensions** | `52.5mm × 29.7mm` | Physical sticker cut dimension |
| **CSS Zoom Factor** | `zoom: 1.30 !important;` | Required driver compensation ratio |
| **Calibration Offsets** | `offsetX`, `offsetY` (in `localStorage`) | Hardware alignment sliders |
| **Barcode Data** | Dynamic variant barcode (EAN-13 / SKU) | Unaltered data payload |
| **Barcode Symbology**| `CODE128` | Scanner compatibility |

---

## 3. Direct Edge Clearances & Padding Geometry

Outer safe margins are applied directly in CSS:
- **Top Row**: `padding-top: 5mm` (bottom padding: `1.0mm`)
- **Bottom Row**: `padding-bottom: 7mm` (top padding: `1.0mm`)
- **Left Column**: `padding-left: 5mm` (right padding: `2.5mm`)
- **Right Column**: `padding-right: 5mm` (left padding: `2.5mm`)
- **Interior Cells** (Rows 1–8, Cols 1–2): standard `padding: '1.5mm 2.5mm'`

### Geometry & Height Recalculation Table

Total cell height: **$29.7\text{ mm}$**, width: **$52.5\text{ mm}$**.

| Cell Position | Padding (T, B, L, R) | Usable Width | Usable Height | Content Breakdown (Header + Barcode + Footer) | Vertical Buffer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Interior** (r 1–8, c 1–2) | `1.5mm`, `1.5mm`, `2.5mm`, `2.5mm` | $47.5\text{ mm}$ | $26.7\text{ mm}$ | Header $5.6\text{ mm}$ + SVG $13.5\text{ mm}$ (max 14) + Footer $3.8\text{ mm} = 22.9\text{ mm}$ | $+3.8\text{ mm}$ |
| **Top Row** (r 0, c 1–2) | `5.0mm`, `1.0mm`, `2.5mm`, `2.5mm` | $47.5\text{ mm}$ | $23.7\text{ mm}$ | Header $5.6\text{ mm}$ + SVG $10.4\text{ mm}$ (max 11.5) + Footer $3.8\text{ mm} = 19.8\text{ mm}$ | $+3.9\text{ mm}$ |
| **Bottom Row** (r 9, c 1–2) | `1.0mm`, `7.0mm`, `2.5mm`, `2.5mm` | $47.5\text{ mm}$ | $21.7\text{ mm}$ | Header $5.3\text{ mm}$ + SVG $9.8\text{ mm}$ (max 10.5) + Footer $3.5\text{ mm} = 18.6\text{ mm}$ | $+3.1\text{ mm}$ |
| **Left Col** (r 1–8, c 0) | `1.5mm`, `1.5mm`, `5.0mm`, `2.5mm` | $45.0\text{ mm}$ | $26.7\text{ mm}$ | Header $5.6\text{ mm}$ + SVG $13.5\text{ mm}$ (max 14) + Footer $3.8\text{ mm} = 22.9\text{ mm}$ | $+3.8\text{ mm}$ |
| **Right Col** (r 1–8, c 3) | `1.5mm`, `1.5mm`, `2.5mm`, `5.0mm` | $45.0\text{ mm}$ | $26.7\text{ mm}$ | Header $5.6\text{ mm}$ + SVG $13.5\text{ mm}$ (max 14) + Footer $3.8\text{ mm} = 22.9\text{ mm}$ | $+3.8\text{ mm}$ |
| **Top-Left** (r 0, c 0) | `5.0mm`, `1.0mm`, `5.0mm`, `2.5mm` | $45.0\text{ mm}$ | $23.7\text{ mm}$ | Header $5.6\text{ mm}$ + SVG $10.4\text{ mm}$ (max 11.5) + Footer $3.8\text{ mm} = 19.8\text{ mm}$ | $+3.9\text{ mm}$ |
| **Top-Right** (r 0, c 3) | `5.0mm`, `1.0mm`, `2.5mm`, `5.0mm` | $45.0\text{ mm}$ | $23.7\text{ mm}$ | Header $5.6\text{ mm}$ + SVG $10.4\text{ mm}$ (max 11.5) + Footer $3.8\text{ mm} = 19.8\text{ mm}$ | $+3.9\text{ mm}$ |
| **Bottom-Left** (r 9, c 0) | `1.0mm`, `7.0mm`, `5.0mm`, `2.5mm` | $45.0\text{ mm}$ | $21.7\text{ mm}$ | Header $5.3\text{ mm}$ + SVG $9.8\text{ mm}$ (max 10.5) + Footer $3.5\text{ mm} = 18.6\text{ mm}$ | $+3.1\text{ mm}$ |
| **Bottom-Right** (r 9, c 3) | `1.0mm`, `7.0mm`, `2.5mm`, `5.0mm` | $45.0\text{ mm}$ | $21.7\text{ mm}$ | Header $5.3\text{ mm}$ + SVG $9.8\text{ mm}$ (max 10.5) + Footer $3.5\text{ mm} = 18.6\text{ mm}$ | $+3.1\text{ mm}$ |

*Confirmation*: In all edge positions, total vertical content is smaller than usable height by at least $3.1\text{ mm}$. No clipping or overlap occurs.

---

## 4. Barcode Sizing, Width & Quiet Zones

To prevent barcodes from becoming noticeably narrower when `maxHeight` is lowered:
1. **SVG Width**:
   - For all edge cells (top row, bottom row, left column, right column): set SVG width to **`43mm`** centered inside the cell.
   - For interior cells: SVG width remains **`100%`** (`w-full`).
2. **JsBarcode Bar Heights**:
   - **Top row**: `height: 30`
   - **Bottom row**: `height: 28`
   - **Side-column cells in other rows**: `height: 40`
   - **Interior cells**: `height: 40`
3. **SVG `maxHeight`**:
   - **Top row**: `maxHeight: '11.5mm'`
   - **Bottom row**: `maxHeight: '10.5mm'`
   - **Other rows**: `maxHeight: '14mm'`
4. **Quiet Zones ($\ge 10$ bar modules blank space)**:
   - A standard 13-digit CODE128 barcode has $\approx 123$ modules. Across $43\text{ mm}$, 1 module $\approx 0.35\text{ mm}$, so 10 modules $\approx 3.5\text{ mm}$.
   - Edge columns have usable width $45.0\text{ mm}$. Centering a $43.0\text{ mm}$ SVG leaves $1.0\text{ mm}$ internal gap $+ 2.5\text{ mm}$ inner padding $= 3.5\text{ mm}$ inner clearance ($\ge 10$ modules), and $1.0\text{ mm} + 5.0\text{ mm} = 6.0\text{ mm}$ outer clearance ($> 17$ modules).
   - For longer barcodes ($>16$ chars), `barWidth` drops to `1.05`, increasing module density, so 10 modules require $\le 2.5\text{ mm}$ blank space, which is fully satisfied.
5. **`useEffect` Dependencies**:
   - All row-dependent values (`jsBarcodeHeight`, `isTopRow`, `isBottomRow`, etc.) are included in the dependency array so JsBarcode re-renders cleanly when positions change.

---

## 5. Step-by-Step Implementation Plan

### Step 1: Prop Plumbing & JSX Page Loop Coordinate Mapping
* **File**: `src/components/pos/BarcodeTagModal.tsx`
* **Goal**: Add `rowIndex` and `colIndex` to `SingleLabelItemProps`. Map row and column in the JSX printing loop where the cell index restarts at 0 on every page.
* **Exact Code Before** (`src/components/pos/BarcodeTagModal.tsx`, lines 25–45):
```tsx
interface SingleLabelItemProps {
  productName: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  selling_price: number;
  isTest?: boolean;
  cellIndex?: number;
}

export function SingleLabelItem({
  productName,
  sku,
  barcode,
  size,
  color,
  selling_price,
  isTest = false,
  cellIndex,
}: SingleLabelItemProps) {
```
* **Exact Code After**:
```tsx
interface SingleLabelItemProps {
  productName: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  selling_price: number;
  isTest?: boolean;
  cellIndex?: number;
  rowIndex?: number;
  colIndex?: number;
}

export function SingleLabelItem({
  productName,
  sku,
  barcode,
  size,
  color,
  selling_price,
  isTest = false,
  cellIndex,
  rowIndex = 1,
  colIndex = 1,
}: SingleLabelItemProps) {
  const isTopRow = rowIndex === 0;
  const isBottomRow = rowIndex === 9;
  const isLeftCol = colIndex === 0;
  const isRightCol = colIndex === 3;
```
* **Exact Code Before** (`src/components/pos/BarcodeTagModal.tsx`, lines 325–345):
```tsx
          printPages.map((page, pageIdx) => (
            <div key={`page-${pageIdx}`} className="a4-print-sheet">
              {page.map((cell) => (
                <div key={cell.id} className="a4-print-cell">
                  {cell.type === 'label' && cell.item ? (
                    <SingleLabelItem
                      productName={cell.item.productName}
                      sku={cell.item.sku}
                      barcode={cell.item.barcode}
                      size={cell.item.size}
                      color={cell.item.color}
                      selling_price={cell.item.selling_price}
                    />
                  ) : (
                    // Blank placeholder cell for alignment
                    <div className="w-[52.5mm] h-[29.7mm] bg-transparent" />
                  )}
                </div>
              ))}
            </div>
          ))
```
* **Exact Code After**:
```tsx
          printPages.map((page, pageIdx) => (
            <div key={`page-${pageIdx}`} className="a4-print-sheet">
              {page.map((cell, cellIndexInPage) => (
                <div key={cell.id} className="a4-print-cell">
                  {cell.type === 'label' && cell.item ? (
                    <SingleLabelItem
                      productName={cell.item.productName}
                      sku={cell.item.sku}
                      barcode={cell.item.barcode}
                      size={cell.item.size}
                      color={cell.item.color}
                      selling_price={cell.item.selling_price}
                      rowIndex={Math.floor(cellIndexInPage / 4)}
                      colIndex={cellIndexInPage % 4}
                    />
                  ) : (
                    // Blank placeholder cell for alignment
                    <div className="w-[52.5mm] h-[29.7mm] bg-transparent" />
                  )}
                </div>
              ))}
            </div>
          ))
```
* **What could break**: If `cellIndexInPage` did not restart at 0 on page 2+, row index would exceed 9 on later pages. Using `page.map((cell, cellIndexInPage) => ...)` ensures `cellIndexInPage` strictly spans $0 \dots 39$ on every page.
* **How to check**: Run `npx tsc --noEmit` to verify type agreement. Inspect React component props on multi-page queues to confirm page 2 has cell 0 mapped to `rowIndex=0, colIndex=0`.

---

### Step 2: Dynamic Edge Padding Implementation in `SingleLabelItem`
* **File**: `src/components/pos/BarcodeTagModal.tsx`
* **Goal**: Apply `padding-top: 5mm`, `padding-bottom: 7mm`, `padding-left: 5mm`, and `padding-right: 5mm` directly to outer edge cells while retaining standard interior padding.
* **Exact Code Before** (`src/components/pos/BarcodeTagModal.tsx`, lines 92–96):
```tsx
  return (
    <div
      className="w-[52.5mm] h-[29.7mm] bg-white flex flex-col justify-between items-center text-center select-none box-border overflow-hidden"
      style={{ padding: '1.5mm 2.5mm' }}
    >
```
* **Exact Code After**:
```tsx
  const paddingTop = isTopRow ? '5mm' : isBottomRow ? '1.0mm' : '1.5mm';
  const paddingBottom = isBottomRow ? '7mm' : isTopRow ? '1.0mm' : '1.5mm';
  const paddingLeft = isLeftCol ? '5mm' : '2.5mm';
  const paddingRight = isRightCol ? '5mm' : '2.5mm';

  return (
    <div
      className="w-[52.5mm] h-[29.7mm] bg-white flex flex-col justify-between items-center text-center select-none box-border overflow-hidden"
      style={{
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
      }}
    >
```
* **What could break**: Total cell size expanding if `box-sizing: border-box` is violated. Because `box-border` and `.a4-print-cell` have explicit `52.5mm × 29.7mm` dimensions, internal padding only affects content safe area without altering outer grid boundaries.
* **How to check**: Open browser dev tools and verify computed CSS padding for:
  - Cell 1 (top-left): `5mm 2.5mm 1mm 5mm`
  - Cell 4 (top-right): `5mm 5mm 1mm 2.5mm`
  - Cell 37 (bottom-left): `1mm 2.5mm 7mm 5mm`
  - Cell 40 (bottom-right): `1mm 5mm 7mm 2.5mm`
  - Cell 6 (interior): `1.5mm 2.5mm 1.5mm 2.5mm`

---

### Step 3: Barcode Vector Geometry, Width & Spacing Optimization
* **File**: `src/components/pos/BarcodeTagModal.tsx`
* **Goal**: Keep barcodes scannable and wide ($\approx 43\text{ mm}$) with $\ge 10$ modules quiet zone, without horizontal shrinkage, and update `useEffect` dependencies.
* **Exact Code Before** (`src/components/pos/BarcodeTagModal.tsx`, lines 48–77, 111–114):
```tsx
  useEffect(() => {
    if (svgRef.current && barcode && !isTest) {
      try {
        const cleanBarcode = barcode.trim();
        const barcodeLength = cleanBarcode.length;
        // Dynamically optimize bar width so both short and long barcodes fit perfectly without clipping
        const barWidth = barcodeLength > 16 ? 1.05 : barcodeLength > 13 ? 1.2 : 1.35;

        JsBarcode(svgRef.current, cleanBarcode, {
          format: 'CODE128',
          width: barWidth,
          height: 40, // ~10-11mm height for fast laser/camera scanner decoding
          displayValue: true,
          fontSize: 9,
          font: 'monospace',
          textMargin: 2,
          margin: 0,
        });

        // Set viewBox for responsive vector scaling without distortion or clipping
        const widthAttr = svgRef.current.getAttribute('width');
        const heightAttr = svgRef.current.getAttribute('height');
        if (widthAttr && heightAttr) {
          svgRef.current.setAttribute('viewBox', `0 0 ${widthAttr} ${heightAttr}`);
        }
      } catch (err) {
        console.error('JsBarcode render error in SingleLabelItem:', err);
      }
    }
  }, [barcode, isTest]);
...
      {/* Code128 Vector Barcode SVG with guaranteed quiet zones */}
      <div className="w-full flex justify-center items-center overflow-hidden">
        <svg ref={svgRef} className="w-full h-auto block" style={{ maxHeight: '14mm' }} />
      </div>
```
* **Exact Code After**:
```tsx
  const isEdgeCell = isTopRow || isBottomRow || isLeftCol || isRightCol;
  const jsBarcodeHeight = isBottomRow ? 28 : isTopRow ? 30 : 40;
  const jsBarcodeFontSize = isBottomRow ? 8 : isTopRow ? 8.5 : 9;
  const jsBarcodeTextMargin = isBottomRow || isTopRow ? 1 : 2;
  const svgMaxHeight = isBottomRow ? '10.5mm' : isTopRow ? '11.5mm' : '14mm';

  useEffect(() => {
    if (svgRef.current && barcode && !isTest) {
      try {
        const cleanBarcode = barcode.trim();
        const barcodeLength = cleanBarcode.length;
        // Dynamically optimize bar width so both short and long barcodes fit perfectly without clipping
        const barWidth = barcodeLength > 16 ? 1.05 : barcodeLength > 13 ? 1.2 : 1.35;

        JsBarcode(svgRef.current, cleanBarcode, {
          format: 'CODE128',
          width: barWidth,
          height: jsBarcodeHeight,
          displayValue: true,
          fontSize: jsBarcodeFontSize,
          font: 'monospace',
          textMargin: jsBarcodeTextMargin,
          margin: 0,
        });

        // Set viewBox for responsive vector scaling without distortion or clipping
        const widthAttr = svgRef.current.getAttribute('width');
        const heightAttr = svgRef.current.getAttribute('height');
        if (widthAttr && heightAttr) {
          svgRef.current.setAttribute('viewBox', `0 0 ${widthAttr} ${heightAttr}`);
        }
      } catch (err) {
        console.error('JsBarcode render error in SingleLabelItem:', err);
      }
    }
  }, [barcode, isTest, jsBarcodeHeight, jsBarcodeFontSize, jsBarcodeTextMargin]);
...
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
And typography fine-tuning in header/footer (lines 98–121):
```tsx
// Before (line 99):
<p className="text-[9px] font-black uppercase tracking-tight text-black truncate w-full" title={productName}>
// After:
<p className={`${isBottomRow ? 'text-[8.5px]' : 'text-[9px]'} font-black uppercase tracking-tight text-black truncate w-full`} title={productName}>

// Before (line 118):
<span className="text-[10px] font-black text-black font-mono tracking-tight">
// After:
<span className={`${isBottomRow ? 'text-[9.5px]' : 'text-[10px]'} font-black text-black font-mono tracking-tight`}>
```
* **What could break**: Stale closure if `jsBarcodeHeight` is omitted from `useEffect` dependencies (fixed by including all row-dependent settings in dependencies).
* **How to check**: Inspect rendered SVG elements in the browser: confirm that top-row, bottom-row, and edge-column barcodes have width `43mm`, vector bar heights match `30` and `28`, and bottom row footer text is clearly visible above the 7mm margin.

---

### Step 4: Verification & Validation (Safe Non-Destructive Checks)
* **Goal**: Validate type safety, grid geometry, and PDF 40-cell integrity without calling `handlePrint(false)`.
* **Testing Protocol**:
  1. **Build Check**: Run `npx tsc --noEmit` and confirm exit code 0.
  2. **Code Diff Review**: Review git diff of `src/components/pos/BarcodeTagModal.tsx` to verify zero unintended edits.
  3. **Print Layout Inspection in Browser**:
     - User opens modal with items already marked as printed in the inventory.
     - Inspect DOM elements and Chrome Print Preview on **Scale: Default (100%)**, **Margins: None**:
       - Page count is strictly **1 sheet of paper** (40 labels).
       - Top row content sits $\ge 5\text{ mm}$ below the top edge.
       - Bottom row content (shop name and price) sits $\ge 7\text{ mm}$ above the bottom edge.
       - Left column content sits $\ge 5\text{ mm}$ right of the left edge.
       - Right column content sits $\ge 5\text{ mm}$ left of the right edge.
       - Barcode SVGs on edge rows and columns measure $43\text{ mm}$ centered with $\ge 10$ modules quiet zone.
  4. **Database Safety Confirmation**: Confirm that no database RPC or `handleVariantsPrinted` was executed.

---

## 6. Action Checklist (Implementation Steps)

- [ ] **Step 1**: Add `rowIndex` and `colIndex` to `SingleLabelItemProps` and update `page.map((cell, cellIndexInPage) => ...)` loop in `src/components/pos/BarcodeTagModal.tsx`.
- [ ] **Step 2**: Implement dynamic edge padding (`5mm` top, `7mm` bottom, `5mm` left/right) in `SingleLabelItem` in `src/components/pos/BarcodeTagModal.tsx`.
- [ ] **Step 3**: Implement dynamic `jsBarcodeHeight`, `svgMaxHeight`, `width: 43mm`, and update `useEffect` dependencies in `SingleLabelItem` in `src/components/pos/BarcodeTagModal.tsx`.
- [ ] **Step 4**: Run TypeScript check (`npx tsc --noEmit`) and verify DOM layout and single-page A4 print preview.
