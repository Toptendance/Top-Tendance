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
| **Barcodes** | `jsbarcode` (Code-128 / EAN-13) | Thermal print: 50mm × 30mm sticker tags |
| **Currency** | Tunisian Dinar (`TND` / `DT`) | All financial DB columns: `numeric(12,3)` |
| **Production Domain** | `https://toptendance.tn` | Supabase Site URL & Redirect URLs configured |

---

## 2. Roles, Authentication & Route Protection

The system supports **3 distinct user roles** managed via the `profiles` table in Supabase:

| Role | Permissions & Access | Default Land Route | Test Credentials |
|---|---|---|---|
| **Manager** (`manager`) | Full POS, Inventory Management, Barcode Printing, Soft-delete Products, Analytics & Reports | `/inventory` | `manager@toptendance.tn` / `TopTendance2026!Manager` |
| **Cashier** (`cashier`) | Point of Sale (`/pos`), Barcode scanning, Receipt generation, complete sale RPC | `/pos` | `cashier@toptendance.tn` / `TopTendance2026!Cashier` |
| **Customer** (`customer` / null) | E-commerce boutique, Orders history, Address carnet, Wishlist, Profile | `/account` | Any registered client account |

### Key Route Protection (`src/middleware.ts`):
- `/account`: Requires authenticated user.
- `/pos`: Requires authenticated user with role `cashier` OR `manager`.
- `/inventory` & `/reports`: Strictly requires `manager`.
- Authentication uses **HTTP Cookies** via `@supabase/ssr` (syncs between login client & server middleware).

---

## 3. Database Schema & Security Architecture

### Tables in Supabase (`public` schema)
1. `profiles`: `id (uuid PK)`, `role (text: 'manager'|'cashier'|'customer')`, `full_name`, `phone`
2. `categories`: `id (uuid PK)`, `name (text)`, `description (text)`
3. `products`: `id (uuid PK)`, `name`, `brand`, `category_id (FK)`, `is_active (bool default true)`
4. `variants`: `id (uuid PK)`, `product_id (FK)`, `sku (unique)`, `barcode (unique)`, `size`, `color`, `selling_price (numeric 12,3)`, `stock_quantity (int)`, `low_stock_threshold (int)`, `is_active (bool default true)`
5. `variant_costs`: `variant_id (FK PK)`, `cost_price (numeric 12,3)` *(Isolated from Cashiers via RLS)*
6. `sales`: `id (uuid PK)`, `cashier_id (FK)`, `customer_id (FK null)`, `customer_phone`, `total_amount`, `payment_method ('cash'|'card'|'split')`, `discount_amount`, `created_at`
7. `sale_items`: `id (uuid PK)`, `sale_id (FK)`, `variant_id (FK)`, `quantity`, `unit_price`, `subtotal`
8. `stock_movements`: `id (uuid PK)`, `variant_id (FK)`, `quantity_change`, `movement_type ('sale'|'receiving'|'return'|'adjustment')`, `reference_id`, `created_by`
9. `customer_addresses`: `id (uuid PK)`, `user_id (FK)`, `label`, `recipient_name`, `phone`, `city`, `governorate`, `postal_code`, `is_default`
10. `customer_wishlists`: `id (uuid PK)`, `user_id (FK)`, `variant_id (FK)`, `created_at`

### RPC Functions (`SECURITY DEFINER`)
- `complete_sale(p_items jsonb, p_payment_method text, p_discount numeric)`: Atomically validates stock, inserts sale record + sale items, decrements stock quantities, logs stock movements.
- `receive_stock(p_items jsonb, p_supplier_name text, p_invoice_number text)`: Increases variant stock and logs receiving movements.
- `process_return(p_sale_item_id uuid, p_quantity int, p_refund_method text)`: Restores inventory and records refund.
- `get_sales_analytics(p_start_date date, p_end_date date)`: Generates manager revenue and profit reports.
- `get_stock_valuation()`: Calculates total inventory value at cost price vs selling price.

---

## 4. Key Application Modules & File Structure

```
src/
├── app/
│   ├── account/page.tsx        ← Client dashboard: 4 tabs (Online Orders, Store Purchases, Addresses, Profile)
│   ├── inventory/page.tsx      ← Manager inventory dashboard: KPIs, stock alerts, filters, delivery modal, soft-delete
│   ├── pos/page.tsx            ← POS Cashier screen: Barcode auto-focus (F2), hotkeys (F9), cart, quick pay
│   ├── reports/page.tsx        ← Manager analytics: sales, profits, stock valuation
│   ├── login/page.tsx          ← Auth page with Suspense boundary & role-based intelligent redirect
│   ├── women/ & kids/          ← E-commerce catalog pages (SSG)
│   └── product/[slug]/         ← Product Detail Page (PDP)
├── components/
│   ├── common/
│   │   ├── Header.tsx          ← Role-aware account menu (Guest / Client / Cashier / Manager shortcuts)
│   │   ├── MobileMenu.tsx      ← Mobile drawer with discrete staff access
│   │   └── Footer.tsx          ← Footer with discrete staff login link
│   ├── pos/
│   │   ├── BarcodeTagModal.tsx ← Thermal sticker printing (50mm × 30mm) via Code-128 SVG
│   │   ├── DeliveryReceivingModal.tsx ← Delivery receiving popup calling receive_stock RPC
│   │   ├── PaymentDrawer.tsx   ← Cash / Card payment drawer with change calculator
│   │   ├── ProductSearchDrawer.tsx ← Manual variant & SKU search modal
│   │   └── ReceiptModal.tsx    ← Post-sale ticket modal with printable receipt
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
  - `site_url`: `https://toptendance.tn`
  - `uri_allow_list`: `https://toptendance.tn/**,http://localhost:3000/**`

---

## 7. Status & Last Session Recap

- **All checklists completed & verified**:
  - `checklist_extended.md` ✅ (POS, Inventory, RPCs, Thermal Barcodes, Analytics)
  - `checklist_client_dashboard.md` ✅ (Role-based Header, Supabase Client Dashboard, Next.js Middleware)
  - `checklist_auth_fix.md` ✅ (Cookie-based auth synchronization between client and middleware)
  - `checklist_delete_product.md` ✅ (Soft delete with confirmation dialog and RLS policies)
  - `checklist_test_products.md` ✅ (4 Fashion items with Tunisian barcodes, label printing verified)
- **Build**: Passes cleanly with 35 SSG routes and Middleware (`npm run build` exits 0).
