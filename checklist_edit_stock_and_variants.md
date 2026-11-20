# Checklist — Stock & Variant Management (Edit, Add, or Remove Without Deleting Model)

## Context & Problem Statement
Currently in `/inventory` (Inventory & Store Management):
1. **No Quick Stock Adjustment**: It is impossible to quickly add (+1) or remove (-1) a single unit from a model. To correct a stock quantity, the user is forced to delete the entire product model and re-create it from scratch.
2. **"Delete" Removes the ENTIRE Model**: Each row in the table represents a specific variant (e.g., Size 38), but the red "Supprimer" button calls `handleDeleteProduct(product.id)`. This deactivates the parent product and ALL its associated sizes/variants.
3. **Cannot Add a Variant/Size to an Existing Model**: If a store receives a new size or color for an existing product, there is no "Add variant" button. The user has to delete and recreate everything or duplicate the product.

This plan establishes granular control over stock and variants so you never have to delete a whole model to adjust quantities or add/remove sizes.

---

## Action Plan & Checklist

### Phase 1: Quick Stock Adjustment (+1 / -1 & Direct Number Input)
Allows instant stock updates with a single click on any item row.

- [x] **1.1 Stock UI Controls (Desktop & Mobile)** ✅
  - [x] Add compact `[-]` and `[+]` buttons next to the stock badge on each item row.
  - [x] Make the stock quantity badge clickable or an editable input field to type an exact number directly (e.g., change 5 to 6 or 12).
  - [x] Disable the `[-]` button when stock reaches 0 (prevents negative stock).
  - [x] Fully responsive on both mobile cards and desktop table.

- [x] **1.2 Optimistic Updates & Supabase Synchronization** ✅
  - [x] Instant React state update (zero perceived lag or loading delay).
  - [x] Supabase query:
    ```typescript
    await supabase
      .from('variants')
      .update({ stock_quantity: newQuantity })
      .eq('id', variantId);
    ```
  - [x] Error handling: Automatic rollback and alert toast if network or database update fails.
  - [x] Subtle toast notification confirming the stock change.

---

### Phase 2: Targeted Single Variant Deletion (vs Entire Model Deletion)
Prevents destroying the entire model when only one size or erroneous variant needs to be removed.

- [x] **2.1 Separation of Delete Actions** ✅
  - [x] Replace the current ambiguous delete button with two distinct actions:
    - **"Delete Variant"** (trash icon on variant row): deactivates only the specific variant (`is_active = false`).
    - **"Delete Entire Model"** (model-level menu or explicit option): deactivates the parent product and all its variants.

- [x] **2.2 Explicit Confirmation Dialog** ✅
  - [x] Clear modal text:
    > *"Delete variant {Product Name} - Size {Size}? All other sizes in this model will be preserved."*

- [x] **2.3 Database Soft-Delete & Query Filter** ✅
  - [x] Perform soft delete on the single variant:
    ```typescript
    await supabase
      .from('variants')
      .update({ is_active: false })
      .eq('id', variantId);
    ```
  - [x] Ensure `fetchInventory` filters out inactive variants: `variants.filter(v => v.is_active !== false)`.
  - [x] Preserves all historical sales and credit receipts linked to that variant.

---

### Phase 3: Add a Variant / Size to an Existing Model
Allows adding a new size (e.g., Size 39 or XL) or color to an existing product without recreating it.

- [x] **3.1 UI Trigger "+ Add Variant"** ✅
  - [x] Add an action button: `+ Add Size / Variant` on existing products.
  - [x] Accessible directly from the inventory table.

- [x] **3.2 "Add Variant" Modal** ✅
  - [x] Pre-fills and locks parent product information (Name, Category, Brand).
  - [x] Input fields:
    - **Size**: Quick-pick selector for shoe sizes (36–45), clothing sizes (XS, S, M, L, XL, XXL), or custom text.
    - **Color**: Pre-filled with model color, customizable if needed.
    - **Initial Stock**: Numeric input (default 1 or custom).
    - **Selling Price (TND)**: Pre-filled automatically from existing variants.
    - **Cost Price (TND)**: Pre-filled (manager only).
  - [x] Automatic and unique generation:
    - Unique SKU via `generateVariantSku()`.
    - Unique EAN-13 barcode via `generateUniqueBarcode()`.

- [x] **3.3 Database Insertion & Instant Tag Printing** ✅
  - [x] Insert into `variants` table linked to `product_id`.
  - [x] Insert into `variant_costs` (for manager).
  - [x] Offer immediate barcode tag print prompt for the newly added item.

---

### Phase 4: Full Product & Variant Edit Modal
Allows editing item details without having to start over.

- [x] **4.1 Edit Button (`Edit2`)** ✅
  - [x] Add an "Edit" button on each row.
  - [x] Opens the "Edit Article / Variant" modal.

- [x] **4.2 Edit Form** ✅
  - [x] Edit Product Name, Brand, and Category.
  - [x] Edit Variant Size, Color, Selling Price, Cost Price.
  - [x] Edit Low Stock Alert Threshold (`low_stock_threshold`).
  - [x] Save with validation and instant UI refresh.

---

### Phase 5: Security & Cashier vs Manager Permissions
- [ ] Restrict or disable stock edits, variant creation, and deletion for cashier accounts (`isCashier === true`).
- [ ] Manager retains full access to manual stock adjustments, costs, and variant management.

---

### Phase 6: Verification & QA Testing
- [ ] Test increment (+1) and decrement (-1) on desktop and mobile: verify database persistence.
- [ ] Test direct number input for stock.
- [ ] Test adding a new size to an existing model: verify barcode generation and POS scanner recognition.
- [ ] Test deleting a single size: verify the remaining sizes of the model stay intact.
- [ ] Test deleting the entire model when intended.
- [ ] Verify production Next.js build (`npm run build`).
