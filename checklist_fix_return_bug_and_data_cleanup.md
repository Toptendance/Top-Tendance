# ✅ Checklist — Fix Manager/Cashier Return Bug + Data Cleanup
**Project:** Top Tendance POS  
**Date:** 14/11/2026  
**Priority:** 🔴 CRITICAL

---

## 🧨 What Happened (Full Diagnosis)

The cycle that caused the disaster:

```
Manager sells ZARE-40-M (1 unit, 88 DT)
  → Cashier tries to return it → RLS blocks: sale invisible to cashier
  → Manager returns it instead (stock +1 restored)
  → DB function had NO double-return guard
  → Manager/Cashier returned the SAME sale_item again (stock +1 again)
  → Stock went positive again → manager could sell it again
  → Cycle repeated 17+ times
```

**Result:**
- **ZARE-40-M** (barcode `2003323196625`): 1 real unit, but cycled through **~19 fake sales + 19 fake returns**
- **49 total returns** in DB, **5,058 DT refunded** (fake)
- **Stock values may be wrong** across multiple variants
- **2 unretured open sales** still showing in return modal (`#e5548eaa`, `#3c541941`)

---

## PHASE 1 — Apply Database Fixes (Do First!)
> Run all SQL in **[Supabase SQL Editor](https://supabase.com/dashboard/project/uqwvbbuxriiduedhdqwl/sql)**

- [x] **1.1** Fix RLS: allow cashiers to SELECT all sales (not just their own)
  ```sql
  DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
  CREATE POLICY "sales_select_policy" ON public.sales
      FOR SELECT TO authenticated USING (true);
  ```

- [x] **1.2** Fix RLS: allow cashiers to SELECT all sale_items
  ```sql
  DROP POLICY IF EXISTS "sale_items_select_policy" ON public.sale_items;
  CREATE POLICY "sale_items_select_policy" ON public.sale_items
      FOR SELECT TO authenticated USING (true);
  ```

- [x] **1.3** Fix RLS: allow cashiers to SELECT all returns
  ```sql
  DROP POLICY IF EXISTS "returns_select_policy" ON public.returns;
  CREATE POLICY "returns_select_policy" ON public.returns
      FOR SELECT TO authenticated USING (true);
  ```

- [x] **1.4** Fix RLS: allow cashiers to SELECT all return_items
  ```sql
  DROP POLICY IF EXISTS "return_items_select_policy" ON public.return_items;
  CREATE POLICY "return_items_select_policy" ON public.return_items
      FOR SELECT TO authenticated USING (true);
  ```

- [x] **1.5** Fix `process_return_exchange` function — add double-return guard:
  ```sql
  CREATE OR REPLACE FUNCTION public.process_return_exchange(
      p_original_sale_id UUID,
      p_returned_items JSONB,
      p_return_type TEXT,
      p_refund_method TEXT,
      p_reason TEXT DEFAULT NULL
  )
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
      v_cashier_id UUID;
      v_sale RECORD;
      v_item RECORD;
      v_sale_item RECORD;
      v_return_id UUID;
      v_total_refund NUMERIC(12, 3) := 0.000;
      v_processed_items JSONB := '[]'::JSONB;
      v_already_returned_qty INT := 0;
  BEGIN
      v_cashier_id := auth.uid();
      IF v_cashier_id IS NULL THEN
          RAISE EXCEPTION 'Unauthorized: Caller identity could not be derived from auth.uid()';
      END IF;
      IF p_return_type NOT IN ('refund', 'exchange') THEN
          RAISE EXCEPTION 'Invalid return type: %. Must be refund or exchange.', p_return_type;
      END IF;
      IF p_refund_method NOT IN ('cash', 'card', 'store_credit') THEN
          RAISE EXCEPTION 'Invalid refund method: %. Must be cash, card, or store_credit.', p_refund_method;
      END IF;
      IF p_returned_items IS NULL OR jsonb_array_length(p_returned_items) = 0 THEN
          RAISE EXCEPTION 'Returned items cannot be empty';
      END IF;
      SELECT id, final_amount, created_at INTO v_sale
      FROM public.sales WHERE id = p_original_sale_id;
      IF NOT FOUND THEN
          RAISE EXCEPTION 'Original sale #% not found', p_original_sale_id;
      END IF;
      INSERT INTO public.returns (
          original_sale_id, cashier_id, return_type,
          total_refunded_amount, refund_payment_method, reason
      ) VALUES (
          p_original_sale_id, v_cashier_id, p_return_type,
          0.000, p_refund_method, p_reason
      ) RETURNING id INTO v_return_id;
      FOR v_item IN
          SELECT
              (item->>'sale_item_id')::UUID AS sale_item_id,
              (item->>'variant_id')::UUID AS variant_id,
              (item->>'quantity')::INT AS quantity
          FROM jsonb_array_elements(p_returned_items) AS item
      LOOP
          IF v_item.quantity <= 0 THEN
              RAISE EXCEPTION 'Returned quantity must be greater than zero';
          END IF;
          SELECT id, variant_id, quantity, unit_price INTO v_sale_item
          FROM public.sale_items
          WHERE id = v_item.sale_item_id AND sale_id = p_original_sale_id;
          IF NOT FOUND THEN
              RAISE EXCEPTION 'Sale item % does not belong to sale %',
                  v_item.sale_item_id, p_original_sale_id;
          END IF;
          -- ★ DOUBLE-RETURN GUARD
          SELECT COALESCE(SUM(ri.quantity), 0) INTO v_already_returned_qty
          FROM public.return_items ri
          WHERE ri.sale_item_id = v_item.sale_item_id;
          IF (v_already_returned_qty + v_item.quantity) > v_sale_item.quantity THEN
              RAISE EXCEPTION
                  'Cannot return % unit(s): already returned %, sold qty was %. Max returnable: %.',
                  v_item.quantity, v_already_returned_qty,
                  v_sale_item.quantity, (v_sale_item.quantity - v_already_returned_qty);
          END IF;
          v_total_refund := v_total_refund + (v_sale_item.unit_price * v_item.quantity);
          INSERT INTO public.return_items (
              return_id, sale_item_id, variant_id,
              quantity, unit_price, subtotal
          ) VALUES (
              v_return_id, v_item.sale_item_id, v_item.variant_id,
              v_item.quantity, v_sale_item.unit_price,
              v_sale_item.unit_price * v_item.quantity
          );
          UPDATE public.variants
          SET stock_quantity = stock_quantity + v_item.quantity
          WHERE id = v_item.variant_id;
          INSERT INTO public.stock_movements (
              variant_id, quantity_change, movement_type, reason, created_by
          ) VALUES (
              v_item.variant_id, v_item.quantity, 'return',
              'Return / Exchange #' || v_return_id::text || ' for Sale #' || p_original_sale_id::text,
              v_cashier_id
          );
          v_processed_items := v_processed_items || jsonb_build_object(
              'variant_id', v_item.variant_id,
              'quantity', v_item.quantity,
              'unit_price', v_sale_item.unit_price
          );
      END LOOP;
      UPDATE public.returns SET total_refunded_amount = v_total_refund WHERE id = v_return_id;
      RETURN jsonb_build_object(
          'return_id', v_return_id,
          'original_sale_id', p_original_sale_id,
          'total_refunded_amount', v_total_refund,
          'refund_payment_method', p_refund_method,
          'return_type', p_return_type,
          'items', v_processed_items,
          'created_at', now()
      );
  END;
  $$;
  ```

- [x] **1.6** ✅ Verify Phase 1: Run this check query — it should return 0 rows:
  ```sql
  -- Check: any return_items that exceed original sold qty
  SELECT ri.sale_item_id, si.quantity as sold, SUM(ri.quantity) as total_returned
  FROM return_items ri
  JOIN sale_items si ON si.id = ri.sale_item_id
  GROUP BY ri.sale_item_id, si.quantity
  HAVING SUM(ri.quantity) > si.quantity;
  ```

---

## PHASE 2 — Stock Data Cleanup (Correct the corrupted stock)

> ⚠️ The double-return loop inflated `stock_quantity` on multiple variants.  
> Run these queries to understand the damage, then correct it.

- [x] **2.1** Audit stock for ZARE-40-M (the most affected variant):
  ```sql
  -- Real stock = what was received - what was sold + what was legitimately returned
  SELECT
      v.sku,
      v.stock_quantity AS current_db_stock,
      COALESCE(sm_in.total_in, 0) AS total_received,
      COALESCE(sm_out.total_sold, 0) AS total_sold,
      COALESCE(sm_ret.total_returned, 0) AS total_returned,
      (COALESCE(sm_in.total_in, 0) - COALESCE(sm_out.total_sold, 0) + COALESCE(sm_ret.total_returned, 0)) AS expected_stock
  FROM variants v
  LEFT JOIN (
      SELECT variant_id, SUM(quantity_change) as total_in FROM stock_movements WHERE movement_type IN ('restock','initial') GROUP BY variant_id
  ) sm_in ON sm_in.variant_id = v.id
  LEFT JOIN (
      SELECT variant_id, ABS(SUM(quantity_change)) as total_sold FROM stock_movements WHERE movement_type = 'sale' GROUP BY variant_id
  ) sm_out ON sm_out.variant_id = v.id
  LEFT JOIN (
      SELECT variant_id, SUM(quantity_change) as total_returned FROM stock_movements WHERE movement_type = 'return' GROUP BY variant_id
  ) sm_ret ON sm_ret.variant_id = v.id
  WHERE v.barcode = '2003323196625';
  ```

- [x] **2.2** Full stock integrity check across ALL variants:
  ```sql
  SELECT
      v.sku, v.barcode,
      v.stock_quantity AS current_db_stock,
      (COALESCE(sm_in.total_in, 0) - COALESCE(sm_out.total_sold, 0) + COALESCE(sm_ret.total_returned, 0)) AS expected_stock,
      (v.stock_quantity - (COALESCE(sm_in.total_in, 0) - COALESCE(sm_out.total_sold, 0) + COALESCE(sm_ret.total_returned, 0))) AS discrepancy
  FROM variants v
  LEFT JOIN (SELECT variant_id, SUM(quantity_change) as total_in FROM stock_movements WHERE movement_type IN ('restock','initial') GROUP BY variant_id) sm_in ON sm_in.variant_id = v.id
  LEFT JOIN (SELECT variant_id, ABS(SUM(quantity_change)) as total_sold FROM stock_movements WHERE movement_type = 'sale' GROUP BY variant_id) sm_out ON sm_out.variant_id = v.id
  LEFT JOIN (SELECT variant_id, SUM(quantity_change) as total_returned FROM stock_movements WHERE movement_type = 'return' GROUP BY variant_id) sm_ret ON sm_ret.variant_id = v.id
  WHERE v.stock_quantity != (COALESCE(sm_in.total_in, 0) - COALESCE(sm_out.total_sold, 0) + COALESCE(sm_ret.total_returned, 0))
  ORDER BY discrepancy DESC;
  ```

- [x] **2.3** For each variant with a discrepancy, manually set the correct stock:
  ```sql
  -- Example: set ZARE-40-M back to real physical count (you need to verify physically)
  -- UPDATE variants SET stock_quantity = <real_count> WHERE barcode = '2003323196625';
  ```

> [!IMPORTANT]
> Before running 2.3, physically count the items in your store and use **the real physical count** as the correct stock value. The DB is corrupted — only your physical inventory tells the truth.

---

## PHASE 3 — Clean Up Fake Sales & Returns (Optional but Recommended)

> The 17+ fake sell/return cycles from today (14/11/2026 00:57–01:18) created ghost entries.  
> You can delete them or keep them with a note. Keeping is safer for audit trail.

- [x] **3.1** Identify the ghost sales (all ZARE-40-M sales on 14/11/2026 that were immediately returned):
  ```sql
  -- Sales of ZARE-40-M on 14 Nov that have been fully returned
  SELECT s.id, s.created_at, s.final_amount,
      (SELECT COUNT(*) FROM returns r WHERE r.original_sale_id = s.id) as return_count
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  JOIN variants v ON v.id = si.variant_id
  WHERE v.barcode = '2003323196625'
    AND s.created_at >= '2026-11-14 00:00:00'
  ORDER BY s.created_at;
  ```

- [x] **3.2** Decide: **Keep** (recommended — for audit trail) or **Delete** ghost cycles
  - If keeping: add a note in the reason field of each return marking them as "test/bug loop"
  - If deleting: use the cleanup script provided separately

- [x] **3.3** The 2 remaining open sales (`#e5548eaa`, `#3c541941`) that show up in the return modal:
  - After Phase 1 fixes, the cashier can now search and return them normally at the POS
  - These 2 sales are real (manager sold them, they haven't been returned yet)
  - **Return them normally via the POS Return modal**

---

## PHASE 4 — Verify the Fix Works End-to-End

- [ ] **4.1** Refresh POS in browser (Ctrl+F5 / hard reload)
- [ ] **4.2** Manager makes a test sale of any item (e.g., scan any barcode at `/inventory`)
- [ ] **4.3** At cashier POS (`/pos`) → click **Retour/Échange** → scan the same barcode
  - ✅ The sale should now appear (not "introuvable")
- [ ] **4.4** Try to return the item once → should succeed
- [ ] **4.5** Try to return the SAME item again → should get error: `Cannot return X unit(s): already returned...`
- [ ] **4.6** Check stock after return — should be +1 exactly (not +2 or +17)
- [ ] **4.7** Check daily summary bar — returns count and amounts should be accurate

---

## PHASE 5 — Prevent This From Happening Again

- [ ] **5.1** Add a UI warning in the return modal if a sale has already been fully returned (already shows "Déjà retourné" badge — verify it works post-fix)
- [ ] **5.2** Add a Supabase unique constraint or trigger to hard-block over-returns at DB level (belt-and-suspenders beyond the function fix)
  ```sql
  -- Optional: DB-level trigger to prevent over-returning
  -- (The function fix in Phase 1.5 already handles this — this is extra safety)
  ```
- [ ] **5.3** Consider adding a manager-only "Stock Integrity Report" page that flags discrepancies between `variants.stock_quantity` and computed stock from movements

---

## 📊 Summary of What Was Broken

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Manager sale invisible at POS | RLS `sales_select_policy` filtered by `cashier_id = auth.uid()` | Phase 1.1–1.4: open SELECT to all authenticated |
| "Déjà retourné" on valid sale | Same RLS — sale not found = treated as returned | Fixed by Phase 1.1 |
| Same item returned 17+ times | `process_return_exchange` never checked prior returns | Phase 1.5: added SUM check |
| Stock inflated by ghost returns | Consequence of double-return bug | Phase 2: manual stock correction |
| Duplicate open sales in return modal | Test cycles not cleaned up | Phase 3: cleanup decision |

---

> [!CAUTION]
> Do Phase 1 BEFORE anything else. Without the DB fix, any new sales or returns will keep creating corrupted data.

> [!TIP]
> After Phase 1, the two open sales (`#e5548eaa` and `#3c541941` from the screenshot) can be returned normally at the cashier POS. No need to delete them.
