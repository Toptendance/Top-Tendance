# Top Tendance — Project Context & Session Memory

> **Purpose**: Read this file at the start of every session instead of re-scanning the whole codebase.
> Keep it updated after every phase or significant change.

---

## 1. System Architecture & Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| **Framework** | Next.js 14 (App Router, `src/` layout) | TypeScript (strict), SSG + Client Hydration |
| **Styling** | Tailwind CSS v3 (custom config) | Fonts: `Playfair Display`, `Outfit`, `Inter` |
| **Database & Auth** | Supabase (PostgreSQL 15 + GoTrue) | Project: `uqwvbbuxriiduedhdqwl` (region: `eu-west-2`) |
| **Client / SSR** | `@supabase/ssr` (`createBrowserClient`) | Cookie-based session sharing between client & middleware |
| **Middleware** | `src/middleware.ts` (`@supabase/ssr`) | Protects `/account`, `/pos`, `/inventory`, `/reports` |
| **Icons & Audio** | `lucide-react`, Web Audio API (`posAudio.ts`) | Barcode scanner sounds (success / error beeps) |
| **Barcodes** | `jsbarcode` (Code-128 / EAN-13) | HERMA A4/40 sticker sheets (52.5mm × 29.7mm, 4 cols × 10 rows), Canon G2410 calibration |
| **Currency** | Tunisian Dinar (`TND` / `DT`) | All financial DB columns: `numeric(12,3)` |
| **Production Domain** | `https://toptendance.net` | Supabase Site URL & Redirect URLs configured |

---

## 2. Roles, Authentication & Route Protection

The system supports **3 distinct user roles** managed via the `profiles` table in Supabase:

| Role | Permissions & Access | Default Land Route | Test Credentials |
|---|---|---|---|
| **Manager** (`manager`) | Full POS, Inventory Management, Barcode Printing, Soft-delete Products, Category Management, Cashier Management, Analytics & Reports (including Costs, Margins, Stock Cost Valuation) | `/inventory` | `manager@toptendance.tn` / `TopTendance2026!Manager` |
| **Cashier** (`cashier`) | Point of Sale (`/pos`), Barcode scanning, Receipt generation, complete sale RPC, Carnet de Crédit (Sales, Repayments, Returns, Manual Old Debt Entry), Expéditions & Colis, Boutique view & tag printing (`/inventory`), Reports & Analytics (`/reports` — turnover, payment breakdown, sales journal; sensitive purchase costs/margins masked) | `/pos` | `cashier@toptendance.tn` / `TopTendance2026!Cashier` |
| **Customer** (`customer` / null) | E-commerce boutique, Orders history, Address carnet, Wishlist, Profile | `/account` | Any registered client account |

### Key Route Protection (`src/middleware.ts`):
- `/account`: Requires authenticated user.
- `/pos`: Requires authenticated user with role `cashier` OR `manager`.
- `/inventory` & `/reports`: Requires authenticated user with role `cashier` OR `manager`. Unauthenticated users redirected to `/login`, customers redirected to `/account`.
- Authentication uses **HTTP Cookies** via `@supabase/ssr` (syncs between login client & server middleware).

---

## 3. Database Schema & Security Architecture

