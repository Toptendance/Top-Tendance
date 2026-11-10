# Checklist: Multi-Item Selection for A4 Sticker Sheet Barcode Printing

## 1. Overview & Objective
Allow users in `/inventory` to select multiple variants across different products using checkboxes, choose how many labels to print for each item, and batch print them seamlessly on the HERMA A4/40 sticker sheets (4 columns × 10 rows).

---

## 2. Step-by-Step Implementation Plan

### A. Inventory Table Multi-Selection UI (`src/app/inventory/page.tsx`)
- [x] **Table Checkboxes:**
  - Add a "Select All" checkbox in the inventory table header.
  - Add individual checkboxes for each product variant row.
- [x] **Selection State Management:**
  - Track selected items: `selectedVariants: Map<variantId, { variant, quantity }>` or array of objects.
  - Provide a clear counter: "X article(s) sélectionné(s)".
- [x] **Batch Action Floating Toolbar / Header Bar:**
  - When 1 or more items are selected, show a floating action bar at the bottom (or above the table).
  - Actions:
    - "Imprimer les étiquettes sélectionnées" (with total label count badge).
    - "Désélectionner tout".

### B. Multi-Item Print Modal Updates (`src/components/pos/BarcodeTagModal.tsx`)
- [x] **Props Adaptation:**
  - Accept either a single variant or an array of items with quantities:
    `items: Array<{ variant: VariantInfo; quantity: number }>`
- [x] **Item Breakdown & Quantity Tuning List in Modal:**
  - Display a scrollable summary list of all selected items inside the modal.
  - Allow adjusting individual quantities per item right before printing (e.g., 3 of T-shirt M, 5 of T-shirt L, 2 of Pants 38).
  - Option to set a global quantity for all items at once (e.g., "1 copie chacun" or "remplir la feuille").
  - Quick action to remove an item from the batch without closing the modal.
- [x] **Total Count & Sheet Calculation:**
  - Calculate total labels = $\sum \text{quantity}_i$.
  - Display total pages needed: e.g., $\lceil (\text{startPosition} - 1 + \text{totalLabels}) / 40 \rceil$.
- [x] **Start Position on Reusable Sheets:**
  - Maintain the "Commencer à l'étiquette n°" field (1 to 40).
  - Skips empty slots on the first page, then fills each selected item sequentially up to its chosen quantity.
- [x] **4 × 10 Visualizer Enhancement:**
  - Preview how items are arranged across the grid (e.g., color-coded or item-keyed blocks).

### C. Multi-Page Print Layout Grid Engine
- [x] **Sequential Cell Populator:**
  - Flatten the queue of labels:
    `[ItemA, ItemA, ItemA, ItemB, ItemB, ItemC, ...]`
  - Insert empty cells for the starting offset (`startPosition - 1`).
  - Distribute sequentially across 40-cell pages (4 columns × 10 rows).
  - Pad the final page with empty cells to keep the 4 × 10 structure rigid.
- [x] **Print CSS `@media print` Integrity:**
  - Keep strict 52.5 mm × 29.7 mm cell dimensions.
  - Ensure zero margin, A4 page size, and auto page-breaks (`break-after: page`).
  - Preserve vector SVG barcodes (JsBarcode) for every printed cell.

### D. "Mark as Printed" Tracking & Inventory Integration
- [x] **Database / Schema Updates:**
  - Add `last_printed_at (TIMESTAMPTZ)` and/or `is_printed (BOOLEAN DEFAULT false)` to the `variants` table.
- [x] **Auto-Mark on Print:**
  - When the user confirms and triggers the print dialog from `BarcodeTagModal`, send a batch update to mark all printed variant IDs with `last_printed_at = NOW()` and `is_printed = true`.
- [x] **Manual Toggle & Status Badges:**
  - Add an indicator badge in the inventory table rows (e.g., green `✓ Imprimé` vs gray `Non imprimé`).
  - Allow toggling/clearing printed status manually per variant or in batch.
- [x] **Smart Inventory Filter & Selection:**
  - Add an inventory filter: **Tous | Non imprimés | Imprimés**.
  - Add a quick action button: **"Sélectionner tous les non imprimés"** to immediately batch-load all pending items into the sticker print queue.

### E. Verification & Testing
- [ ] Test selecting 3 different products with quantities 2, 4, and 1.
- [ ] Verify that labels print in the exact order requested.
- [ ] Test with start position > 1 (reusing a partially used sheet).
- [ ] Test multi-page rollover when total quantity exceeds 40.
- [ ] Test that printed items are automatically marked as printed after running print.
- [ ] Test inventory filtering by "Non imprimés" and "Sélectionner tous les non imprimés".
- [ ] Verify that douchette USB barcode scanner accurately scans each printed label.

