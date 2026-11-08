# Auth Session Fix — Cookie-Based Client

## Problem
Login page stores session in **localStorage** (`@supabase/supabase-js`).
Middleware reads session from **cookies** (`@supabase/ssr`).
Result: middleware never sees the session → user stays on `/login`.

---

## Fix

### Step 1 — Update Supabase browser client
- [ ] File: `src/utils/supabaseClient.ts`
- [ ] Replace `createClient` from `@supabase/supabase-js` with `createBrowserClient` from `@supabase/ssr`
- [ ] Session is now stored in cookies → middleware can read it
- [ ] All other files that import `supabase` from this module inherit the fix automatically
- [ ] Verify build passes ✅
- [ ] Test login flow:
  - `manager@toptendance.tn` / `TopTendance2026!Manager` → redirects to `/inventory` ✅
  - `cashier@toptendance.tn` / `TopTendance2026!Cashier` → redirects to `/pos` ✅
  - Client account → redirects to `/account` ✅

