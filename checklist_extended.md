# Top Tendance - Detailed POS & Inventory Implementation Plan

## Non-Negotiable Architecture Rules
- [ ] **Currency & Math**: All money columns MUST be `numeric(12,3)`. Never use `float` or `real`.
- [ ] **Cost Isolation**: `cost_price` lives strictly in `variant_costs` (accessible ONLY to managers).
- [ ] **Identity Security**: Never pass `user_id` as a function argument. Always derive identity via `auth.uid()`.
- [ ] **Price Tamper-Proofing**: `complete_sale()` receives ONLY `variant_id` + `quantity`. Unit prices are fetched server-side from `variants.selling_price`.
- [ ] **Strict Write Permissions**: Cashiers have ZERO direct `INSERT`/`UPDATE` on `sales`, `sale_items`, `variants`, or `stock_movements`. All sales occur through `complete_sale()`.
- [ ] **Manager Gatekeeping**: `receive_stock()` and `process_return()` enforce `role = 'manager'` via `auth.uid()`.
- [ ] **Function Hardening**: All RPC functions are `SECURITY DEFINER` with `SET search_path = public`.
- [ ] **Row Level Security**: Enabled on 100% of tables.
- [ ] **Client Security**: `service_role` key is strictly forbidden in frontend code.

---

## Step 1: Environment & Connectivity
- [x] Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Vercel/local `.env` (never expose `service_role`).
- [x] Initialize Supabase client in project.
- [x] Verify connectivity with a read-only test query.

---

## Step 2: Database Schema & Constraints (Supabase SQL Editor)
- [x] **Tables (`numeric(12,3)` for all financial columns)**:
  - `profiles`: `id` (references auth.users), `full_name`, `role` (`cashier` | `manager`), `created_at`
  - `categories`: `id`, `name`, `description`
  - `products`: `id`, `category_id`, `name`, `brand`, `is_active` (boolean, default true), `created_at`
  - `variants`: `id`, `product_id`, `sku`, `barcode`, `size`, `color`, `selling_price` (`numeric(12,3)`), `stock_quantity` (int, default 0), `low_stock_threshold` (int, default 5), `is_active` (default true)
  - `variant_costs`: `id`, `variant_id` (unique, references variants), `cost_price` (`numeric(12,3)`), `updated_at`, `updated_by` (references profiles)
  - `sales`: `id`, `cashier_id` (references profiles), `total_amount` (`numeric(12,3)`), `discount_amount` (`numeric(12,3)`), `final_amount` (`numeric(12,3)`), `payment_method` (`cash` | `card` | `split`), `created_at`
  - `sale_items`: `id`, `sale_id`, `variant_id`, `quantity` (int), `unit_price` (`numeric(12,3)`), `unit_cost` (`numeric(12,3)` snapshot from `variant_costs`), `subtotal` (`numeric(12,3)`)
  - `stock_movements`: `id`, `variant_id`, `quantity_change` (int), `movement_type` (`sale`, `restock`, `return`, `adjustment`), `reason` (text), `created_by` (references profiles), `created_at`
- [x] **Constraints & Indexes**:
  - Unique constraint + B-Tree index on `variants.barcode`
  - Unique constraint on `variants.sku`
  - Check constraint: `variants.stock_quantity >= 0`
  - Foreign key relations with `ON DELETE RESTRICT` for `variants` -> `sale_items` to protect sales history.

---

## Step 3: Core Transaction Logic (Postgres Functions / RPC)
- [x] **`complete_sale(p_items JSONB, p_payment_method TEXT, p_discount numeric(12,3) DEFAULT 0)`**:
  - `SECURITY DEFINER` with `SET search_path = public`
  - Derive `v_cashier_id := auth.uid()`. Check caller has active profile.
  - Acquire row locks (`SELECT ... FOR UPDATE`) on target `variants`.
  - Validate stock availability for all items; raise exception if insufficient.
  - Fetch `selling_price` from `variants` and `cost_price` from `variant_costs`.
  - Calculate `total_amount` and `final_amount` purely server-side.
  - Insert row into `sales`.
  - Bulk insert into `sale_items` with unit price and unit cost snapshots.
  - Decrement `variants.stock_quantity`.
  - Insert rows into `stock_movements` (type = `sale`, `created_by = auth.uid()`).
  - Return created `sale_id` and receipt details.
- [x] **`receive_stock(p_items JSONB)`**:
  - `SECURITY DEFINER` with `SET search_path = public`
  - Enforce caller verification: `profiles.role = 'manager'` using `auth.uid()`.
  - Update `variants.stock_quantity` (`+ quantity`).
  - Upsert `variant_costs.cost_price` if new cost provided.
  - Insert audit rows into `stock_movements` (type = `restock`, `created_by = auth.uid()`).
- [x] **`process_return(p_sale_item_id UUID, p_quantity INT, p_reason TEXT)`**:
  - `SECURITY DEFINER` with `SET search_path = public`
  - Enforce caller verification: `profiles.role = 'manager'` using `auth.uid()`.
  - Validate return quantity <= original sold quantity in `sale_items`.
  - Increment `variants.stock_quantity`.
  - Insert row into `stock_movements` (type = `return`, `created_by = auth.uid()`).

---

## Step 4: Security & Row Level Security (RLS)
- [x] Enable RLS on every table.
- [x] Create helper function: `is_manager()` -> `EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')`.
- [x] **Table Policies**:
  - `profiles`: All authenticated users can read their own row; managers can read all.
  - `categories` & `products` & `variants`:
    - Read: `cashier` & `manager` (`is_active = true` for cashier).
    - Insert/Update/Delete: `manager` only.
  - `variant_costs`: `SELECT`, `INSERT`, `UPDATE` strictly restricted to `manager`. Cashiers have NO access.
  - `sales` & `sale_items`:
    - Cashiers: `SELECT` only their own sales (`cashier_id = auth.uid()`). No direct `INSERT`/`UPDATE` (handled by `complete_sale`).
    - Managers: `SELECT` all.
  - `stock_movements`:
    - Cashiers: No direct access.
    - Managers: Full `SELECT` (read-only audit log).
- [x] Provision initial manager user in Supabase Auth.

---

## Step 5: Cashier Screen (POS MVP)
- [x] Cashier login screen with authentication state handling.
- [x] Barcode scanning input with persistent focus, Enter debouncing, and beep sound triggers.
- [x] Name / SKU search fallback drawer.
- [x] Cart state management (scanned items pass only `{variant_id, quantity}` to checkout).
- [x] Payment drawer:
  - Cash tendered with automatic change calculation (`numeric(12,3)` precision).
  - Card/Split payment options.
  - Hotkeys (`F2` focus, `F9` pay, `Esc` close).
- [x] Call `complete_sale` RPC and display thermal-printable receipt modal on success.

---

## Step 6: Manager Dashboard & Inventory
- [x] Product & Variant CRUD (including size, color, barcode, selling price, and manager-only cost price).
- [x] Barcode tag generator with thermal print layout (`@page { size: 50mm 30mm }`).
- [x] Low-stock monitoring dashboard.
- [x] Delivery receiving form calling `receive_stock`.

---

## Step 7: Reports & Analytics (Manager Only)
- [x] Daily sales report (Gross revenue, net profit calculated from `sale_items.unit_price - sale_items.unit_cost`, payment method breakdown).
- [x] Current stock valuation: `SUM(variants.stock_quantity * variant_costs.cost_price)`.
- [x] Best-sellers and stock movement audit log viewer.
