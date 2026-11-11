# Checklist & Architecture Plan: Daily Cash Register (Caisse du Jour), Returns & Exchanges Calculation Fix

## 1. Context & Identified Problem
Currently, the "Caisse du Jour" (bottom drawer on POS) and Z-Report display values that do not reflect reality after sales, returns, or exchanges:
1. **Returns are completely ignored in the daily calculation**:
   - `fetchDailySales` in [src/app/pos/page.tsx](file:///c:/Users/dell/Top%20Tendance/src/app/pos/page.tsx#L190-L230) queries `supabase.from('sales')` and calculates `grossTotal`, `cashTotal`, `cardTotal`, and `splitTotal`.
   - It never queries `public.returns`.
   - When a refund is issued in cash or card, money leaves the cash drawer / register, but the daily total remains unchanged ("always up").
2. **Double counting on sales in POS state**:
   - In `handlePaymentComplete` ([src/app/pos/page.tsx](file:///c:/Users/dell/Top%20Tendance/src/app/pos/page.tsx#L584-L594)), state is updated optimistically `setDailySales(prev => prev.grossTotal + saleAmt)`.
   - At the same time, the Supabase realtime channel listener ([src/app/pos/page.tsx](file:///c:/Users/dell/Top%20Tendance/src/app/pos/page.tsx#L240-L256)) receives an `INSERT` event on `sales` and adds `amt` **a second time**, causing the number to artificially jump twice on every sale.
3. **No realtime listener on returns or exchanges**:
   - The Supabase channel only listens for `sales` table inserts. When a return/exchange is processed, no realtime event is caught.
4. **Returns history missing in Caisse du Jour & Z-Report**:
   - The drawer history tab only lists sales (`fetchTodayDetailedSales`), so cashiers cannot see returned tickets, refunded amounts, or net balance (Ventes brutes - Retours = Net en caisse).
   - In Z-Report ([src/components/pos/ZReportModal.tsx](file:///c:/Users/dell/Top%20Tendance/src/components/pos/ZReportModal.tsx)), "Expected Cash in Drawer" calculates `floatVal + stats.cashTotal` without deducting cash refunds, making cash reconciliation inaccurate.

---

## 2. Plan of Action

- [x] **Phase 1: Real-time & Synchronization Architecture Update**
  - [x] Update `DailySalesData` interface to account for:
    - `grossTotal` (Total des ventes)
    - `refundsTotal` (Total des retours/remboursements)
    - `netTotal` (`grossTotal - refundsTotal`)
    - `cashRefunds` and `cardRefunds`
    - `netCash` (`cashTotal - cashRefunds`)
    - `netCard` (`cardTotal - cardRefunds`)
    - `returnsCount` (Nombre de retours)
  - [x] Add `returns` query to `fetchDailySales` in [src/app/pos/page.tsx](file:///c:/Users/dell/Top%20Tendance/src/app/pos/page.tsx) filtered by today (`>= todayStart`).
  - [x] Fix optimistic double-counting: remove duplicate addition or reconcile correctly with the realtime payload.
  - [x] Add Supabase realtime listener for `INSERT` on `returns` table so register immediately updates when a return occurs.

- [x] **Phase 2: Return & Exchange Modal Trigger Sync**
  - [x] In [src/components/pos/ReturnExchangeModal.tsx](file:///c:/Users/dell/Top%20Tendance/src/components/pos/ReturnExchangeModal.tsx), ensure `onReturnCompleted` or a dedicated callback triggers `fetchDailySales()` immediately when a return is confirmed.
  - [x] When exchange credit is generated and applied to a new cart sale, ensure the deducted credit and difference are accurately reflected in the payment method and totals.

- [x] **Phase 3: Update Daily Sales Summary UI (Caisse du Jour)**
  - [x] In [src/components/pos/DailySalesSummary.tsx](file:///c:/Users/dell/Top%20Tendance/src/components/pos/DailySalesSummary.tsx):
    - Display Net En Caisse prominently alongside Gross Sales and Total Returns.
    - Show badge for Cash Net (`Espèces Net = Espèces reçues - Remboursements espèces`).
    - Add Returns breakdown in the metrics tab.
    - In the History tab, include returns transactions (or a toggle between Ventes and Retours) so cashiers can verify every movement.

- [x] **Phase 4: Update Z-Report (Clôture de Caisse)**
  - [x] In [src/components/pos/ZReportModal.tsx](file:///c:/Users/dell/Top%20Tendance/src/components/pos/ZReportModal.tsx):
    - Update expected cash formula: `expectedCashInDrawer = floatVal + netCash` (opening float + cash sales - cash refunds).
    - Add distinct lines for "Total Ventes Brutes", "Total Retours / Remboursements", "Net Ventes", "Espèces Encaissées", "Espèces Remboursées", and "Espèces Théoriques".
    - Ensure printable thermal format shows returns details clearly for audit trails.

- [x] **Phase 5: Reports / Journal Integration**
  - [x] Ensure [src/app/reports/page.tsx](file:///c:/Users/dell/Top%20Tendance/src/app/reports/page.tsx) and sales journal reflect refunds in their daily accounting.

- [ ] **Phase 6: Verification & Validation**
  - [ ] Test sale creation: verify single increment of gross and cash/card totals.
  - [ ] Test return with cash refund: verify cash drawer decreases accordingly.
  - [ ] Test return with card refund: verify card total decreases accordingly.
  - [ ] Test exchange: verify stock update and register balance.
  - [ ] Verify Z-Report calculations match physical cash drawer count.