### Tables in Supabase (`public` schema)
1. `profiles`: `id (uuid PK)`, `role (text: 'manager'|'cashier'|'customer')`, `full_name`, `phone`, `is_active (bool default true)` *(Updated 2026-11-11 with role check & is_active)*
2. `categories`: `id (uuid PK)`, `name (text)`, `description (text)`
3. `products`: `id (uuid PK)`, `name`, `brand`, `category_id (FK)`, `is_active (bool default true)`
4. `variants`: `id (uuid PK)`, `product_id (FK)`, `sku (unique)`, `barcode (unique)`, `size`, `color`, `selling_price (numeric 12,3)`, `stock_quantity (int)`, `low_stock_threshold (int)`, `is_active (bool default true)`, `is_printed (bool default false)`, `last_printed_at (timestamptz default null)` *(Updated 2026-11-10)*
5. `variant_costs`: `variant_id (FK PK)`, `cost_price (numeric 12,3)` *(Isolated from Cashiers via RLS)*
6. `sales`: `id (uuid PK)`, `cashier_id (FK)`, `customer_id (FK null)`, `customer_phone`, `total_amount`, `payment_method ('cash'|'card'|'split')`, `discount_amount`, `created_at`
7. `sale_items`: `id (uuid PK)`, `sale_id (FK)`, `variant_id (FK)`, `quantity`, `unit_price`, `subtotal` *(no `created_at` column)*
8. `stock_movements`: `id (uuid PK)`, `variant_id (FK)`, `quantity_change`, `movement_type ('sale'|'receiving'|'return'|'adjustment')`, `reference_id`, `created_by`
9. `returns`: `id (uuid PK)`, `original_sale_id (FK→sales)`, `cashier_id (FK→profiles)`, `return_type ('refund'|'exchange')`, `total_refunded_amount (numeric 12,3)`, `refund_payment_method ('cash'|'card'|'store_credit')`, `reason`, `created_at` *(Added 2026-11-09)*
10. `return_items`: `id (uuid PK)`, `return_id (FK→returns CASCADE)`, `sale_item_id (FK→sale_items SET NULL)`, `variant_id (FK→variants)`, `quantity`, `unit_price`, `subtotal` *(Added 2026-11-09)*
11. `customer_addresses`: `id (uuid PK)`, `user_id (FK)`, `label`, `recipient_name`, `phone`, `city`, `governorate`, `postal_code`, `is_default`
12. `customer_wishlists`: `id (uuid PK)`, `user_id (FK)`, `variant_id (FK)`, `created_at`
13. `customer_credits`: `id (uuid PK)`, `customer_name`, `customer_phone`, `customer_address`, `customer_cin`, `total_amount (numeric 12,3)`, `deposit_amount (numeric 12,3)`, `remaining_balance (numeric 12,3)`, `status ('pending'|'partially_paid'|'settled'|'cancelled')`, `due_date`, `notes`, `cashier_id (FK→profiles)`, `created_at`, `updated_at` *(Added 2026-11-12)*
14. `credit_items`: `id (uuid PK)`, `credit_id (FK→customer_credits CASCADE)`, `variant_id (FK→variants)`, `product_name`, `sku`, `size`, `color`, `quantity`, `returned_quantity (int default 0)`, `unit_price`, `subtotal` *(Updated 2026-11-13: `returned_quantity` tracks credit returns)*
15. `credit_payments`: `id (uuid PK)`, `credit_id (FK→customer_credits CASCADE)`, `amount (numeric 12,3)`, `payment_method ('cash'|'card')`, `received_by (FK→profiles)`, `notes`, `created_at` *(Added 2026-11-12)*
16. `deliveries`: `id (uuid PK)`, `tracking_number`, `courier_name ('Aramex'|'Yalidine'|'Express'|'Livraison Propre')`, `recipient_name`, `recipient_phone`, `recipient_phone_alt`, `address`, `city`, `governorate (24 gouvernorats)`, `cod_amount (numeric 12,3)`, `shipping_fee (numeric 12,3)`, `status ('preparing'|'dispatched'|'in_transit'|'delivered'|'returned'|'cancelled')`, `payment_status ('unpaid'|'paid'|'remitted_by_courier')`, `notes`, `created_by (FK→profiles)`, `created_at`, `delivered_at` *(Added 2026-11-12)*
17. `delivery_items`: `id (uuid PK)`, `delivery_id (FK→deliveries CASCADE)`, `variant_id (FK→variants)`, `product_name`, `sku`, `size`, `color`, `quantity`, `unit_price` *(Added 2026-11-12)*

