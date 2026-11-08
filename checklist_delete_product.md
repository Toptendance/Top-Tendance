# Delete Product — Inventory Dashboard

## Context
Manager needs a delete button on each product row in `/inventory`.
To protect sale history, we use **soft delete** (mark as inactive) rather than permanently removing the record.
The product disappears from the dashboard and from the POS search — but old sales stay intact.

---

## Steps

### Step 1 — Database: soft delete column + policies ✅
- [x] File: `src/app/inventory/page.tsx` (SQL run via Supabase MCP)
- [x] `is_active boolean NOT NULL DEFAULT true` column already existed on `products` table
- [x] RLS UPDATE policy added for manager on `products` and `variants`
- [x] Inventory page query now filters `.eq('is_active', true)` on products
- [x] POS barcode scanner and ProductSearchDrawer already filtered `variants.is_active = true` ✅

### Step 2 — UI: delete button + confirmation ✅
- [x] File: `src/app/inventory/page.tsx`
- [x] Added a 🗑 delete icon button on each product row (manager only)
- [x] Clicking it opens a confirmation dialog:
  > "Supprimer le produit ? Supprimer « {product name} » ? Cette action est irréversible..."
  > Buttons: **Annuler** / **Supprimer**
- [x] On confirm: sets `is_active = false` on both `products` and `variants` (soft delete)
- [x] Product disappears from the list immediately (optimistic UI update)
- [x] Shows success toast: `Produit "{productName}" supprimé`
- [x] Shows error toast and reverts on failure
- [x] Build verified cleanly ✅

### Step 3 — Verify ✅
- [x] Build passes ✅
- [x] Manager can soft-delete a product from the dashboard ✅
- [x] Deleted product no longer appears in inventory list (`.eq('is_active', true)`) ✅
- [x] Deleted product no longer appears in POS search / barcode scanner (`is_active = true`) ✅
- [x] Old sales referencing that product are unaffected (soft delete preserves DB relations) ✅

