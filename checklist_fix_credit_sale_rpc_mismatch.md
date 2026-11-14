# Checklist: Fix `create_credit_sale` RPC Signature Mismatch

> **Status**: ❌ Error persists — the old function is still live in Supabase.

---

## 🔍 Root Cause (Confirmed)

**Supabase currently has the OLD function** with this 9-argument signature:
```
p_customer_name text, p_customer_phone text, p_customer_address text,
p_customer_cin text, p_items jsonb, p_deposit_amount numeric,
p_deposit_payment_method text, p_due_date date, p_notes text
```

**The frontend (`src/app/pos/page.tsx:L606-L615`) calls it with these 8 arguments (alphabetically sorted by PostgREST):**
```
p_cashier_id, p_customer_name, p_customer_phone,
p_deposit_amount, p_deposit_method, p_due_date, p_items, p_notes
```

**Two mismatches:**
| Old DB Function | Frontend Call |
|---|---|
| `p_customer_address TEXT` | ❌ Not sent |
| `p_customer_cin TEXT` | ❌ Not sent |
| `p_deposit_payment_method TEXT` | ❌ Frontend sends `p_deposit_method` |
| ❌ Missing | `p_cashier_id UUID` |

The previous `DROP + CREATE OR REPLACE` migration was **cancelled** and never ran.

---

## ✅ Fix Strategy

**Option A — Fix the DB (Drop old, deploy new)**
Drop the old 9-argument function and create the new 8-argument one that matches the frontend exactly.

---

## 📋 Implementation Checklist

### Phase 1: Drop the Old Function in Supabase
- [x] **1.1 Confirm the exact old signature in Supabase**
  - Query: `SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p WHERE p.proname = 'create_credit_sale';`
  - Confirmed result: `p_customer_name text, p_customer_phone text, p_customer_address text, p_customer_cin text, p_items jsonb, p_deposit_amount numeric, p_deposit_payment_method text, p_due_date date, p_notes text` ✅

- [x] **1.2 Drop old function + create new one (single atomic SQL block)**
  - Execute in Supabase SQL Editor:
    ```sql
    -- Step 1: Drop the OLD mismatched function
    DROP FUNCTION IF EXISTS public.create_credit_sale(
        text, text, text, text, jsonb, numeric, text, date, text
    );

    -- Step 2: Create the NEW function matching the frontend exactly
    CREATE OR REPLACE FUNCTION public.create_credit_sale(
        p_customer_name  TEXT,
        p_customer_phone TEXT,
        p_items          JSONB,
        p_deposit_amount NUMERIC  DEFAULT 0.000,
        p_deposit_method TEXT     DEFAULT NULL,
        p_due_date       DATE     DEFAULT NULL,
        p_notes          TEXT     DEFAULT NULL,
        p_cashier_id     UUID     DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    ... (full function body) ...
    $func$;

    -- Step 3: Grant permissions
    GRANT EXECUTE ON FUNCTION public.create_credit_sale TO authenticated, service_role;

    -- Step 4: Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
    ```

- [ ] **1.3 Verify the new function signature is correct**
  - Query:
    ```sql
    SELECT pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p WHERE p.proname = 'create_credit_sale';
    ```
  - Expected: `p_customer_name text, p_customer_phone text, p_items jsonb, p_deposit_amount numeric, p_deposit_method text, p_due_date date, p_notes text, p_cashier_id uuid`

### Phase 2: Verify End-to-End
- [ ] **2.1 Test credit sale from `/pos`**
  - Add item to cart → "Vente à Crédit" tab → enter name + phone → Valider
  - No schema cache error → receipt modal opens.
- [ ] **2.2 Verify row in Supabase `customer_credits` table**
  - Row exists with correct `customer_name`, `customer_phone`, `remaining_balance`, `status`.
- [ ] **2.3 Verify stock was decremented**
  - `variants.stock_quantity` reduced by the correct amount.
- [ ] **2.4 Verify `stock_movements` row with `movement_type = 'credit_sale'`**
  - Row inserted with correct `variant_id`, `quantity_change`, `created_by`.
- [ ] **2.5 Verify `credit_items` rows**
  - One row per cart item with correct `credit_id`, `product_name`, `sku`, `unit_price`, `subtotal`.
- [ ] **2.6 If deposit > 0: verify `credit_payments` row**
  - Row inserted with correct `credit_id`, `amount`, `payment_method`.

