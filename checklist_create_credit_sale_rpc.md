# Checklist: Resolution for `create_credit_sale` Missing RPC Function

> **Issue**: When attempting to complete a credit sale in `/pos`, Supabase returns:
> `Could not find the function public.create_credit_sale(p_cashier_id, p_customer_name, p_customer_phone, p_deposit_amount, p_deposit_method, p_due_date, p_items, p_notes) in the schema cache`

---

## 🔍 Root Cause Analysis
1. While `supabase_step9_credit_payment_rpc.sql` was implemented for installments (`record_credit_payment`), the initial credit checkout RPC `public.create_credit_sale` was not defined or deployed in PostgreSQL.
2. In `src/app/pos/page.tsx:L606-L615`, the frontend calls `supabase.rpc('create_credit_sale', { ... })` with the following parameters:
   - `p_customer_name`: `TEXT` (required)
   - `p_customer_phone`: `TEXT` (required)
   - `p_items`: `JSONB` (required, array of items: `variant_id`, `quantity`, `unit_price`, `product_name`, `sku`, `size`, `color`)
   - `p_deposit_amount`: `NUMERIC` (default 0.000)
   - `p_deposit_method`: `TEXT` ('cash' | 'card' | NULL)
   - `p_due_date`: `DATE` (NULL if not specified)
   - `p_notes`: `TEXT` (NULL if not specified)
   - `p_cashier_id`: `UUID` (NULL fallback, or resolved via `auth.uid()`)
3. The table schema for `customer_credits`, `credit_items`, and `credit_payments` also needs to ensure all required tables and constraints exist before the function can execute.

---

## 📋 Implementation Checklist

### Phase 1: SQL Definition (`supabase_step13_create_credit_sale_rpc.sql`)
- [x] **1.1 Table & Schema Pre-checks**
  - Ensure `customer_credits`, `credit_items`, and `credit_payments` tables exist with correct types and constraints.
  - Verify `stock_movements` table accepts `movement_type = 'credit_sale'` (or drop/adjust check constraints if necessary).

- [x] **1.2 Create Atomic RPC `public.create_credit_sale`**
  - Function signature matching frontend invocation:
    ```sql
    CREATE OR REPLACE FUNCTION public.create_credit_sale(
        p_customer_name   TEXT,
        p_customer_phone  TEXT,
        p_items           JSONB,
        p_deposit_amount  NUMERIC DEFAULT 0.000,
        p_deposit_method  TEXT DEFAULT NULL,
        p_due_date        DATE DEFAULT NULL,
        p_notes           TEXT DEFAULT NULL,
        p_cashier_id      UUID DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    ```
  - **Validation & Guards**:
    - Reject empty `p_customer_name` or `p_customer_phone`.
    - Reject empty items list (`jsonb_array_length(p_items) = 0`).
    - Validate `p_deposit_amount >= 0`.
    - Validate `p_deposit_method IN ('cash', 'card')` when `p_deposit_amount > 0`.
  - **Atomic Stock Checks & Locking**:
    - Loop over `p_items`, lock each variant (`FOR UPDATE`).
    - Verify sufficient `stock_quantity >= item.quantity`. Raise exception if insufficient.
    - Decrement variant stock: `UPDATE public.variants SET stock_quantity = stock_quantity - v_qty`.
    - Log stock movement: `INSERT INTO public.stock_movements (variant_id, quantity_change, movement_type, reference_id, created_by) VALUES (v_variant_id, -v_qty, 'credit_sale', v_credit_id, v_cashier_id)`.
  - **Total & Debt Calculations**:
    - Sum item subtotals: `v_total_amount = sum(unit_price * quantity)`.
    - Validate `p_deposit_amount <= v_total_amount`.
    - Compute `v_remaining_balance = v_total_amount - p_deposit_amount`.
    - Determine status:
      - If `v_remaining_balance = 0` $\rightarrow$ `'settled'`
      - If `p_deposit_amount > 0` $\rightarrow$ `'partially_paid'`
      - Else $\rightarrow$ `'pending'`
  - **Insert Records**:
    - Insert into `public.customer_credits` (returning `id` as `v_credit_id`).
    - Insert each item into `public.credit_items`.
    - If `p_deposit_amount > 0`:
      - Insert payment row into `public.credit_payments`.
  - **Return JSONB**:
    - Return `jsonb_build_object('success', true, 'credit_id', v_credit_id, 'total_amount', v_total_amount, 'deposit_amount', p_deposit_amount, 'remaining_balance', v_remaining_balance, 'status', v_status)`.

- [x] **1.3 Permissions & Grants**
  - Grant execute permission to `authenticated` and `service_role`:
    ```sql
    GRANT EXECUTE ON FUNCTION public.create_credit_sale TO authenticated, service_role;
    ```

---

### Phase 2: Database Deployment & Cache Refresh
- [ ] **2.1 Execute SQL Migration in Supabase**
  - Run the SQL file in the Supabase SQL editor or via Supabase CLI.
  - Reload PostgREST schema cache:
    ```sql
    NOTIFY pgrst, 'reload schema';
    ```

---

### Phase 3: Verification & End-to-End Testing
- [ ] **3.1 Test Credit Sale with Deposit**:
  - Add item to cart on `/pos`.
  - Open "Vente à Crédit / Paiement Différé".
  - Enter name, phone, deposit amount (e.g. 20 DT), method (Espèces).
  - Submit $\rightarrow$ Verify stock drops, credit record created, debtor receipt opens.
- [ ] **3.2 Test Credit Sale without Deposit (100% Credit)**:
  - Submit credit sale with deposit = 0 DT $\rightarrow$ Status `'pending'`, full remaining balance due.
- [ ] **3.3 Verify in Carnet de Crédit (`CreditLedger.tsx`)**:
  - Customer appears in list with remaining debt, items list, and payment history.

