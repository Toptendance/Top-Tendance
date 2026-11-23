# Plan & Checklist — SKU Generation Bug & Duplicate Detection Fix

## 1. Problem Context & Root Cause Analysis

### User Test Case
1. User has a model: **`Stella 26002`**, Price: `220.000`, Color: `Maron`, Size: `Sm`.
2. User tries to add another one with Size: **`ML`**.
3. The system blocks submission with the error:
   > **"Un SKU en doublon a été détecté. Modifiez-le ou utilisez 'Régénérer SKUs & Barcodes'."**

---

### Why Did This Happen Even With Different Sizes (`Sm` vs `ML`)?

There are **three specific bugs** causing this exact failure:

1. **Stale SKU in `NewProductModal.tsx` (Form Field Order & Missing Sync)**:
   - In `NewProductModal`, the **SKU (Unique)** input and **"Auto-générer"** button are located *above* the **Taille (Size)** and **Couleur (Color)** inputs.
   - Initial default state of the modal is: Size = `'M'`, Color = `'Noir'`.
   - When the user types `Stella 26002` and clicks **"Auto-générer"**, the SKU becomes:
     `STEL-2600-M-NOIR`.
   - Next, the user scrolls down and changes Taille to **`ML`** and Couleur to **`Maron`**.
   - **BUG**: `NewProductModal` does **not** update the SKU when Size or Color changes! The SKU remains frozen on `STEL-2600-M-NOIR` (which already exists from an earlier item).
   - When the user clicks Save, PostgreSQL rejects the insert with duplicate key violation `23505`, displaying the error!

2. **Truncation of Reference Numbers (`26002` $\rightarrow$ `2600`)**:
   - In `src/utils/barcodeGenerator.ts`:
     `word.slice(0, 4)` cuts `26002` down to `2600`.
   - The last digit `2` is lost, causing potential collisions with any `Stella 2600...` models.

3. **Misleading Error for Barcode Duplicates**:
   - In `NewProductModal.tsx`, the `catch` block checks `err?.code === '23505'`.
   - Any PostgreSQL unique constraint violation (whether on `sku` OR on `barcode`) triggers the exact same message: *"Un SKU en doublon a été détecté..."*.

---

## 2. Solution Details

1. **Auto-Sync SKU on Size / Color / Name Change in `NewProductModal`**:
   - Whenever the user modifies the Product Name, Size, or Color, if the SKU was auto-generated (or empty), recompute the SKU dynamically to match the current inputs:
     - `Stella 26002` + `Sm` + `Maron` $\rightarrow$ `STELLA-26002-SM-MARON`
     - `Stella 26002` + `ML` + `Maron` $\rightarrow$ `STELLA-26002-ML-MARON`
   - Both are completely distinct and will never collide!

2. **Preserve Complete Reference Numbers in `generateVariantSku`**:
   - Split alphanumeric tokens (`Stella26002` or `Stella 26002` $\rightarrow$ `STELLA` + `26002`).
   - Keep full digits so reference numbers like `26002`, `27033`, `261007` are never truncated.

3. **Collision Avoidance via `existingSkus`**:
   - Pass `existingSkus` to `generateVariantSku`. If an identical SKU already exists in the database, automatically append an incremental counter (`-01`, `-02`) to guarantee uniqueness.

4. **Case-Insensitive Real-Time Duplicate Validation**:
   - In `checkSkuDuplicate`, use `existingSkus.has(trimmed.toLowerCase())`.

5. **Accurate Error Messages**:
   - Distinguish whether PostgreSQL failed on `variants_sku_key` (SKU duplicate) or `variants_barcode_key` (Barcode duplicate).

---

## 3. Implementation Checklist

### Phase 1: SKU Generator Utility (`src/utils/barcodeGenerator.ts`)
- [x] **1.1 Letter/Digit Boundary Splitting**:
  - Split compound words at letter/digit transitions (e.g., `Stella26002` $\rightarrow$ `STELLA` and `26002`).
- [x] **1.2 Preserve Full Reference Numbers**:
  - Keep numbers intact (do not truncate digits with `.slice(0, 4)`).
- [x] **1.3 Anti-Collision & Uniqueness Guarantee**:
  - Accept `existingSkus?: Set<string>` in `generateVariantSku`.
  - Automatically add `-01`, `-02` suffix if a generated SKU is already taken.

### Phase 2: Product Creation Modal (`src/components/inventory/NewProductModal.tsx`)
- [x] **2.1 Auto-Sync SKU on Form Changes**:
  - When Size, Color, or Name changes, automatically update the SKU field if it hasn't been manually locked/edited by the user.
- [x] **2.2 Real-Time Duplicate Check**:
  - Fix case sensitivity: `existingSkus.has(trimmed.toLowerCase())`.
- [x] **2.3 "Regenerate SKUs & Barcodes" Action**:
  - Regenerate fresh, unique SKUs taking the latest Size and Color values into account.
- [x] **2.4 Granular Error Identification**:
  - Differentiate between SKU duplicate (`variants_sku_key`) and Barcode duplicate (`variants_barcode_key`).

### Phase 3: Variant Modals (`src/components/inventory/ProductVariantModals.tsx`)
- [x] **3.1 Single Variant Addition (`AddVariantModal`)**:
  - Ensure adding sizes (like `ML` to existing `Stella 26002`) uses the updated alphanumeric splitting and collision check.

### Phase 4: Testing & Verification
- [ ] **4.1 Test User Case 1 (`Stella 26002`)**:
  - Existing variant: `Stella 26002`, `Sm`, `Maron` $\rightarrow$ `STELLA-26002-SM-MARON`.
  - New variant: `Stella 26002`, `ML`, `Maron` $\rightarrow$ `STELLA-26002-ML-MARON`.
  - Confirm they do NOT trigger any duplicate error and save cleanly.
- [ ] **4.2 Test User Case 2 (`StellaStella27033` vs `Stella261007`)**:
  - Confirm distinct model numbers produce distinct SKUs.
- [ ] **4.3 Zero Impact on Printing**:
  - Verify thermal printing, labels, `is_printed` flags, and barcode layouts remain 100% untouched.
- [ ] **4.4 TypeScript Build Validation**:
  - Run `npx tsc --noEmit` to ensure zero compilation errors.