### RPC Functions (`SECURITY DEFINER`)
- `complete_sale(p_items jsonb, p_payment_method text, p_discount numeric)`: Atomically validates stock, inserts sale record + sale items, decrements stock quantities, logs stock movements. *(Updated 2026-11-10: Accepts `unit_price` in `p_items` JSONB to distribute global discounts directly to `sale_items.unit_price`, ensuring returns reflect the exact discounted price paid).*
- `receive_stock(p_items jsonb, p_supplier_name text, p_invoice_number text)`: Increases variant stock and logs receiving movements.
- `process_return_exchange(p_original_sale_id uuid, p_returned_items jsonb, p_return_type text, p_refund_method text, p_reason text)`: Atomically records a return or exchange, restores stock, logs stock movements. Returns JSONB with return_id and totals. *(Applied via `supabase_step8_returns.sql` on 2026-11-09)*
- `create_credit_sale(p_customer_name, p_customer_phone, p_customer_address, p_customer_cin, p_items, p_deposit_amount, p_deposit_payment_method, p_due_date, p_notes)`: Atomically creates credit record, decrements variant stock, logs `stock_movements` (`movement_type = 'credit_sale'`), inserts credit items and initial deposit payment. *(Added 2026-11-12)*
- `record_credit_payment(p_credit_id, p_amount, p_payment_method, p_received_by, p_notes)`: Atomically records repayment installment in `credit_payments`, deducts from `remaining_balance`, and updates status (`'partially_paid'` or `'settled'`). *(Added 2026-11-12)*
- `return_credit_item(p_credit_item_id, p_quantity, p_returned_by, p_reason)`: Atomically returns a credit-sold article: restores `variants.stock_quantity`, logs a `stock_movements` row (`movement_type = 'credit_return'`), increments `credit_items.returned_quantity`, and reduces `customer_credits.remaining_balance` (capped at 0, status → `'settled'` when cleared). **Never writes to `returns` / `credit_payments`, so the daily cash register is never impacted.** *(Added 2026-11-13)*
- `create_delivery_order(p_recipient_name, p_recipient_phone, p_address, p_city, p_governorate, p_items, p_tracking_number, p_courier_name, p_recipient_phone_alt, p_cod_amount, p_shipping_fee, p_status, p_payment_status, p_notes)`: Atomically creates delivery order, decrements variant stock, logs `stock_movements` (`movement_type = 'delivery_shipment'`), and inserts delivery items snapshot. *(Added 2026-11-12)*
- `process_delivery_return(p_delivery_id, p_notes)`: Atomically restores variant stock for returned packages, logs `stock_movements` (`movement_type = 'delivery_return'`), and marks delivery as `'returned'`. *(Added 2026-11-12)*
- `get_sales_analytics(p_start_date date, p_end_date date)`: Generates manager revenue and profit reports.
- `get_stock_valuation()`: Calculates total inventory value at cost price vs selling price.

---

## 4. Key Application Modules & File Structure

```
src/
├── app/
│   ├── account/page.tsx        ← Client dashboard: 4 tabs (Online Orders, Store Purchases, Addresses, Profile)
│   ├── inventory/page.tsx      ← Manager dashboard: Stock & articles, Équipe & Caissiers, Carnet de Crédit, Expéditions & Colis tabs
│   ├── pos/page.tsx            ← POS Cashier screen: Barcode auto-focus (F2), hotkeys (F9), cart, quick pay, credit sale, credit ledger drawer
│   ├── reports/page.tsx        ← Manager analytics: sales, profits, stock valuation
│   ├── login/page.tsx          ← Auth page with Google OAuth button + email login & intelligent redirect
│   ├── register/page.tsx       ← Register page with Google OAuth button + email signup
│   ├── auth/callback/route.ts  ← Next.js Route Handler exchanging OAuth code for session cookies & smart role redirect
│   ├── api/manager/cashiers/   ← Protected manager API route: list, create (admin), toggle status, reset password, delete cashiers
│   ├── privacy/ & terms/       ← Production-ready legal pages compliant with Google OAuth & Tunisian data laws
│   ├── women/ & kids/          ← E-commerce catalog pages (SSG)
│   └── product/[slug]/         ← Product Detail Page (PDP)
├── components/
│   ├── common/
│   │   ├── Header.tsx          ← Role-aware account menu (Guest / Client / Cashier / Manager shortcuts)
│   │   ├── MobileMenu.tsx      ← Mobile drawer with discrete staff access
│   │   └── Footer.tsx          ← Footer with discrete staff login link, privacy & terms links
│   ├── manager/
│   │   └── CashierManagementSection.tsx ← Manager cashier team management (roster table, add modal, status toggle, credentials reset)
│   ├── pos/
│   │   ├── BarcodeTagModal.tsx ← Multi-item batch & single A4 sticker printing (HERMA 40, 52.5mm × 29.7mm) with Canon G2410 offset calibration, dynamic multi-page layout, and auto "mark as printed" tracking
│   │   ├── DeliveryReceivingModal.tsx ← Delivery receiving popup calling receive_stock RPC
│   │   ├── PaymentDrawer.tsx   ← Cash / Card / Credit sale ("Paiement Différé") drawer with change calculator & debtor customer inputs
│   │   ├── ProductSearchDrawer.tsx ← Manual variant & SKU search modal
│   │   ├── ReturnExchangeModal.tsx ← Return & Exchange modal: universal barcode/UUID search, already-returned qty tracking, calls process_return_exchange RPC
│   │   ├── ReceiptModal.tsx    ← Post-sale ticket modal with printable receipt
│   │   ├── DailySalesSummary.tsx ← Live drawer cash header bar & breakdown: direct sales, credit installments, returns & Z-Report trigger
│   │   ├── ZReportModal.tsx    ← Printable Clôture de Caisse / Z-Report modal with cash drawer breakdown, TPE breakdown, and manager signature
│   │   ├── CreditLedger.tsx    ← Carnet de Crédit interface: debtor customer search, debt KPIs, payment installments modal, garment breakdown, credit item returns & manual old credit trigger
│   │   ├── CreditReceiptModal.tsx ← Printable "Bon de Vente à Crédit / Débiteur" ticket with signature line and scannable code
│   │   ├── ManualCreditModal.tsx ← Modal for manual entry of historical/old credits without items (preserves inventory accuracy)
│   │   ├── DeliveryManagementSection.tsx ← Expéditions & Colis dashboard: Kanban pipeline, detailed list, governorate filters, quick status updates
│   │   ├── NewDeliveryModal.tsx ← Modal for creating shipments across 24 Tunisian governorates, barcode scan/variant selector, COD calculation
│   │   └── DeliveryShippingSlipModal.tsx ← Printable "Bordereau d'Expédition" with Code-128 barcode and recipient details
├── utils/
│   ├── supabaseClient.ts       ← createBrowserClient (@supabase/ssr) storing session in cookies
│   ├── posAudio.ts             ← Web Audio API scanner feedback (success / error beeps)
│   └── currency.ts             ← Dinar formatting (e.g., "149.000 DT")
```

