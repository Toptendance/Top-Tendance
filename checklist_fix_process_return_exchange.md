# Checklist: Fix `process_return_exchange` — Missing Supabase RPC Function

## 🔍 Root Cause

The frontend calls `supabase.rpc('process_return_exchange', {...})` from `ReturnExchangeModal.tsx` but the function **does not exist in the live Supabase database**.

The error shown in the POS UI:
> `Could not find the function public.process_return_exchange(p_original_sale_id, p_reason, p_refund_method, p_return_type, p_returned_items) in the schema cache`

The SQL definition exists locally in `supabase_step8_returns.sql` — it was **never applied** to the live database.

---

## 📋 What Needs to Be Done

### Phase 1: Apply Missing SQL to Supabase (Database)

- [x] **Connect to the live Supabase project** (via Dashboard SQL Editor or Supabase CLI).
- [x] **Apply `supabase_step8_returns.sql`** in full — it contains:
  - `CREATE TABLE public.returns` — the return records table.
  - `CREATE TABLE public.return_items` — the line-item detail per return.
  - RLS policies on both tables (select + insert).
  - `CREATE OR REPLACE FUNCTION public.process_return_exchange(...)` — the core RPC.
- [x] **Verify the function signature** matches what the frontend sends:
  - `p_original_sale_id UUID`
  - `p_returned_items JSONB`
  - `p_return_type TEXT` → `'refund'` | `'exchange'`
  - `p_refund_method TEXT` → `'cash'` | `'card'` | `'store_credit'`
  - `p_reason TEXT DEFAULT NULL`
- [x] **Reload the PostgREST schema cache** after applying the function:
  - In Supabase Dashboard: **API → Reload schema** button, or
  - Run: `NOTIFY pgrst, 'reload schema';` in the SQL Editor.

---

### Phase 2: Verify Database Tables Exist

- [x] Confirm `public.returns` table exists with correct columns.
- [x] Confirm `public.return_items` table exists with correct columns.
- [x] Confirm FK from `returns.original_sale_id → sales.id` is active.
- [x] Confirm FK from `return_items.variant_id → variants.id` is active.
- [x] Confirm `stock_movements` table exists (the function inserts audit rows into it).

---

### Phase 3: End-to-End Functional Test

- [ ] **Open the POS** (`/pos`) and complete a sale.
- [ ] **Open the Return Modal** and search for the ticket by ID or barcode.
- [ ] **Select 1+ items** to return (verify qty controls work).
- [ ] **Choose Remboursement / Annulation** → select a refund method → click **Valider**.
  - Expected: Green success banner, `total_refunded_amount` shown, stock restocked.
  - Expected: A row inserted in `returns` table, rows in `return_items`, row in `stock_movements`.
- [ ] **Choose Échange Immédiat** → click **Appliquer Avoir Échange**.
  - Expected: Exchange credit amount propagated back to POS cart.
- [ ] **Check `/reports`** → Confirm the `stock_movements` audit table shows a `return` movement type for the returned variant.

---

### Phase 4: (Optional) Add Rerun-safe Migration File

- [ ] Create a dedicated migration SQL file (e.g., `supabase_migration_returns.sql`) that uses `CREATE OR REPLACE FUNCTION` and `CREATE TABLE IF NOT EXISTS` so it is safe to re-run without errors.
- [ ] Document the step in the project README so the next developer knows to apply it on new Supabase instances.

---

## ⚠️ Notes

> [!CAUTION]
> Do **not** drop and recreate the `returns` or `return_items` tables if they already contain live data. Use `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`.

> [!IMPORTANT]
> The function uses `SECURITY DEFINER` — it runs with the permissions of the creator (service role). This is correct for POS operations and allows stock updates and audit writes even under strict RLS policies.

> [!NOTE]
> The PostgREST schema cache **must be reloaded** after adding a new function. Without the reload, the API gateway won't see the new function even if it was successfully created in PostgreSQL.

