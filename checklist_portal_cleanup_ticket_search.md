# Checklist & Plan: Portal Cleanup & Ticket Search Resolution

## 📋 Context & Root Cause Analysis

### 1. Removing Footer & Maps from Manager & Cashier Views
- **Current Issue**:
  - `src/app/layout.tsx` globally renders `<Header />`, `<CartDrawer />`, `<StoreLocation />` (Google Map & Store Info), and `<Footer />` across **every page**, including:
    - `/pos` (Point of Sale register)
    - `/inventory` (Inventory management)
    - `/reports` (Manager analytics & reports)
  - For Cashiers and Managers, the public marketing footer and the large StoreLocation map clutter the operational screen, take up valuable vertical real estate, and interfere with POS touch/scanner usage.
- **Solution Strategy**:
  - Conditionally hide `<Footer />` and `<StoreLocation />` on operational portal routes (`/pos`, `/inventory`, `/reports`), or check if the route begins with portal paths (`pathname.startsWith(...)`).
  - Cashiers and managers get a 100% clean, dedicated app layout without customer-facing marketing footers or maps.

---

### 2. Resolving "Aucun ticket trouvé pour 61910000018"
- **Current Issue**:
  - When the user tests a return/exchange, they scan/enter `61910000018` (which is a **product/variant barcode or SKU**, not a sale UUID).
  - In `ReturnExchangeModal.tsx`, the query only looks at `sales.id` via:
    ```typescript
    builder = builder.ilike('id', `${query}%`);
    ```
    Since `61910000018` is a product barcode/SKU, PostgreSQL finds 0 matches in `sales.id`, returning *"Aucun ticket trouvé pour la référence 61910000018"*.
- **Store Requirement**:
  - A cashier often receives an item brought back by a customer who either:
    1. Holds a printed receipt with a **Receipt ID** (or receipt barcode).
    2. Does **not** have the receipt ID immediately at hand, but the cashier scans the **item's barcode** (`61910000018`) or SKU to find the recent sales containing that exact item.
- **Solution Strategy**:
  - Update `ReturnExchangeModal.tsx` search logic to support **Universal Search**:
    - **Path A (Ticket ID)**: If the input matches a sale UUID or prefix, load that sale directly.
    - **Path B (Product Barcode / SKU Lookup)**: If the input matches a product barcode (e.g. `61910000018`) or SKU, query `sale_items` joined with `variants` to retrieve recent sales that included this article. If multiple sales are found, let the cashier select the relevant transaction from a quick list.
    - **Path C (Receipt Barcode Printing)**: Ensure `ReceiptModal` prints a scannable Code128 / QR or clean short ticket code so scanning the receipt directly works seamlessly.

---

## 🛠️ Step-by-Step Implementation Checklist

### Phase 1: Layout Optimization (Hide Footer & Map for Staff)
- [x] **Create Route Path Checker**:
  - Create a lightweight client wrapper or hook in `layout.tsx` to detect portal routes (`/pos`, `/inventory`, `/reports`).
- [x] **Conditionally Render Marketing Elements**:
  - Hide `<StoreLocation />` (Google Map & store hours) on `/pos`, `/inventory`, and `/reports`.
  - Hide `<Footer />` on `/pos`, `/inventory`, and `/reports`.
  - Ensure regular customer pages (`/`, `/women`, `/kids`, `/cart`, `/checkout`, `/account`, etc.) retain the full footer and map.

### Phase 2: Universal Ticket & Item Barcode Search in Return Modal
- [x] **Multi-Type Search Architecture in `ReturnExchangeModal.tsx`**:
  - Detect whether input is a UUID/Sale reference or a product barcode/SKU.
  - If input is a barcode (e.g. `61910000018`) or SKU:
    1. Look up the variant by barcode/SKU.
    2. Query recent sales containing this variant (with date, total amount, cashier name).
    3. If 1 sale found: automatically load that ticket.
    4. If multiple sales found: show a compact selection list so the cashier can pick the correct ticket by customer purchase time or amount.
- [x] **Error Handling & Feedback**:
  - Provide clear status messages: *"Recherche par code-barres article..."*, *"3 ventes récentes trouvées pour cet article"*.
  - Maintain the audio chimes (`playBeep('success')` / `playBeep('error')`).

### Phase 3: Receipt Barcode & ID Standardization
- [x] **Receipt Modal Barcode**:
  - In `ReceiptModal.tsx`, display the ticket ID clearly formatted and render a clean barcode for the ticket ID so cashiers can scan the receipt itself directly.

### Phase 4: Verification & Testing
- [ ] **Visual Verification**:
  - Check `/pos`, `/inventory`, and `/reports` to verify footer and map are completely removed.
  - Check customer pages to ensure footer and map remain visible.
- [ ] **Functional Return Test with `61910000018`**:
  - Search `61910000018` in the Return/Exchange modal $\rightarrow$ verify it finds the test sale and displays the purchased item for return or exchange.
- [ ] **Build Validation**:
  - Run `npm run build` to confirm 100% type safety and production readiness.