---

## 5. Live Test Catalog & Barcodes (Ready for Scanning & Printing)

| Product | SKU | Barcode (EAN-13 / Code-128) | Attributes | Selling Price | Initial Stock |
|---|---|---|---|---|---|
| **Robe Soirée Satin** | `ROBE-SAT-NOIR-M` | `6191000000018` | M • Noir | 149.000 DT | 15 |
| **Chemise Lin Blanche** | `CHEM-LIN-BLC-L` | `6191000000025` | L • Blanc | 89.000 DT | 25 |
| **Blazer Oversize Camel** | `BLAZ-OVR-CAM-S` | `6191000000032` | S • Camel | 189.000 DT | 10 |
| **Pantalon Tailleur Noir** | `PANT-TAIL-NOIR-38` | `6191000000049` | 38 • Noir | 119.000 DT | 20 |
| **Robe Florale Été** | `ROBE-FLOR-M` | `6191234567890` | M • Floral | 89.500 DT | 20 |

---

## 6. Vercel Deployment Checklist

- **Required Environment Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL`: `https://uqwvbbuxriiduedhdqwl.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `ey...`
- **Supabase Auth Config**:
  - `site_url`: `https://toptendance.net`
  - `uri_allow_list`: `https://toptendance.net/**,http://localhost:3000/**`

---

## 7. Status & Last Session Recap

