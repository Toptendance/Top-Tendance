# Checklist: 3 New Features — Categories Manager, SKU Auto-Gen & Camera QR in Return Modal

---

## 🔍 Context & Current State

| Feature | Current State |
|---|---|
| **Category management** | 4 hardcoded categories in DB (`Robes`, `Chemises`, `Pantalons`, `Vestes & Manteaux`). No UI to add/edit/delete. Manager must go to Supabase dashboard to manage them. |
| **SKU field** | Manual text input in the "Add Product" form. Must be unique (Supabase constraint on `variants.sku`). Currently no auto-generation — if two variants have the same SKU, Supabase throws a unique-violation error. |
| **Camera QR scan in Return Modal** | `MobileScannerModal.tsx` already exists and works in Inventory. It is **NOT wired** into `ReturnExchangeModal.tsx`. Need to add a "📷 Caméra" button to the return modal that opens the scanner and feeds the decoded value into the barcode search. |

---

## 📋 What Needs to Be Done

---

### Feature 1: Category Manager in Inventory Page

> **Goal**: Let the Manager add, rename, and delete categories directly from the Inventory UI — no Supabase dashboard needed.

#### Phase 1A — UI: "Manage Categories" Panel/Modal in `inventory/page.tsx`

- [x] Add a **"Gérer Catégories"** button next to the category filter dropdown (visible only to managers)
- [x] Clicking it opens a **Category Manager modal** (or inline panel) that:
  - Lists all existing categories (name + description + item count)
  - Has an **"+ Nouvelle Catégorie"** form with:
    - `Nom` (required, text input)
    - `Description` (optional, text input)
  - Each existing category has:
    - **Rename** (inline edit, pencil icon)
    - **Delete** (trash icon — with guard: cannot delete if products are assigned to it)
- [x] On submit of new category → `supabase.from('categories').insert(...)` → refresh list

#### Phase 1B — RLS Check

- [x] Verify the existing `categories_all_manager_policy` allows `INSERT`, `UPDATE`, `DELETE` for manager role
  - Current: `cmd: 'ALL'` on `authenticated` → may allow **cashiers** too — should be restricted to `is_manager()` only
  - If needed: update the policy so only managers can mutate categories, everyone can `SELECT`

#### Phase 1C — Delete Guard

- [x] Before deleting a category, query: `SELECT COUNT(*) FROM products WHERE category_id = $1`
- [x] If count > 0 → block delete and show:
  > *"Cette catégorie contient X article(s). Réaffectez-les avant de supprimer."*
- [x] If count = 0 → proceed with `DELETE`

---

### Feature 2: SKU — What It Is & Auto-Generation

> **What SKU unique means**: SKU (Stock Keeping Unit) is a unique internal code for each product variant. The DB enforces `UNIQUE` on `variants.sku`. If two variants have the same SKU → Supabase returns a unique-violation error and the insert fails. Currently the manager must type it manually.

#### Phase 2A — SKU Auto-Generation in Add Product Form

- [x] Add an **"Auto-générer"** button next to the SKU field in `inventory/page.tsx`
- [x] Auto-generation logic (runs on click OR auto-fills when product name + size + color are filled):
  ```
  SKU = SLUG(name) + "-" + SIZE + "-" + COLOR
  Example: "Robe Soirée Satin" + "M" + "Noir" → "ROBE-SOIR-SAT-M-NOIR"
  ```
- [x] Slug function: uppercase, strip accents, take first 3-4 chars of each word, join with `-`
- [x] On conflict (SKU already exists) → append `-2`, `-3`, etc. or add a random 3-char suffix
- [x] Show the generated SKU in the input field (editable — manager can still override)

#### Phase 2B — Duplicate SKU Error Handling

- [x] When Supabase returns `code: '23505'` (unique violation on `sku`) during product creation:
  - Show a clear French error: *"Ce SKU existe déjà. Modifiez-le ou utilisez 'Auto-générer'."*
  - Highlight the SKU field in red

---

### Feature 3: Camera QR Scan in Return & Exchange Modal

> **Goal**: Add a 📷 camera button to `ReturnExchangeModal.tsx` so cashiers can scan a product barcode or receipt QR code with the phone camera — same as in the inventory page.

#### Phase 3A — Wire `MobileScannerModal` into `ReturnExchangeModal`

- [x] Import `MobileScannerModal` in `ReturnExchangeModal.tsx`
- [x] Add state: `const [isCameraOpen, setIsCameraOpen] = useState(false)`
- [x] Add a **"📷 Caméra"** button next to the search input bar (small, icon + label):
  ```tsx
  <button onClick={() => setIsCameraOpen(true)}>
    <Camera size={16} /> Caméra
  </button>
  ```
- [x] Wire `onScan` callback:
  ```tsx
  <MobileScannerModal
    isOpen={isCameraOpen}
    onClose={() => setIsCameraOpen(false)}
    title="Scanner Article / Ticket"
    onScan={(decoded) => {
      setIsCameraOpen(false);        // close camera
      setReceiptQuery(decoded);      // fill the search input
      handleSearchSale();            // trigger search immediately
    }}
  />
  ```
- [x] Confirm that `handleSearchSale` can be called without a `FormEvent` (it already supports `e?: React.FormEvent` — ✅ no change needed)

#### Phase 3B — HTTPS Requirement Note

- [x] Camera access requires HTTPS (already handled inside `MobileScannerModal` with an error message)
- [x] On localhost → works without HTTPS (already handled)
- [x] On production `https://toptendance.tn` → will work automatically ✅

---

## 🗂 Files to Modify

| File | Feature |
|---|---|
| `src/app/inventory/page.tsx` | Feature 1 (Category Manager UI) + Feature 2 (SKU auto-gen) |
| `src/components/pos/ReturnExchangeModal.tsx` | Feature 3 (Camera QR scan) |
| Supabase DB (via SQL or Supabase Dashboard) | Feature 1B — tighten RLS on `categories` to manager-only for INSERT/UPDATE/DELETE |

---

## ✅ Implementation Order (Recommended)

1. **Feature 3** — Easiest, highest impact. Just wiring existing `MobileScannerModal`. ~15 min.
2. **Feature 2** — SKU auto-gen in the form. Pure frontend logic. ~20 min.
3. **Feature 1** — Category manager modal. Requires modal UI + RLS fix. ~40 min.

