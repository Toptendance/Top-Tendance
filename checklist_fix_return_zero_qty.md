# Checklist — Fix: Return Shows Zero Quantity (Barcode `2003323196434`)

> **Bug**: When scanning barcode `2003323196434` in the Return modal, the return succeeds but the quantity in the item stepper is **0** (`maxReturnable = 0`), making it impossible to actually return any quantity.

---

## Root Cause Analysis

The quantity displayed/enforced for each item in the return modal is:

```
maxReturnable = sale_items.quantity - alreadyReturnedQtys[si.id]
```

The bug can be caused by **one or more** of these:

| # | Possible Cause | Where |
|---|---|---|
| **A** | `sale_items.quantity` was stored as `0` in the DB when the sale was created | `complete_sale` RPC / `sales` table |
| **B** | `alreadyReturnedQtys` is wrongly set to equal `sale_items.quantity`, marking item as "fully returned" prematurely | `fetchSaleById()` → `return_items` join |
| **C** | Barcode search (Path 2) pre-filters out the sale item (considers it fully returned) before `fetchSaleById` even loads it | `handleSearchSale()` lines 237–241 |
| **D** | The variant with this barcode has **no** associated `sale_items` row (product was never sold via POS, only received) | DB state |
| **E** | The `return_items` table has a stale / duplicate row for this `sale_item_id` with incorrect `quantity` | `return_items` table |

---

## Investigation Steps (Before Fixing)

### 🔍 Step 0 — Verify the variant exists in DB

```sql
SELECT id, sku, barcode, stock_quantity
FROM variants
WHERE barcode = '2003323196434';
```

- ✅ Expected: 1 row returned with the correct variant ID
- ❌ If 0 rows: barcode doesn't exist → different bug (wrong barcode)

---

### 🔍 Step 1 — Check if this barcode was ever sold

```sql
SELECT
  si.id AS sale_item_id,
  si.sale_id,
  si.variant_id,
  si.quantity,
  si.unit_price,
  s.created_at AS sale_date
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
JOIN variants v ON v.id = si.variant_id
WHERE v.barcode = '2003323196434'
ORDER BY s.created_at DESC;
```

- ✅ Expected: At least 1 row with `quantity > 0`
- ❌ If `quantity = 0`: Root Cause **A** — `complete_sale` RPC stored 0
- ❌ If 0 rows: Article was never sold via POS → cannot be returned

---

### 🔍 Step 2 — Check already-returned quantities

```sql
SELECT
  ri.sale_item_id,
  SUM(ri.quantity) AS total_already_returned,
  si.quantity AS original_qty,
  si.quantity - SUM(ri.quantity) AS still_returnable
FROM return_items ri
JOIN sale_items si ON si.id = ri.sale_item_id
JOIN variants v ON v.id = si.variant_id
WHERE v.barcode = '2003323196434'
GROUP BY ri.sale_item_id, si.quantity;
```

- ✅ Expected: `still_returnable > 0`
- ❌ If `still_returnable = 0`: Root Cause **B/E** — already returned OR duplicate `return_items` rows

---

### 🔍 Step 3 — Check for orphan / duplicate return_items rows

```sql
SELECT
  ri.*,
  si.quantity AS original_qty
FROM return_items ri
LEFT JOIN sale_items si ON si.id = ri.sale_item_id
WHERE si.id IS NULL OR ri.quantity >= si.quantity;
```

- ❌ If rows returned with `si.id IS NULL`: orphaned `return_items` rows (data integrity issue)
- ❌ If `ri.quantity >= si.quantity`: Return quantity equals or exceeds the purchased quantity

---

### 🔍 Step 4 — Inspect `process_return_exchange` RPC behavior

Check if a **previous partial or full return** was recorded for this item:

```sql
SELECT
  r.id AS return_id,
  r.created_at,
  r.return_type,
  ri.quantity AS returned_qty,
  ri.sale_item_id
FROM returns r
JOIN return_items ri ON ri.return_id = r.id
JOIN sale_items si ON si.id = ri.sale_item_id
JOIN variants v ON v.id = si.variant_id
WHERE v.barcode = '2003323196434'
ORDER BY r.created_at DESC;
```

---

## Fix Plan — Based on Root Cause

---

### Fix A — `sale_items.quantity` stored as 0

> **If Step 1 shows `quantity = 0` in `sale_items`**

**Cause**: The `complete_sale` RPC received `quantity: 0` in the payload (UI bug — cart item was added with 0 qty).

**Files to fix**:
- [ ] **A1** — `src/app/pos/page.tsx`: Add a guard before calling `complete_sale` to filter out cart items with `quantity <= 0`
- [ ] **A2** — DB data fix: `UPDATE sale_items SET quantity = <correct_qty> WHERE id = '<sale_item_id>'` (one-time SQL patch)
- [ ] **A3** — Optionally: add a `CHECK (quantity > 0)` constraint to `sale_items.quantity` in Supabase

