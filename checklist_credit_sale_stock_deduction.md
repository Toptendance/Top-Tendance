# Checklist: Diagnosis & Fix for Stock Deduction after Credit Sale

> **Status**: 📋 Planning Mode (Plan Mode — **No implementation started yet**)  
> **Reported Issue**: When an item is sold on credit (no payment made today / deposit = 0 DT), the customer physically leaves the store with the item. However, when attempting to sell or search for the same item afterward, it still appears as existing/available in stock, when it should be out of stock and blocked from sale.

---

## 🔍 Root Cause Analysis

Based on real-time database inspection on Supabase (`uqwvbbuxriiduedhdqwl`) and frontend POS code analysis (`/pos`), **4 complementary root causes** were identified:

### 1. The Credit Sale RPC decrements stock, BUT the initial stock was greater than 1
- **Database verification**:
  - The atomic RPC function `create_credit_sale` does execute:
    ```sql
    UPDATE public.variants 
    SET stock_quantity = stock_quantity - v_qty 
    WHERE id = v_variant_id;
    ```
  - However, in the `variants` table, most test items (e.g., `ZARE-39-M`, `STEP-LADY-540-38-MARRON`, `BOTT-HAUT-38-MR`) were initially seeded with a stock quantity of **2 or more units**.
  - **Result**: When 1 item is sold on credit, the stock drops from **2 to 1**. There is still **1 unit available in stock**, so the scanner and search still find it and allow selling it!

### 2. A previous Credit Return test re-added the item back to stock (+1)
- **Exact history from `stock_movements` table**:
  1. `2026-11-13 21:22:07`: `credit_sale` of 1x `ZARE-39-M` (Customer `abc`) $\rightarrow$ Stock decremented by **-1**.
  2. `2026-11-13 21:23:23`: `credit_return` (Return item via Credit Ledger) $\rightarrow$ Stock re-incremented by **+1**.
- **Consequence**: The test return immediately restored the item back to available stock (`stock = 2`), giving the false appearance that the credit sale had not deducted the stock.

### 3. Manual Product Search Drawer (`ProductSearchDrawer.tsx`) shows out-of-stock items (Stock 0)
- **Current code (`src/components/pos/ProductSearchDrawer.tsx:L70`)**:
  ```typescript
  const { data, error } = await supabase
    .from('variants')
    .select(`...`)
    .eq('is_active', true)
    .or(`sku.ilike.%${query}%,barcode.ilike.%${query}%`)
    .limit(20);
  ```
- **Flaw**: The query filters only for `is_active = true`, **without filtering for `stock_quantity > 0`**.
- **User experience impact**: Even if an item has been sold and its real stock drops to **0**, it still appears in the search results ("Stock: 0 available"), leading the cashier to believe the item still exists and is sellable.

### 4. Missing Realtime event for Credit Sales with 0 DT deposit
- **In `src/app/pos/page.tsx`**:
  - The Supabase Realtime channel only listens to: `sales` (INSERT), `returns` (INSERT), and `credit_payments` (INSERT).
  - A credit sale with zero deposit (**0 DT paid today**):
    - Does not write to `sales`.
    - Does not write to `returns`.
    - Does not write to `credit_payments`.
  - **Consequence**: No Realtime event is triggered. If the cashier has multiple tabs open, or another POS register terminal is running, the in-memory cache `variantsCacheRef` on those screens **does not update its remaining stock** until a full manual page refresh.

---

## 📋 Action Plan & Step-by-Step Checklist

### Phase 1: Test Item Stock Calibration & Cleanup
- [ ] **1.1 Identify the exact item tested by the cashier**
  - Check the exact SKU or barcode used during the test.
  - Query its current row in `variants`: `SELECT id, sku, barcode, stock_quantity FROM variants WHERE sku = '...';`
- [ ] **1.2 Calibrate test variant to exactly 1 unit**
  - To test out-of-stock blocking strictly, set the test item's initial stock to exactly **1**.
  - If stock is 2 or higher, selling 1 unit will naturally leave 1 unit available.
- [ ] **1.3 Verify no test returns are restoring stock prematurely**
  - Confirm that the item hasn't undergone an automated or manual credit return that re-incremented the stock.

---

### Phase 2: Fix Manual Product Search Drawer (`ProductSearchDrawer.tsx`)
- [ ] **2.1 Filter or visually disable out-of-stock items**
  - **Recommended Approach**:
    - Filter directly in the Supabase query: `.gt('stock_quantity', 0)` so only physically available items are displayed.
    - OR display a clear red badge `[OUT OF STOCK / 0 IN STOCK]` and **disable click selection** (`cursor-not-allowed`, `opacity-50`) to prevent selecting 0-stock variants.
- [ ] **2.2 Provide clear feedback to the cashier**
  - When searching for a depleted item, show: *"Item out of stock (0 available)"*.

---

### Phase 3: Scanner & POS Cache Synchronization (`src/app/pos/page.tsx`)
- [ ] **3.1 Verify local cache eviction on stock reaching 0**
  - In `handleConfirmPayment` (credit sale branch):
    - Ensure `variantsCacheRef.current` correctly sets `stock_quantity: 0`.
    - Verify that scanning a 0-stock item with the laser barcode scanner immediately triggers:
      - Audio error beep (`playBeep('error')`).
      - Red error banner: `Item [SKU] is out of stock`.
      - Prevents adding any line item to the cart.
- [ ] **3.2 Attach Realtime listeners to Stock Movements / Variant Updates**
  - Add a Supabase Realtime listener on `stock_movements` (INSERT) or `variants` (UPDATE) in `src/app/pos/page.tsx` so all connected cashier screens instantly update stock without manual page reloads.

---

### Phase 4: Inventory Management Tab Synchronization (`/inventory`)
- [ ] **4.1 Auto-refresh stock levels in Inventory View**
  - Verify that when an item drops to 0 via a credit sale, the Manager's `/inventory` view immediately displays the new stock `0` and flags it under `"Low Stock Alerts"`.
- [ ] **4.2 Audit stock movement history**
  - Check in `stock_movements` that every credit sale logs a clean entry:
    - `movement_type = 'credit_sale'`
    - `quantity_change = -1`
    - `reason = 'Credit Sale #... - [Customer Name]'`

---

### Phase 5: Verification & Quality Assurance Test Scenario
- [ ] **5.1 End-to-end test with a 1-unit item**:
  1. Pick or set an item to **exactly 1 unit** in stock.
  2. Scan the item in POS $\rightarrow$ Added to cart (Quantity: 1).
  3. Open Payment Drawer $\rightarrow$ Select **"Credit Sale"** ("Vente à Crédit") tab.
  4. Fill in Customer Name + Phone, Deposit = **0 DT** (customer pays nothing today).
  5. Confirm Credit Sale $\rightarrow$ Receipt displayed, database stock decremented to **0**.
  6. **Test 1 (Barcode Scanner)**: Re-scan the same barcode $\rightarrow$ **Blocked** with *"Item out of stock"*.
  7. **Test 2 (Search Drawer)**: Open manual search $\rightarrow$ Item cannot be selected or added to cart.
  8. **Test 3 (Database)**: Confirm `variants.stock_quantity = 0` and `stock_movements` row with `movement_type = 'credit_sale'`.
  9. **Test 4 (Cash Drawer)**: Confirm physical cash drawer remains untouched (0 DT cash in, 0 DT cash out).
