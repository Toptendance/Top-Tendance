# Checklist: Return Items at Actual Sold Price + Post-Return Stock Cache Sync

## 1. Overview & Objective

Two related bugs in the POS return flow, both fixed together:

### Bug 1 — Wrong Price on Return
When a sale is completed with a **global cart discount**, the return modal (`ReturnExchangeModal`) shows the **original catalogue price** instead of the actual discounted price the customer paid.

**Root Cause:** `complete_sale` RPC always stores `variants.selling_price` as `sale_items.unit_price`, ignoring any discount. The discount lives only at the sale level (`sales.discount_amount`), so returns read the wrong price.

**Fix:** Distribute the cart discount proportionally across each item and store the **effective (discounted) unit price** directly in `sale_items.unit_price` at sale time.

---

### Bug 2 — "Rupture de Stock" After Return (Until Page Refresh)
After a return is processed successfully (stock is restored in the DB), if the cashier immediately scans that same item to sell it again, the POS shows **"Article en rupture de stock"** — until the page is manually refreshed.

**Root Cause:** The POS uses an **in-memory variant cache** (`variantsCacheRef` in `pos/page.tsx`) pre-loaded at login for instant barcode scanning. When a return restores stock in the DB via `process_return_exchange`, the cache is **never updated** — it still holds the old (zero or low) `stock_quantity`. The next scan hits the stale cache and incorrectly blocks the sale.

The cache *is* updated after a **sale** (lines 583–593 in `pos/page.tsx` decrement cache stock), but there is **no equivalent increment after a return**.

**Fix:** When `ReturnExchangeModal` closes after a successful return, notify `pos/page.tsx` with the returned items so it can increment the cached `stock_quantity` for each returned variant — mirroring the same pattern used for sales.

---

## 2. Step-by-Step Implementation Plan

> **Bug 1 fixes:** Sections A, B, C, D, E
> **Bug 2 fix:** Section F
> **Testing both:** Section G

### A. SQL — Update `complete_sale` RPC (`supabase_step3_functions.sql`)

- [x] **Extract `unit_price` from JSONB payload:**
  - In the `FOR v_item IN SELECT ... FROM jsonb_array_elements(p_items)` loop, also extract:
    ```sql
    (item->>'unit_price')::NUMERIC AS unit_price
    ```
- [x] **Use effective price in `sale_items` INSERT:**
  - Change `unit_price` and `subtotal` to use `COALESCE(v_item.unit_price, v_variant.selling_price)` instead of always using `v_variant.selling_price`:
    ```sql
    unit_price  = COALESCE(v_item.unit_price, v_variant.selling_price),
    subtotal    = COALESCE(v_item.unit_price, v_variant.selling_price) * v_item.quantity
    ```
- [x] **Recalculate `v_total_amount` using effective prices:**
  - Replace the `v_total_amount` accumulation (`v_variant.selling_price * v_item.quantity`) with:
    ```sql
    v_total_amount := v_total_amount + (COALESCE(v_item.unit_price, v_variant.selling_price) * v_item.quantity);
    ```
  - This keeps `sales.total_amount = sales.final_amount` (discount already baked in).
- [x] **Keep receipt JSONB consistent:**
  - Update the `v_sale_items` accumulator at the end of the loop to use the same effective price.

### B. Database — Redeploy the `complete_sale` Function

- [x] **Apply the updated SQL to Supabase:**
  - Run the updated `CREATE OR REPLACE FUNCTION public.complete_sale(...)` via the Supabase SQL editor or migration.
- [x] **Verify the function signature is unchanged:**
  - Parameters remain `(p_items JSONB, p_payment_method TEXT, p_discount NUMERIC)` — no breaking change.

### C. Frontend — Compute Effective Unit Price Before RPC Call (`src/app/pos/page.tsx`)

- [x] **Compute proportional discount per item in `handleConfirmPayment`:**
  - Before building `pItems`, calculate the raw total:
    ```ts
    const rawTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    ```
  - For each cart item, compute the effective unit price after proportional discount:
    ```ts
    const itemTotal    = item.unit_price * item.quantity;
    const proportion   = rawTotal > 0 ? itemTotal / rawTotal : 1;
    const itemDiscount = discount * proportion;
    const effectiveUnitPrice = rawTotal > 0
      ? (itemTotal - itemDiscount) / item.quantity
      : item.unit_price;
    ```
  - Round to 3 decimal places (DT format):
    ```ts
    Math.round(effectiveUnitPrice * 1000) / 1000
    ```
- [x] **Include `unit_price` in each `pItems` entry:**
  ```ts
  const pItems = cart.map((item) => ({
    variant_id: item.variant_id,
    quantity:   item.quantity,
    unit_price: effectiveUnitPrice, // ← new field
  }));
  ```
- [x] **Keep `p_discount` in RPC call as-is** (still used for `sales.discount_amount` audit trail).
- [x] **Handle zero-discount case:** When `discount === 0`, `effectiveUnitPrice === item.unit_price` → no behavioral change.

### D. Return Modal — Verify No Changes Needed (`src/components/pos/ReturnExchangeModal.tsx`)

- [x] **Confirm `itemsToReturnList` uses `si.unit_price`:**
  - The existing line `unit_price: Number(si.unit_price)` will now automatically reflect the effective (discounted) price — no code change needed.
- [x] **Confirm `totalReturnAmount` is computed from `unit_price`:**
  - `item.unit_price * qty` is already correct.
- [x] **Confirm `process_return_exchange` RPC uses `v_sale_item.unit_price`:**
  - The SQL RPC reads the stored `sale_items.unit_price` for refund calculation — also correct after the fix.

