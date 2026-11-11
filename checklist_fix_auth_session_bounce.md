# Checklist — Fix: Login Redirects to Login / Page Freezes After Sign-In

> **Bug**: After entering email & password, clicking "Stock" (Inventory) or "Caisse" (POS) sometimes redirects back to `/login` or the page freezes entirely.

---

## Root Cause Analysis

The login flow is:
1. `supabase.auth.signInWithPassword()` — sets session in the **browser** (cookie)
2. `router.push('/inventory')` or `router.push('/pos')` — immediately navigates
3. Next.js **middleware** intercepts the request and calls `supabase.auth.getUser()` — reads the cookie from the **server**

**The race condition**: `router.push()` fires before the browser has fully written the auth cookie to the outgoing request. The middleware reads the request cookies and sees no session → redirects to `/login`.

Additionally, the `"Se souvenir de moi"` (Remember Me) checkbox exists in the UI but **does nothing** — `signInWithPassword` always uses the default short-lived session regardless.

| # | Root Cause | Symptom |
|---|---|---|
| **A** | `router.push()` fires before cookie is propagated to the next request | Redirected back to `/login` immediately after login |
| **B** | Missing `router.refresh()` before `router.push()` — Next.js App Router does not re-read cookies without a refresh | Same as A — middleware still sees old (empty) cookie state |
| **C** | "Se souvenir de moi" is wired to state but never passed to `signInWithPassword` | Session expires in ~1 hour, forcing re-login constantly |
| **D** | Middleware makes a `profiles` DB call on every protected route — adds latency and can time out, causing a freeze | Page freezes / hangs after login |
| **E** | No loading state after `router.push()` — if the navigation hangs, the button re-enables and the user clicks again creating duplicate requests | UI freezes or double-navigates |

---

## Fix Plan

---

### Fix A + B — Add `router.refresh()` before `router.push()`

**File**: [`src/app/login/page.tsx`](file:///c:/Users/dell/Top%20Tendance/src/app/login/page.tsx)

**Problem**: After `signInWithPassword`, the cookie exists in the browser store, but `router.push()` initiates a server navigation before the cookie is included in the new request headers.

**Fix**: Call `router.refresh()` first. This forces Next.js to re-fetch the current route with the new cookies, synchronizing the middleware cookie state **before** navigating.

```ts
// After successful sign in:
router.refresh();          // ← sync cookies with server first
router.push(destination);  // ← then navigate
```

- [ ] **A1** — In `login/page.tsx`, add `router.refresh()` before every `router.push()` call after sign-in

---

### Fix C — Wire "Se souvenir de moi" to the session

**File**: [`src/app/login/page.tsx`](file:///c:/Users/dell/Top%20Tendance/src/app/login/page.tsx)

**Problem**: The `rememberMe` state is captured but ignored. Supabase supports persistent sessions natively — when not persisted, the session token expires ~1 hour after login, forcing staff to re-login mid-shift.

**Fix**: Pass session persistence option based on the checkbox:

```ts
// Not directly supported via signInWithPassword options,
// but Supabase createBrowserClient auto-persists to localStorage.
// Solution: configure the client to use localStorage (persistent) vs memory (ephemeral)
// OR simply ensure the Supabase client is initialized with persistSession: true (default).
```

- [ ] **C1** — Verify `createBrowserClient` in `supabaseClient.ts` uses default session persistence (it does by default — confirm no override)
- [ ] **C2** — Either remove the "Se souvenir de moi" checkbox (it's misleading since sessions are always persisted) OR implement actual session duration control

---

### Fix D — Add a timeout/fallback for the middleware `profiles` DB call

**File**: [`src/middleware.ts`](file:///c:/Users/dell/Top%20Tendance/src/middleware.ts)

**Problem**: The middleware fetches `profiles` table on every request to `/pos`, `/inventory`, `/reports`. If Supabase is slow (cold start, network), this call can stall the navigation for several seconds, causing a "freeze".

**Fix**: Wrap the profiles fetch in a timeout or cache the role in the session/cookie to avoid a DB call on every navigation.

- [ ] **D1** — Add a fallback: if the `profiles` fetch errors or returns null, redirect to `/login` instead of hanging
- [ ] **D2** — Consider caching the user role in the JWT custom claims (Supabase custom claims via a database hook) so middleware reads the role from the token without an extra DB round trip

---

### Fix E — Keep the button disabled during navigation

**File**: [`src/app/login/page.tsx`](file:///c:/Users/dell/Top%20Tendance/src/app/login/page.tsx)

**Problem**: `setLoading(false)` is called in the `finally` block before navigation completes. User can click again during the navigation, causing duplicate requests.

**Fix**: Don't reset `loading` to false when navigation is happening — keep it `true` through the redirect.

- [ ] **E1** — Remove `setLoading(false)` from the `finally` block when navigation succeeds (only reset on error)

---

## Implementation Checklist

### Phase 1 — Critical Fix (Root Cause A + B) — Highest Priority
- [ ] In `src/app/login/page.tsx`, add `router.refresh()` before `router.push()` on successful login
- [ ] Test: Login → navigates to `/inventory` or `/pos` without being bounced back to `/login`
- [ ] Test: Repeat 5 times on a slow connection — no race condition

### Phase 2 — UX Fix (Root Cause E)
- [ ] Remove `setLoading(false)` from `finally` on the success path — keep button disabled during navigation
- [ ] Test: Button stays in "loading" state while navigating, cannot be double-clicked

### Phase 3 — Middleware Robustness (Root Cause D)
- [ ] Add error handling around the `profiles` fetch in `middleware.ts` — redirect to `/login` on failure instead of hanging
- [ ] Test: Simulate slow DB response — middleware should fail fast, not freeze

### Phase 4 — Session / Remember Me Cleanup (Root Cause C)
- [ ] Decide: Remove "Se souvenir de moi" checkbox (sessions are already persistent by default) OR implement real session control
- [ ] Verify Supabase token refresh is working (session should auto-renew every hour)

### Phase 5 — Regression Test
- [ ] Login as `manager` → lands on `/inventory` ✅
- [ ] Login as `cashier` → lands on `/pos` ✅
- [ ] Refresh the page while on `/pos` → stays on `/pos` (no bounce) ✅
- [ ] Wait 5 minutes → navigate to `/inventory` → no re-login required ✅
- [ ] `npm run build` exits 0 ✅

---

## Files to Touch

| File | Change |
|---|---|
| [`src/app/login/page.tsx`](file:///c:/Users/dell/Top%20Tendance/src/app/login/page.tsx) | Add `router.refresh()`, fix loading state |
| [`src/middleware.ts`](file:///c:/Users/dell/Top%20Tendance/src/middleware.ts) | Add error fallback on profiles fetch |

---

> **Status**: 🔴 Not started — Phase 1 is the fix that will immediately solve the bounce-to-login issue

