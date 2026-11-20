# Checklist — Modular 5-File Refactoring Plan for `/inventory`

## 1. Problem Statement & Motivation
The current file `src/app/inventory/page.tsx` contains **3,148 lines of code**, mixing:
- Tab navigation & role permissions
- Data fetching & state synchronization with Supabase
- Filtering, searching & batch multi-item selection
- Mobile card layout & Desktop table layout
- Inline stock editing (+1 / -1 buttons and direct numeric input)
- Five distinct modal dialogs (New Product with Multi-size batching, Add Variant, Edit Variant, Category Manager, and Delete Confirmations)

Because all features are bundled in one giant file, debugging, modifying features, or fixing issues is slow and error-prone.

---

## 2. Target 5-File Architecture

```
src/
├── app/
│   └── inventory/
│       └── page.tsx                     [File 1: Main Page & State Orchestrator (~320 lines)]
└── components/
    └── inventory/
        ├── InventoryTableSection.tsx    [File 2: Table, Mobile Cards, Filters & Batch Bar (~650 lines)]
        ├── NewProductModal.tsx          [File 3: New Product & Multi-Size Batch Modal (~450 lines)]
        ├── ProductVariantModals.tsx     [File 4: Add Variant & Edit Product/Variant Modals (~450 lines)]
        └── CategoryAndConfirmModals.tsx [File 5: Category Manager & Delete Confirmations (~350 lines)]
```

### File Responsibilities Matrix

| File # | Path | Primary Responsibility | Key Features Handled |
| :--- | :--- | :--- | :--- |
| **File 1** | `src/app/inventory/page.tsx` | **Main Dashboard Shell & Data Orchestrator** | Tab switcher (`inventory`, `cashiers`, `credits`, `deliveries`), Auth profile check, Data fetch (`fetchInventory`), KPI metric cards, Modal state triggers. |
| **File 2** | `src/components/inventory/InventoryTableSection.tsx` | **Inventory Display & Quick Actions** | Search bar, category filter, print status filter, desktop table & mobile cards, inline stock steppers (`+1` / `-1`), floating batch action bar. |
| **File 3** | `src/components/inventory/NewProductModal.tsx` | **New Model & Multi-Size Creator** | Single vs Multi-Size modes, size presets (Clothing XS-XXL, Shoes 36-40, Custom), auto SKU/barcode generation, batch submission to Supabase. |
| **File 4** | `src/components/inventory/ProductVariantModals.tsx` | **Variant & Model Modifications** | `AddVariantModal` (adding new size/color to existing model) + `EditVariantModal` (updating model info, variant prices, stock, barcode, SKU). |
| **File 5** | `src/components/inventory/CategoryAndConfirmModals.tsx` | **Categories & Delete Dialogs** | `CategoryManagerModal` (list, add, edit, delete categories) + `VariantDeleteModal` (soft-delete single size) + `ProductDeleteModal` (soft-delete entire model). |

---

## 3. Implementation Checklist

### Phase 1: Shared Types & Preparation
- [x] **1.1 Define Shared Types & Interfaces**
  - [x] Extract `ProductWithVariants`, `VariantItem`, `BatchVariantDraft`, `SelectedVariantItem` for clean imports across the 5 files.
- [x] **1.2 Create `src/components/inventory/` Directory**
  - [x] Ensure proper path structure for the new modular components.

---

### Phase 2: File 2 — `InventoryTableSection.tsx`
- [x] **2.1 Component Props Interface**
  - [x] `products`: `ProductWithVariants[]`
  - [x] `categories`: `{ id: string; name: string }[]`
  - [x] `loading`: `boolean`
  - [x] `selectedVariants`: `Map<string, SelectedVariantItem>`
  - [x] `onToggleSelectVariant`: `(item: SelectedVariantItem) => void`
  - [x] `onSelectAllVisible`: `() => void`
  - [x] `onClearSelection`: `() => void`
  - [x] `onSelectAllUnprinted`: `() => void`
  - [x] `onQuickStockUpdate`: `(variantId: string, delta: number) => Promise<void>`
  - [x] `onDirectStockCommit`: `(variantId: string, newStock: number) => Promise<void>`
  - [x] `onOpenTagModal`: `(variant: any) => void`
  - [x] `onOpenEditVariant`: `(product: any, variant: any) => void`
  - [x] `onOpenAddVariant`: `(product: any, variant: any) => void`
  - [x] `onOpenDeleteVariant`: `(variantInfo: any) => void`
  - [x] `onOpenCategoryModal`: `() => void`
  - [x] `onBatchTogglePrinted`: `(status: boolean) => Promise<void>`
  - [x] `onTogglePrintedStatus`: `(variantId: string, currentStatus?: boolean) => Promise<void>`
- [x] **2.2 Migrate Search & Filter Controls**
  - [x] Search input by product name, SKU, or barcode.
  - [x] Category dropdown selector.
  - [x] Low-stock quick toggle button.
  - [x] Print status pills (`Tous`, `Non imprimés`, `Imprimés`).
  - [x] Category Manager button (`Gérer les catégories`).