- **All checklists completed & verified**:
  - `checklist_extended.md` ✅ (POS, Inventory, RPCs, Thermal Barcodes, Analytics)
  - `checklist_client_dashboard.md` ✅ (Role-based Header, Supabase Client Dashboard, Next.js Middleware)
  - `checklist_auth_fix.md` ✅ (Cookie-based auth synchronization between client and middleware)
  - `checklist_delete_product.md` ✅ (Soft delete with confirmation dialog and RLS policies)
  - `checklist_test_products.md` ✅ (4 Fashion items with Tunisian barcodes, label printing verified)
  - `checklist_fix_process_return_exchange.md` ✅ — Phase 1 & 2 done (2026-11-09):
    - Applied `supabase_step8_returns.sql` to live Supabase: created `returns`, `return_items` tables + RLS + `process_return_exchange` RPC
    - Verified all FKs and `stock_movements` table
  - `checklist_fix_return_qr_scan.md` ✅ — Phase 1 done (2026-11-09):
    - Fixed `sale_items` query bug in `ReturnExchangeModal.tsx`: removed non-existent `created_at` column from select/order
    - Added already-returned quantity tracking: `fetchSaleById` now fetches `return_items` for the sale, `alreadyReturnedQtys` state drives max-returnable cap per item, barcode search filters out fully-returned sales from the picker
  - `checklist_multi_item_barcode_print.md` ✅ — Sections A, B, C & D done (2026-11-10):
    - **Multi-Selection UI**: Select All + row-level checkboxes on desktop & mobile with floating batch action toolbar.
    - **Multi-Item Modal (`BarcodeTagModal.tsx`)**: Item breakdown, per-item quantity steppers, global quantity presets, total labels / pages indicator, click-to-pick start position (1–40), and visual sheet color-coded mapping.
    - **Strict A4 Print Layout Engine**: Sequential pagination across 40-cell sheets (4 × 10), pre-skip and trailing empty cell padding, CSS print margins and vector Code-128 SVG barcodes.
    - **Mark as Printed Tracking**: `is_printed` & `last_printed_at` columns on `variants`, automatic update upon printing, manual toggle badge (`✓ Imprimé` / `Non imprimé`), status filter (`Tous | Non imprimés | Déjà imprimés`), and "Sélectionner non imprimés" button.
  - `checklist_return_discounted_price.md` ✅ — Sections A, B, C, D, E & F done (2026-11-10):
    - **Discount-Aware Returns (Bug 1)**: `pos/page.tsx` now proportionally distributes global cart discount across each cart item's effective `unit_price`; `complete_sale` RPC updated & redeployed on Supabase to persist effective prices into `sale_items.unit_price`. Returns now accurately display and refund the exact discounted price paid. Legacy sales warning banner added in `ReturnExchangeModal.tsx`.
    - **Post-Return Stock Cache Sync (Bug 2)**: Added `onReturnCompleted` callback to `ReturnExchangeModal.tsx` and handled in `pos/page.tsx`. Automatically increments in-memory `variantsCacheRef` stock quantities immediately upon return/exchange, eliminating the "rupture de stock" error when immediately re-scanning returned items without requiring a page refresh.
  - `checklist_fix_return_zero_qty.md` ✅ — (2026-11-10):
    - **Return Barcode Search Cutoff Fix**: Fixed issue where scanning a barcode (e.g. `2003323196434`) incorrectly reported "Article déjà retourné intégralement" when unreturned sales existed. In `src/components/pos/ReturnExchangeModal.tsx`, increased the `sale_items` lookup limit from 10 to 100 with descending order (`.order('sale_id', { ascending: false }).limit(100)`), ensuring all recent eligible sales are inspected.
  - `checklist_fix_auth_session_bounce.md` ✅ — Phases 1, 2, 3 & 4 done (2026-11-10):
    - **Auth Cookie Race Condition Fix**: In `src/app/login/page.tsx`, added `router.refresh()` prior to `router.push()` so Next.js App Router synchronizes browser session cookies with server middleware headers before navigation, resolving bounce-back to `/login` when clicking dashboard links.
    - **Double Submit & Freeze Prevention**: Maintained button `loading` state through redirect (only clearing `loading` in `catch`), preventing freeze and duplicate requests.
    - **Middleware Fail-Safe**: In `src/middleware.ts`, added explicit error handling for the `profiles` role lookup to immediately redirect to `/login` if DB fails or times out rather than hanging.
    - **Cleaned Obsolete UI**: Removed unused "Se souvenir de moi" checkbox and state from `src/app/login/page.tsx` as Supabase persistent sessions are managed automatically in client storage.
  - `checklist_auth_cashiers_credit_delivery.md` 🔄 — Phases 1, 2, 3, 4 & 5.1 completed (2026-11-12):
    - **Phase 1: Universal Google OAuth**:
      - Google Cloud & Supabase provider configured for `toptendance.net` with callback `https://uqwvbbuxriiduedhdqwl.supabase.co/auth/v1/callback`.
      - Supabase `profiles_role_check` constraint updated to include `'customer'`, `'cashier'`, and `'manager'`.
      - PostgreSQL trigger `on_auth_user_created -> public.handle_new_user()` deployed on `auth.users` to auto-provision user profiles on Google OAuth or direct signup while preserving elevated staff roles.
      - Next.js Route Handler `src/app/auth/callback/route.ts` deployed to exchange code for session cookies and intelligently redirect based on user role (`/inventory`, `/pos`, or `/account`).
      - "Continuer avec Google" button with official SVG integrated into `src/app/login/page.tsx` and `src/app/register/page.tsx`.
      - Production legal pages `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` deployed and linked in footer.
    - **Phase 2: Cashier Team Management from Manager Dashboard**:
      - Next.js API Route `src/app/api/manager/cashiers/route.ts` implemented: protected with manager-only verification, lists cashiers, creates accounts with verified credentials via Supabase Admin API (`auth.admin.createUser`), updates active status, resets passwords, and deletes accounts.
      - Component `src/components/manager/CashierManagementSection.tsx` created and embedded into `src/app/inventory/page.tsx` under a new "Équipe & Caissiers" tab, including KPI metric cards, searchable table, active/inactive toggle, and "Nouveau Caissier" modal with password generator.
    - **Phase 3: Credit Ledger ("Carnet de Crédit / Kredy")**:
      - Schema created in Supabase: `customer_credits`, `credit_items`, and `credit_payments` tables with indexes.
      - Atomic RPCs deployed and tested:
        - `create_credit_sale`: Atomic stock verification and deduction, logs `stock_movements` (`movement_type = 'credit_sale'`), creates credit record, line items, and optional initial deposit.
        - `record_credit_payment`: Atomic payment installment logging, deducts from `remaining_balance`, and updates status (`'partially_paid'` or `'settled'`).
      - POS checkout drawer (`PaymentDrawer.tsx`) equipped with "Vente à Crédit / Paiement Différé" tab (customer name, Tunisian phone validation, initial deposit, notes) and printable debtor receipt modal (`CreditReceiptModal.tsx`).
      - Dedicated "Carnet de Crédit" UI (`CreditLedger.tsx`) integrated into both POS drawer and Manager dashboard tab with debt KPIs, phone/name search, status filters, garment detail breakdown, and installment payment modal.
    - **Phase 4: Delivery Management ("Gestion des Livraisons & Colis")**:
      - Schema created in Supabase: `deliveries` and `delivery_items` tables with tracking and status constraints.
      - Atomic RPCs deployed and verified:
        - `create_delivery_order`: Atomic stock deduction and movement logging (`movement_type = 'delivery_shipment'`), creation of delivery and item snapshots.
        - `process_delivery_return`: Atomic stock restoration and movement logging (`movement_type = 'delivery_return'`), marks status as `'returned'`.
      - Expéditions & Colis dashboard (`DeliveryManagementSection.tsx`) integrated into `/inventory`: Kanban pipeline (`En préparation`, `Expédié / En route`, `Livré & Encaissé`, `Retour Colis`), detailed list, quick status buttons ("Livré & Payé", "Retour Colis").
      - Modal `NewDeliveryModal.tsx` for creating shipments across 24 Tunisian governorates, barcode scanning/variant selector, COD computation, and courier selection.
      - Printable shipping slip modal `DeliveryShippingSlipModal.tsx` with Code-128 barcode and recipient breakdown.
    - **Phase 5.1: Row Level Security (RLS) Policies**:
      - Enabled RLS on all 5 new tables: `customer_credits`, `credit_items`, `credit_payments`, `deliveries`, `delivery_items` (`supabase_step12_rls_credits_deliveries.sql`).
      - Staff policies (`is_staff()` checking cashier or manager roles): full read, insert, and update access to credits, credit items, credit payments, deliveries, and delivery items.
      - Customer delivery access: regular customers can strictly read only deliveries and delivery items linked to their user ID or verified phone number (via `customer_addresses`).
      - Profit margins & cost privacy: `variant_costs` remains strictly manager-only with zero read/write access for cashiers or customers.
  - `checklist_fix_credit_return_caisse.md` ✅ — Phases 1, 2, 3 & 4 completed (2026-11-13):
    - **Phase 1: Correction Caisse du Jour (Données de Test)**: Cleaned erroneous test refund (`#1a0682ff`) from `returns` / `return_items`; restored physical daily cash register to 98.000 TND (1 sale, 0 returns).
    - **Phase 2: Gestion Métier des Retours sur Ventes à Crédit**:
      - Deployed atomic RPC `return_credit_item` (`supabase_step14_credit_return_rpc.sql`): increments `credit_items.returned_quantity`, reduces `customer_credits.remaining_balance` (caps at 0, updates status to `'settled'`), restores stock in `variants.stock_quantity`, and logs `stock_movements` (`movement_type = 'credit_return'`). Zero writes to `returns` or `credit_payments` to ensure drawer cash is never debited.
      - Safeguard added in `ReturnExchangeModal.tsx`: blocks cash/card refunds if an item is tied to an active unsettled credit, prompting the cashier to use the Carnet de Crédit instead.
      - Added "Retourner cet article" action in `CreditLedger.tsx` line-item accordion with quantity selector, confirmation modal, and immediate stock/debt sync.
    - **Phase 3: Intégration Caisse Globale (Crédits + Comptant)**:
      - `pos/page.tsx` (`fetchDailySales`) aggregates physical cash installments from `credit_payments` (`payment_method = 'cash'`), computing exact net cash: `netCash = direct cash sales + credit cash payments - cash refunds`.
      - Real-time refresh of daily cash badge upon new credit deposits or debt repayments in POS and Carnet de Crédit.
      - Clôture de Caisse / Z-Report (`ZReportModal.tsx`): detailed breakdown of direct cash sales, credit cash repayments, cash refunds, and net physical drawer cash.
    - **Phase 4: Validation**: Complete lifecycle verified (98 DT cash sale + 88 DT credit sale + article return → customer debt cleared, stock restored, daily drawer cash intact at 98 DT).
  - `checklist_cashier_permissions_and_credit.md` ✅ — (2026-11-14):
    - **Expanded Cashier Scope & Granular Boutique Permissions**:
      - `src/middleware.ts` updated: cashiers can now navigate to `/inventory` and `/reports` (non-staff redirected to `/account`).
      - In `/inventory`: cashiers can view stock, search/filter items, select products and print barcode labels, toggle printed badges, and access the Carnet de Crédit and Expéditions tabs. "Équipe & Caissiers" tab is hidden; "+ Nouveau Produit" and "Supprimer" product buttons are hidden/disabled; Category add/delete actions are restricted.
      - In `/reports`: cashiers can view gross turnover, transaction count, payment method breakdown, best sellers, and the detailed sales journal. Purchase cost prices, net profits, margin percentages, and stock cost valuation are strictly hidden and masked at both the UI and database RPC level (`supabase_step15_permissions_and_old_credits.sql`).
      - Global navigation updated: `Header.tsx`, `MobileMenu.tsx`, and `pos/page.tsx` now surface quick shortcuts to "Gestion Boutique" and "Rapports" for cashiers.
    - **Manual Historical Credit Entry ("Saisie Manuelle Ancien Crédit")**:
      - Modal `ManualCreditModal.tsx` deployed for both managers and cashiers to record past debts (e.g. from paper registers). Supports customer name, phone, CIN, total debt amount, initial deposit & payment method, origin date, due date, and descriptive notes.
      - Calculates remaining balance and initial status dynamically; inserts directly into `customer_credits` (and `credit_payments` if an initial deposit was made) without deducting stock or impacting physical inventory.
  - `checklist_hide_customer_menus_for_staff.md` ✅ — Phases 1, 2 & 3 completed (2026-11-14):
    - **Staff Navigation Streamlining (Mobile & Desktop)**:
      - Clean separation of concerns between regular e-commerce customers and in-store staff (`manager` and `cashier`).
      - In `src/components/common/MobileMenu.tsx`: On mobile phones, removed the "Femme" and "Enfant" shopping tabs and customer category tree for staff users. Replaced with a dedicated **Staff Workspace Hub** containing role badges and direct operation links: Caisse POS (`/pos`), Gestion Stock (`/inventory`), Carnet de Crédit (`/inventory?tab=credit`), Colis & Livraisons (`/inventory?tab=shipping`), Rapports & Ventes (`/reports`), and clean sign-out.
      - In `src/components/common/Header.tsx`: Replaced customer "Femme" & "Enfant" links on desktop navigation with staff quick links (Caisse POS, Gestion Stock, Rapports) when logged in as staff. Removed "Mon Espace Client" from the user dropdown for manager and cashier roles.
      - In `src/app/account/page.tsx`: Added an instant safeguard and redirect to `/pos` preventing managers or cashiers from being routed to the customer order history/wishlist page.
      - Full customer and guest shopping experience ("Femme", "Enfant", "Mon Espace Client", cart, favorites) preserved completely intact for non-staff.
- **Known issues / caveats**:
  - `sale_items` table has **no `created_at` column** — do not use it in queries on that table
  - `returns` / `return_items` tables added 2026-11-09 (not in original schema)
- **Build**: Passes cleanly with 39 SSG routes and Middleware (`npm run build` exits 0).
