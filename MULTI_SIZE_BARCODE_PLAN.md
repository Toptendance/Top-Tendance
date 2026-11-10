# Implementation Plan: Multi-Size Batch Creation & Unique Barcodes/QRs

## Overview
When adding a product in `/inventory`, reuse the existing category selection (no duplicate category logic). Enable adding a range of sizes (e.g. shoes 36 to 40, apparel XS–XXL) in one click without doing it one by one, with an auto-generated unique barcode/QR for each size variant.

---

## Step-by-Step Implementation Checklist

- [x] **1. Barcode Utility (`src/utils/barcodeGenerator.ts`)**
  - Unique barcode generator (Code-128 / EAN compatible).
  - Generates a distinct barcode and SKU for each size variant to avoid collisions.

- [x] **2. UI Size Range Selector (`src/app/inventory/page.tsx`)**
  - Keep existing category dropdown as-is (uses already existing categories).
  - Add size range presets:
    - Shoe range (e.g., 36 to 40, 36 to 42, or custom min/max).
    - Apparel sizes (XS, S, M, L, XL, XXL).
    - Free entry.
  - Preview list displaying generated size rows with:
    - Size
    - Unique SKU
    - Unique Barcode
    - Initial Stock & Prices

- [x] **3. Batch Supabase Insertion (`src/app/inventory/page.tsx`)**
  - Insert product once into `products` using selected existing `category_id`.
  - Bulk insert all variants into `variants` (each with its unique barcode and SKU).
  - Bulk insert into `variant_costs`.
  - Bulk insert into `stock_movements`.

- [ ] **4. Verification & Testing**
  - Verify unique thermal tag printing per size (`BarcodeTagModal.tsx`).
  - Verify scanner detection in POS (`/pos`).