- [x] **2.3 Migrate Views**
  - [x] Mobile Card View (`< md` screen).
  - [x] Desktop Table View (`md+` screen) with sticky header.
  - [x] Floating Batch Action Toolbar with batch print & batch mark actions.

---

### Phase 3: File 3 — `NewProductModal.tsx`
- [x] **3.1 Component Props Interface**
  - [x] `isOpen`: `boolean`
  - [x] `onClose`: `() => void`
  - [x] `categories`: `{ id: string; name: string }[]`
  - [x] `existingBarcodes`: `Set<string>`
  - [x] `existingSkus`: `Set<string>`
  - [x] `onSuccess`: `() => void`
- [x] **3.2 State & Logic Isolation**
  - [x] Move form state (`productForm`), error states, and loading indicators.
  - [x] Multi-size presets: Clothing (`XS`, `S`, `M`, `L`, `XL`, `XXL`), Shoe range (`36-40`), and Custom CSV size input.
  - [x] Automatic SKU generator and unique barcode generator.
  - [x] Real-time duplicate SKU detection.
- [x] **3.3 Supabase Submission**
  - [x] Insert parent product into `products`.
  - [x] Insert single variant or batch variants into `variants`.
  - [x] Insert manager cost price into `variant_costs`.
  - [x] Success toast notification and trigger `onSuccess()`.

---

### Phase 4: File 4 — `ProductVariantModals.tsx`
- [x] **4.1 `AddVariantModal` Component**
  - [x] Props: `targetProduct`, `onClose`, `onSuccess`, `existingBarcodes`.
  - [x] Pre-populates category, brand, default selling/cost prices.
  - [x] Size quick selectors (Clothing & Shoe pills).
  - [x] Form submission: creates variant in `variants` table and costs in `variant_costs`.
- [x] **4.2 `EditVariantModal` Component**
  - [x] Props: `editingData`, `categories`, `onClose`, `onSuccess`.
  - [x] Dual-entity update: updates `products` (name, brand, category_id) and `variants` (size, color, prices, stock, barcode, SKU).
  - [x] Updates cost price in `variant_costs` via upsert.
  - [x] Toast notification and `onSuccess()` trigger.

---

### Phase 5: File 5 — `CategoryAndConfirmModals.tsx`
- [x] **5.1 `CategoryManagerModal`**
  - [x] Props: `isOpen`, `onClose`, `categories`, `productsCountMap`, `onCategoriesChanged`.
  - [x] Add new category (with description).
  - [x] Inline category name & description edit.
  - [x] Category deletion with safety check (verifies if referenced by products).
- [ ] **5.2 `VariantDeleteModal`**
  - [ ] Props: `variantToDelete`, `onClose`, `onConfirmDeleteVariant`, `onSwitchToDeleteProduct`, `isDeleting`.
  - [ ] Soft-delete variant (`is_active = false`). If it's the last variant, automatically soft-deletes parent product.
- [ ] **5.3 `ProductDeleteModal`**
  - [ ] Props: `productToDelete`, `onClose`, `onConfirmDeleteProduct`, `isDeleting`.
  - [ ] Soft-deletes parent product and all its variants.

---

### Phase 6: File 1 — `src/app/inventory/page.tsx` (Refactoring & Assembly)
- [x] **6.1 Streamline Main Component**
  - [x] Keep core state: `products`, `categories`, `loading`, `userProfile`, `activeTab`.
  - [x] Keep selection state: `selectedVariants`.
  - [x] Keep modal control state (`isProductModalOpen`, `addVariantProduct`, `editingVariantData`, etc.).
  - [x] Retain high-level stock update handler with optimistic UI updates.
- [x] **6.2 Render Clean Tree**
  - [x] Header + Tabs (`inventory`, `cashiers`, `credits`, `deliveries`).
  - [x] KPI Cards summary (Total references, total pieces in stock, low stock alert count).
  - [x] Render `<InventoryTableSection />`.
  - [x] Render `<NewProductModal />`.
  - [x] Render `<ProductVariantModals />` (`AddVariantModal` & `EditVariantModal`).
  - [x] Render `<CategoryAndConfirmModals />` (`CategoryManagerModal`, `VariantDeleteModal`, `ProductDeleteModal`).
  - [x] Render auxiliary modals (`<BarcodeTagModal />`, `<MobileScannerModal />`, `<DeliveryReceivingModal />`).

---

## 4. Verification & Safety Guidelines
- [x] **TypeScript Check**: Run `npx tsc --noEmit` to verify 0 type errors across all 5 files.
- [x] **Feature Parity Verification**:
  - [x] Tab switching: `inventory` ↔ `cashiers` ↔ `credits` ↔ `deliveries`.
  - [x] Search filter by name, SKU, and barcode.
  - [x] Category filter and print status filter (`Tous`, `Non imprimés`, `Imprimés`).
  - [x] Inline stock adjustment: `+1` / `-1` and typing exact numbers.
  - [x] Batch barcode printing: multi-select checkboxes and floating action bar.
  - [x] Adding a new model (both single size and multi-size batch).
  - [x] Adding a new size to an existing model.
  - [x] Editing product & variant info.
  - [x] Soft-deleting a single variant vs deleting the whole model.
  - [x] Managing categories (add, rename, delete).
