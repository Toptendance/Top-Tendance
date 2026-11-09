# Plan & Checklist: POS Performance, Daily Sales & Returns/Exchanges

## 🎯 Scope of Work
This plan tackles three key requirements for the store:
1. **Scanner Latency & Speed Optimization** (Resolving why the scanner is fast sometimes and slow other times).
2. **Real-Time Daily Sales Widget on POS** (Today's revenue, order count, cash/card breakdown visible to cashiers/managers directly in the POS view).
3. **Returns, Cancellations & Exchanges Flow** (Receipt lookup, item returns/exchanges, automatic stock restoration, and financial adjustment/credit notes).

---

## 🔍 Part 1: Why the Scanner is Sometimes Slow & How to Optimize It

### Root Causes of Inconsistent Latency:
1. **Network Trip on Every Keystroke/Submit**:
   - Each barcode scan currently fires a cold `supabase.from('variants').select('...').maybeSingle()` call across the internet to the database.
   - If the store's 4G/WiFi fluctuates, latency can jump from 50ms to 1200ms.
2. **Camera Frame Throttling (Mobile Scanner)**:
   - On phones, processing high-resolution video frames at 15–20 fps strains mobile CPUs, causing throttling and lag.
3. **Database Indexing**:
   - Lack of a dedicated B-tree index on `variants.barcode` causes Supabase PostgreSQL to do sequential scans as products increase.

### Optimization Steps:
- [x] **Client-Side In-Memory Cache (Instant Physical Scanner)**:
  - Pre-fetch / cache product variants in memory on POS login.
  - Physical handheld scanner lookups resolve **instantaneously in < 5ms** without waiting for network round-trips.
- [x] **Database B-Tree Indexing**:
  - Ensure `CREATE INDEX IF NOT EXISTS idx_variants_barcode ON variants(barcode);` and `CREATE INDEX IF NOT EXISTS idx_variants_sku ON variants(sku);` are present in Supabase for fast lookups.
- [x] **Mobile Camera**:
  - *Camera scanner is confirmed working perfectly under a second. KEEP AS-IS (Do not touch).*

---

## 📊 Part 2: Live Daily Sales Summary on POS Screen

### Requirements:
- Cashiers and managers need to see today's ongoing totals without leaving the register to open `/reports`.
- Key metrics:
  - **Chiffre du Jour (Today's Gross Total in DT)**
  - **Nombre de Ventes (Number of transactions today)**
  - **Détail Règlements (Cash vs Card totals)**
  - Quick Drawer Balance / Float tracker (Fond de caisse).

### Implementation Steps:
- [x] **Daily Sales Mini-Bar Component (`DailySalesSummary.tsx`)**:
  - Place a discreet collapsible stats banner in the header or bottom of `/pos`.
  - Fetch today's sales where `created_at >= CURRENT_DATE 00:00:00`.
- [x] **Realtime Auto-Update**:
  - When `complete_sale` succeeds, increment the daily stats immediately in state (zero lag) or listen via Supabase Realtime channel.
- [x] **End-of-Day Register Closure ("Clôture de Caisse / Z-Report")**:
  - Simple modal allowing the manager to print/view the daily summary before logging out.

---

## 🔄 Part 3: Cancel, Return & Exchange System

### Requirements:
- Customers often return or exchange sizes/colors.
- Store needs to:
  1. Find the original sale by **Receipt ID** (or scan receipt barcode).
  2. Select which item(s) are being returned.
  3. Put returned units **back into stock** (`stock_quantity + 1` in `variants`).
  4. Handle two financial paths:
     - **Cancel / Full Refund (Avoir / Remboursement)**: Return cash/card amount to client.
     - **Exchange (Échange)**: Swap for another size or product of equal or greater value (calculating the price difference).

### Architecture & Database:
- [x] **Create/Verify Database Tables & RPC**:
  - `returns` table (or status column in `sales` / `sale_items` e.g., `refunded_quantity`, `is_returned`).
  - PostgreSQL RPC `process_return_exchange`:
    - Validates sale existence.
    - Decrements sale total.
    - Restores inventory quantity in `variants`.
    - Logs stock movement as type `'RETURN'` or `'EXCHANGE'`.
- [x] **Return & Exchange Modal (`ReturnExchangeModal.tsx`)**:
  - Search ticket by receipt number or date.
  - Checklist of items in that ticket with quantity to return.
  - Option A: Issue Store Credit / Cash Refund.
  - Option B: Add new exchange item to cart with price offset (e.g., Old item credit `-89.000 DT` + New item `+99.000 DT` = `Total to pay: 10.000 DT`).
- [x] **Trigger Button on POS Screen**:
  - Add **"Retour / Échange"** action button in the top action bar next to F9.

---

## 📅 Phased Execution Roadmap

| Phase | Description | Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Speed & Cache** | In-memory variant caching + DB indexes + mobile camera format reduction | < 5ms scan response time, consistent performance |
| **Phase 2: Daily Sales Widget** | Live today sales counter on `/pos` (Total DT, transactions, cash/card) | Immediate visibility for cashier & manager |
| **Phase 3: Return & Exchange** | Receipt lookup modal + inventory restock + exchange cart calculation | Full handling of customer returns & exchanges |

---

## 🧪 Acceptance Criteria
- [ ] Physical scanner & phone camera respond smoothly without intermittent lag.
- [ ] Making a sale instantly updates the "Ventes du Jour" counter on `/pos`.
- [ ] Returning an item returns the quantity back to `/inventory` and registers the refund/exchange accurately.

