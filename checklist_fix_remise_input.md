# Plan: Fix Remise (Discount) Input Locking Bug

## 1. Root Cause Analysis
In [src/components/pos/PaymentDrawer.tsx](file:///c:/Users/dell/Top%20Tendance/src/components/pos/PaymentDrawer.tsx#L37-L53):
```typescript
const discount = Math.max(0, parseFloat(discountInput) || 0);
const effectiveTotal = Math.max(0, totalAmount - exchangeCredit);
const finalAmount = Math.max(0, effectiveTotal - discount);

useEffect(() => {
  if (isOpen) {
    if (initialDiscount > 0) {
      setDiscountInput(initialDiscount.toFixed(3));
    } else {
      setDiscountInput('0');
    }
    setCashTenderedInput(finalAmount.toFixed(3));
    setErrorMsg(null);
  }
}, [isOpen, finalAmount, initialDiscount]);
```
### Why typing in Remise fails:
1. When the user types a number in `Remise` (e.g. typing `5`), `discountInput` changes to `'5'`.
2. This immediately changes `discount` to `5`, which changes `finalAmount` (e.g. from `50` to `45`).
3. Because `finalAmount` is listed in the dependency array of `useEffect`:
   `[isOpen, finalAmount, initialDiscount]`, the `useEffect` **fires immediately**.
4. The effect executes:
   ```typescript
   if (initialDiscount > 0) {
     setDiscountInput(initialDiscount.toFixed(3));
   } else {
     setDiscountInput('0'); // <--- RESETS BACK TO '0' INSTANTLY!
   }
   ```
5. As a result, the input resets back to `'0'` every single time a key is pressed, completely preventing the user from typing any discount number.

---

## 2. Proposed Solution & Architecture Plan

- [x] **1. Decouple Modal Initialization from Dynamic Input State**:
  - Only initialize `discountInput` and `cashTenderedInput` when `isOpen` transitions to `true` (e.g. using a ref `wasOpenRef` or `useEffect` depending strictly on `[isOpen]` upon open).
  - Do NOT put `finalAmount` or `discount` in the drawer reset effect.

- [x] **2. Keep `cashTenderedInput` Synchronized Intelligently**:
  - When the user edits `discountInput`, update `cashTenderedInput` only if the user hasn't explicitly customized `cashTenderedInput` (or update it alongside the final amount when in cash mode so the suggested tendered amount reflects the discounted net).

- [ ] **3. User Experience & Input Usability Polish**:
  - Allow blanking the input field (e.g. clearing `'0'` without it snapping back immediately).
  - Add quick discount buttons or percentage options (optional, e.g. -5 DT, -10 DT, -10%, -20%) for fast POS checkout.

- [ ] **4. Verification & Testing**:
  - Open Payment Drawer (F9 or button).
  - Type a discount in the Remise field (e.g. 5 DT, 10.5 DT).
  - Confirm the number is accepted smoothly and does not reset.
  - Confirm Net à Payer updates in real-time (`Sous-total - Avoir - Remise = Net à Payer`).
  - Confirm Cash Tendered and Change Due compute accurately with the discount.
  - Confirm payment submission completes and stores the discount properly in the database.