---

### Fix B — `alreadyReturnedQtys` incorrectly marks item as fully returned

> **If Step 2 shows `still_returnable = 0` but no actual return happened**

**Cause**: Either a duplicate row in `return_items`, or a logic error in `fetchSaleById` that double-counts returned quantities.

**Files to fix**:
- [ ] **B1** — `ReturnExchangeModal.tsx` `fetchSaleById()` (lines 115–130): Verify the `return_items` → `sale_item_id` join is correct and the aggregation map (`qtysMap`) is accurate
- [ ] **B2** — DB data fix: Delete the erroneous `return_items` row(s) if confirmed duplicates:
  ```sql
  DELETE FROM return_items WHERE id = '<bad_row_id>';
  ```

---

### Fix C — Barcode search (Path 2) filters out the sale before display

> **If Step 1 shows `quantity > 0` and Step 2 shows `still_returnable > 0` but the sale never appears in the modal**

**Cause**: The pre-filter at lines 237–241 in `handleSearchSale` compares `returnedQtyMap[si.id]` with `si.quantity`. The `si` here comes from the `sale_items` partial query in Path 2, and there could be an ID mismatch or wrong column type.

**Files to fix**:
- [ ] **C1** — `ReturnExchangeModal.tsx` `handleSearchSale()` (lines 202–271):
  - Verify that `saleItems[i].id` correctly maps to `return_items.sale_item_id`
  - Add a debug `console.log` temporarily: log `saleItems`, `returnedRows`, and `returnedQtyMap`

---

### Fix D — UX: Stepper starts at 0, `+` must be pressed manually

> **If the sale item appears correctly with `maxReturnable > 0` but cashier doesn't realize they must click `+`**

This is **expected behavior** but bad UX when scanning a single item barcode.

- [ ] **D1** — Add a **"Tout"** (All) button per item that sets `returnQtys[si.id] = maxReturnable` in one click
- [ ] **D2** — When barcode scan auto-resolves to exactly 1 sale + 1 matching item, **auto-set that item's returnQty to 1**

---

### Fix E — `return_items` has orphan/stale rows (data integrity)

> **If Step 3 shows orphaned or over-counted rows**

- [ ] **E1** — Run cleanup SQL to delete orphaned `return_items` rows
- [ ] **E2** — Add a DB-level constraint to enforce `return_items.quantity <= sale_items.quantity`

---

## Implementation Checklist

### Phase 1 — Diagnosis (SQL investigation, NO code changes)
- [ ] Run Step 0 SQL — confirm barcode `2003323196434` exists as a variant
- [ ] Run Step 1 SQL — check `sale_items.quantity` for this barcode
- [ ] Run Step 2 SQL — check `still_returnable`
- [ ] Run Step 3 SQL — check for orphan `return_items` rows
- [ ] Run Step 4 SQL — check previous return history
- [ ] **Identify root cause(s) and annotate this checklist before proceeding**

### Phase 2 — Code / DB Fix (based on Phase 1 findings)
- [ ] Apply relevant Fix (A / B / C / D / E) based on diagnosis
- [ ] Add temporary `console.log` in `handleSearchSale` and `fetchSaleById` if root cause unclear
- [ ] Verify fix in browser: scan `2003323196434`, confirm `maxReturnable > 0`

### Phase 3 — UX Improvement (Fix D — regardless of root cause)
- [ ] Add **"Tout"** button per item in return items list → sets qty to `maxReturnable`
- [ ] Auto-set returnQty to 1 when barcode scan resolves to exactly 1 sale + 1 item

### Phase 4 — Data Integrity Guards
- [ ] Add `CHECK (quantity > 0)` constraint to `sale_items` in Supabase
- [ ] Consider unique constraint on `return_items` to prevent double-return for same `sale_item_id`

### Phase 5 — Regression Test
- [ ] Scan `2003323196434` → sale appears → item shows correct qty
- [ ] Return 1 unit → quantity decrements → stock restored in cache
- [ ] Attempt to return again → "Déjà retourné" badge appears
- [ ] Existing test barcodes (`6191000000018`, `6191000000025`) still work ✅
- [ ] `npm run build` exits 0 ✅

---

## Files Likely Touched

| File | Reason |
|---|---|
| `ReturnExchangeModal.tsx` | Main fix: `fetchSaleById`, `handleSearchSale`, UX stepper |
| `src/app/pos/page.tsx` | Guard against zero-qty cart items before `complete_sale` |
| Supabase SQL | Data patch + optional DB constraints |

---

> **Status**: 🔴 Diagnosis pending — run Phase 1 SQL queries before starting implementation

