# Checklist & Plan: Detailed Daily Sales & Item Transaction Logs (Cashier & Manager)

## 📋 Objectives
Provide complete, transparent transaction logs with line-item breakdowns, exact timestamps, and cashier attribution for:
1. **Cashier (POS)**: Accessible directly from the bottom *Caisse du Jour* bar (expanded drawer / modal), showing today's chronological sales list, exact transaction time, items sold (name, size, color, qty, price), payment method, and one-click ticket reprint or return.
2. **Manager (Reports & Analytics)**: An interactive, filterable **Journal des Ventes & Transactions** tab in `/reports`, displaying real-time or historical sales, line items, timestamps, discounts, and cashier filters.

---

## 🛠️ Step-by-Step Implementation Checklist

### Phase 1: Shared Sales Data Service & Types
- [x] Define TypeScript interface `DetailedSaleTransaction`:
  - `id`, `created_at` (formatted time & date)
  - `cashier_name`, `payment_method`
  - `total_amount`, `discount_amount`, `final_amount`
  - `items`: array of `{ id, productName, sku, barcode, size, color, quantity, unit_price, subtotal }`
- [x] Query sales joining `sale_items` and `variants(product(name))` ordered by `created_at DESC` (today's range for cashier, customizable range for manager).

### Phase 2: Cashier View (POS - *Caisse du Jour*)
- [x] Enhance `DailySalesSummary.tsx`:
  - Add a **"📋 Historique & Détails des Ventes"** toggle in the expanded *Caisse du Jour* bottom sheet or modal.
  - Render an interactive, chronological list of today's sales:
    - **Header row**: Exact Time (`14:32:05`), Ticket `#b33477ac`, Amount (`139.000 DT`), Payment method pill (`Espèces`, `Carte`).
    - **Expandable Item Details**: List of each item bought with name, size, color, unit price, and quantity.
    - **Quick Actions**: "Imprimer Reçu" (re-opens `ReceiptModal`), "Retour/Échange" (pre-loads ticket in return modal).
  - Include an empty state: *"Aucune vente enregistrée aujourd'hui"*.

### Phase 3: Manager View (`/reports` - Analytics & Audit)
- [x] Add a dedicated **"Journal des Ventes Détaillé"** section/tab in `/reports/page.tsx`:
  - Filter by date period (*Aujourd'hui*, *7 jours*, *30 jours*, or custom date).
  - Filter by Cashier (*Tous les caissiers* or specific user).
  - Search by Ticket ID, Barcode, or Product Name.
  - Comprehensive transaction table with expandable rows for item breakdowns.
  - Quick summary: Total sales count, average basket, total gross, discounts granted.

### Phase 4: Validation & Quality Assurance
- [ ] Test cashier flow: Complete a sale in POS $\rightarrow$ verify it appears instantly in *Caisse du Jour* with exact timestamp and item details.
- [ ] Test manager flow: Open `/reports` $\rightarrow$ inspect sales journal, expandable item lines, and cashier filtering.
- [ ] Run `npm run build` to verify zero type or build regressions.

