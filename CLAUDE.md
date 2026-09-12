# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Next.js dev server on http://localhost:3000
npm run build          # Production build (also the main type-check — there is no separate typecheck script)
npm run lint           # ESLint (eslint-config-next core-web-vitals + typescript, flat config)
npx tsc --noEmit       # Type-check without building

firebase deploy --only firestore:rules   # Deploy firestore.rules (run `firebase login --reauth` first if it fails)
node scripts/<name>.mjs                  # One-off admin/migration scripts (see below)
```

There is no test suite. `npm run build` is the closest thing to a full verification; run it after non-trivial changes.

Requires `.env.local` (copy from `.env.example`). `lib/firebase.ts` throws at import time if any `NEXT_PUBLIC_FIREBASE_*` var is missing, so a missing env file breaks the whole app, not just one page.

## What this is

A single-business bookkeeping app (Pakistan-oriented: PKR, Asia/Karachi, "delivery challans") built on **Next.js 16 App Router + React 19 + Firebase (Auth + Firestore) + Tailwind**. Almost every page is a `"use client"` component that talks to Firestore directly via the client SDK; the server side is a thin set of API routes that need the Admin SDK (user management, ledger export).

## Architecture

### Multi-tenancy: `businessId` is the tenant boundary

Every business-data document (`sales`, `purchases`, `customers`, `suppliers`, `income`, `expenses`, `operationalExpenses`, `transfers`, `expenseCategories`, `pettyCashOpening`, `deliveryChallans`) carries a `businessId` field, and all queries must filter on it. The app was migrated from per-user (`userId`) isolation, so **legacy documents may have no `businessId`**, and the code carries a fallback everywhere:

- Client: `useBusiness()` (`hooks/useBusiness.ts`) resolves `businessId` from `users/{uid}`, falling back to custom claims, then to `uid` itself for legacy users. Pages typically build scope clauses like `businessId ? where("businessId","==",businessId) : [where("userId","==",uid), where("businessId","==",null)]` and catch `permission-denied` to retry with the `userId` scope.
- Server: `lib/adminAuth.ts` `requireAdmin()` verifies the bearer ID token and resolves `businessId` from claims → Firestore user doc → uid. `lib/tenantAccess.ts` `isSameTenant()` encodes the same legacy-aware matching for user-management routes.
- Rules: `firestore.rules` reads `request.auth.token.businessId` / `.role` / `.admin` (custom claims, not a Firestore lookup) and has the matching legacy branch (`businessId == null && userId == uid`). When adding a collection, add a rule block there — the default is deny.

Exceptions: `users/{uid}/bankAccounts`, `pettyCash`, `summary` subcollections are still **per-user**, not per-business.

### Roles and custom claims

`lib/roles.ts` is the single source of truth: two roles (`admin`, `delivery_challan`) and a permission matrix. Client gating uses `useUserRole()` (`lib/useUserRole.ts`, reads `users/{uid}` from server to avoid stale cache) and `<AdminOnly>`; sidebar links in `app/(dashboard)/layout.tsx` are permission-driven. Server routes call `requireAdmin()`.

Role and `businessId` live in **Firebase Auth custom claims** as well as the Firestore user doc. This is deliberate (see `SSL_WORKAROUND.md`): admin creates users via `POST /api/users/create`, which sets claims; the Firestore `users/{uid}` doc is created client-side on the user's first login (`app/(auth)/login/page.tsx`) from those claims. `requireAdmin` also "auto-heals" claims for legacy admins found only in Firestore. If you change what's in claims, update `login/page.tsx`, `adminAuth.ts`, `api/users/create/route.ts`, and `firestore.rules` together.

### Client vs. server Firebase

- `lib/firebase.ts` — client SDK with persistent offline cache (multi-tab). The dashboard shows an offline banner and relies on Firestore's queued writes.
- `lib/firebaseAdmin.ts` — Admin SDK singleton; Firestore uses `preferRest: true` and `instrumentation.ts` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` in development. Both exist to survive corporate SSL interception; don't remove them casually.
- `scripts/*.mjs` use `@google-cloud/firestore` directly with a `service-key.json` in the repo root (gitignored) or `GOOGLE_APPLICATION_CREDENTIALS`. They are one-off migration/backfill/backup tools, several with dry-run modes — read the header comment before running any of them against production data.

### API routes (`app/api/`)

All expect `Authorization: Bearer <firebase id token>`. Pattern in `users/*` routes: rate-limit (`lib/rateLimiterEnhanced.ts`) → `requireAdmin()` → validate (`lib/validation.ts`) → Admin SDK work → `logAuditEventServer()`. `api/users/create.ts` (no `/route`) is a stale duplicate of `create/route.ts` and is not routed.

`api/exports/ledger` builds a ZIP of per-customer/supplier ledger CSVs using `fflate` (present in `node_modules` but not declared in `package.json`).

### Pages

Route groups: `app/(auth)/` (login, signup) and `app/(dashboard)/` (everything else, wrapped by the sidebar layout that redirects to `/login` when signed out). `app/test/*` and `app/test-button/` are ad-hoc diagnostic pages, not product features.

Data pages follow a common shape: `useBusiness()` → build scoped Firestore query → `getDocs`/`onSnapshot` → render. Numbered documents (sales bill numbers, challan numbers, purchase numbers) are generated client-side by querying the latest doc `orderBy("createdAt","desc") limit(1)` — there is no server-side sequence, so collisions are possible under concurrent creation.

### PDF / print

`components/PdfExportButton` → `app/utils/pdfGenerator.ts` uses `html2pdf.js` (html2canvas + jsPDF). The generator inserts spacer `<tr>` rows inside html2canvas's `onclone` so table rows don't split across A4 pages; the long comment there explains why the naive approaches fail. `document.body` gets a `pdf-export` class during capture, and `globals.css` has print/pdf-specific rules keyed on it.

### CSV import/export

`lib/csvUtils.ts` holds per-entity `export*`/`validate*`/`get*Template` functions used by `app/(dashboard)/data-management/` tabs and `components/ImportModal.tsx`. Add a new entity there rather than inline in a page.

## Repo notes

- The many `*_GUIDE.md`, `SECURITY_*.md`, `FIXES_*.md`, `IMPLEMENTATION_COMPLETE.md` files are historical status reports from earlier work, not living docs; `components/MIGRATION_PLAN.md` describes a *proposed* Firestore→Postgres migration that has not been started (`pg` is a dependency but unused).
- `devserver.log`, `devserver.err`, `firebase-debug-output.txt`, and `scripts/backup-*.json` / `migration-audit-*.json` are committed artifacts, not source.
- Dates are handled as `YYYY-MM-DD` strings in Pakistan time (`lib/dateUtils.ts getPakistanDate`), compared lexically in Firestore queries.
- Production logging goes through `lib/logger.ts` (info/debug are dev-only); many pages still use raw `console.log` for debugging.
