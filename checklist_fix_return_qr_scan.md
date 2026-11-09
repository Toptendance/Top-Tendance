# Checklist: Fix QR/Barcode Scan — "Aucun ticket trouvé" in Return Modal

## 🔍 Root Cause (Confirmed)

The `sale_items` table has **no `created_at` column**.

In `ReturnExchangeModal.tsx` → `handleSearchSale()` → Path 2, the query was:
```ts
.select(`sale_id, quantity, unit_price, created_at, sale:sales (...)`)
.order('created_at', { ascending: false })
```
PostgREST returned an error on `created_at` → `siErr` was truthy → the entire found-sales block was silently skipped → fell through to Path 3 → generic "not found" shown.

The article **was sold 4 times** in the database. The data was always correct. It was purely a frontend query bug.

---

## 📋 Checklist

### Phase 1: Fix Frontend Query Bug

- [x] Remove `created_at` from `sale_items` `.select()` in `handleSearchSale()`
- [x] Change `.order('created_at')` → `.order('sale_id')` (column that actually exists on `sale_items`)
- [x] Verify the nested `sale:sales (created_at)` is kept for displaying sale date in the picker

**File**: [`src/components/pos/ReturnExchangeModal.tsx`](file:///c:/Users/dell/Top%20Tendance/src/components/pos/ReturnExchangeModal.tsx#L176-L196)

---

### Phase 2: Improve Error Handling — Barcode Found But No Sales

> Optional UX hardening: when a barcode IS in `variants` but `saleItems` is genuinely empty, show a specific message instead of falling through to a generic error.

- [ ] In Path 2, after the `sale_items` query, if `!siErr && (!saleItems || saleItems.length === 0)`:
  - **Stop** — do NOT fall through to Path 3
  - Set a specific error:
    ```
    Article « {prodName} » (CB: {barcode}) trouvé, mais aucune vente enregistrée pour cet article.
    Saisissez l'ID ticket manuellement ou recherchez par téléphone client.
    ```
- [ ] In the error panel JSX, if `matchedVariantInfo` is set alongside `errorMsg`, show the article name/SKU in the error box for context

---

### Phase 3: End-to-End Test

- [x] Scan barcode `6191000000018` in the Return modal → **sale picker appears** with 4 tickets ✅
- [ ] Select a ticket → sale details load correctly
- [ ] Add items to return → submit → success confirmation shown, stock restored
- [ ] Scan a barcode that was **never sold** → shows specific "article found, no sale" message (after Phase 2)
- [ ] Scan a **receipt QR** (UUID from printed ticket) → sale loads directly via Path 1

---

## 🗂 Summary

| Phase | Status | File |
|---|---|---|
| Phase 1: Fix `created_at` query bug | ✅ Done | `ReturnExchangeModal.tsx` |
| Phase 2: Better error when no sale found | ⬜ Pending | `ReturnExchangeModal.tsx` |
| Phase 3: End-to-end test | 🔄 In Progress | — |