### E. Edge Cases (Bug 1)

- [x] **No discount (`discount = 0`):** Effective price = `item.unit_price` → no change in behaviour ✅
- [x] **100% discount:** Effective price = 0 DT — verify display in return modal shows `0.000 DT` ✅
- [x] **Rounding precision:** Total of rounded effective prices may differ by ±0.001 DT from `final_amount` — acceptable; `final_amount` is the source of truth for the sale total.
- [x] **Legacy sales (pre-fix):** Old `sale_items` still store `selling_price`. Add a subtle warning badge in `ReturnExchangeModal` when `sale.discount_amount > 0` and the effective price may not match what the customer paid.

---

### F. Post-Return Cache Invalidation — Bug 2 Fix (`src/app/pos/page.tsx` + `ReturnExchangeModal.tsx`)

#### F1. Add `onReturnCompleted` callback prop to `ReturnExchangeModal`

- [x] **Add new optional prop** to `ReturnExchangeModalProps`:
  ```ts
  onReturnCompleted?: (returnedItems: Array<{ variant_id: string; quantity: number }>) => void;
  ```
- [x] **Call `onReturnCompleted` after a successful return** inside `handleProcessReturn`, passing the returned items:
  ```ts
  if (onReturnCompleted) {
    onReturnCompleted(
      itemsToReturnList.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
      }))
    );
  }
  ```
  - This should be called after `setSuccessResult(...)`, whether it's a refund or exchange.

#### F2. Handle cache update in `pos/page.tsx`

- [x] **Pass `onReturnCompleted` to `<ReturnExchangeModal>`:**
  ```tsx
  onReturnCompleted={(returnedItems) => {
    // Increment stock in the in-memory cache for each returned variant
    for (const item of returnedItems) {
      for (const [key, cached] of variantsCacheRef.current.entries()) {
        if (cached.id === item.variant_id) {
          variantsCacheRef.current.set(key, {
            ...cached,
            stock_quantity: cached.stock_quantity + item.quantity,
          });
        }
      }
    }
  }}
  ```
- [x] **Mirror the existing sale pattern:** This is the exact inverse of the post-sale cache decrement already done at lines 583–593. Same loop, `+` instead of `-`.
- [x] **Ensure `fetchDailySales()` still runs on `onClose`** — no change needed there, it already does.

#### F3. Edge Cases (Bug 2)

- [x] **Item not in cache (was added via DB fallback, not pre-load):** The `for...of cache.entries()` loop will simply find no matching entry — safe, no-op. Next scan will re-fetch from DB and get the correct stock. ✅
- [x] **Partial return (e.g., return 1 of 3 qty):** `item.quantity` passed is the actually-returned qty — correctly increments by 1, not 3. ✅
- [x] **Exchange flow:** `onReturnCompleted` fires for exchanges too — cache is updated so the returned item is immediately scannable for the new sale. ✅
- [x] **Multiple items returned in one transaction:** The loop processes all returned items — all caches updated in a single callback. ✅

### G. Verification & Testing

**Bug 1 — Discounted Price on Return:**
- [ ] Sell 1 item (100 DT) with 10 DT discount → open return → confirm refund shows **90.000 DT**
- [ ] Sell 2 different items (60 DT + 40 DT) with 20 DT discount → return only the 60 DT item → confirm refund shows **48.000 DT** (60% proportion → 12 DT discount on that item)
- [ ] Sell with **no discount** → open return → confirm price is unchanged (original `selling_price`)
- [ ] Sell with **100% discount** (gift) → open return → confirm refund shows **0.000 DT**
- [ ] Verify `sales.discount_amount` is still correctly stored after the change
- [ ] Verify `sales.total_amount` and `sales.final_amount` remain consistent
- [ ] Confirm the POS receipt modal (`ReceiptModal`) still shows correct prices after the change
- [ ] Test exchange flow: sell with discount → exchange → verify credit amount reflects discounted price

**Bug 2 — Stock Cache Sync After Return:**
- [ ] Sell an item → process return → immediately scan the same barcode → confirm it **adds to cart without "rupture de stock"** error (no page refresh needed)
- [ ] Partial return (e.g., sell qty 3, return qty 1) → scan barcode → confirm stock shows as available
- [ ] Return multiple items in one transaction → scan each barcode → all add to cart correctly
- [ ] Exchange: return item → confirm the returned item is immediately scannable for the new sale
- [ ] Confirm that an item returned and **re-scanned via DB fallback** (not in cache) also works correctly

---

## 3. Files Changed

| File | Change Type | Bug | Description |
|------|------------|-----|-------------|
| `supabase_step3_functions.sql` | SQL update | Bug 1 | Extract `unit_price` from JSONB; use effective price in `sale_items` insert |
| Supabase DB (live) | Migration | Bug 1 | Redeploy `complete_sale` function |
| `src/app/pos/page.tsx` | TypeScript | Bug 1 + Bug 2 | Compute effective unit price before RPC; handle `onReturnCompleted` to update cache |
| `src/components/pos/ReturnExchangeModal.tsx` | TypeScript | Bug 2 | Add `onReturnCompleted` prop; call it after successful return/exchange |

---

## 4. Out of Scope

- Changes to `process_return_exchange` SQL RPC (already reads `sale_items.unit_price` correctly)
- Changes to `ReturnExchangeModal` search / barcode / camera logic
- Changes to `sales.total_amount` / `sales.final_amount` computation (stays as-is)
- Retroactive fix of old sale records (legacy data left as-is)

