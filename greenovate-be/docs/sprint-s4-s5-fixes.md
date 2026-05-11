# Sprint S4–S5 Fix Log (OOS-215)

All changes made across Epics 6–9. Grouped by category.

---

## Bug Fixes

### Receipt number showing UUID instead of formatted number
**Files:** `nexOOS/src/components/OrderStatus.tsx`, `Account.tsx`, `Checkout.tsx`,
`greenovate-be/src/apps/order-service/order-service.service.ts`
- Label changed from "Order ID" → "Receipt No."
- `getDisplayOrderNumber()` now prioritises `receiptNumber → orderNumber → id`
- Order service response now sets `id: receiptNumber || insertedTransaction.id`
- Old orders with UUID-only IDs are automatically filtered out of localStorage on app load

### Duplicate orders being placed
**File:** `nexOOS/src/components/Checkout.tsx`
- Added `isPlacingOrder` state — button is disabled and shows "Placing Order..." during submission
- Added `Idempotency-Key` header (rotating UUID per order attempt) so the backend deduplicates retries

### Order confirmation going to Account instead of Success page
**File:** `nexOOS/src/components/Checkout.tsx`, `Success.tsx`
- After `placeOrder` succeeds, navigation now goes to `'success'` view
- `Success.tsx` updated to show `receiptNumber` instead of raw UUID

---

## Security Fixes

### JWT refresh token rotation — reuse detection
**Files:** `src/controllers/auth.controller.ts`, `src/services/auth.service.ts`,
`supabase/refresh-tokens-migration.sql`
- Login and register now store each refresh token hash in `refresh_token_families` table
- `/auth/refresh` revokes the used token and issues a new one (true rotation)
- If a revoked token is replayed (stolen token attack), the **entire token family is revoked**, forcing re-login
- `/auth/logout` explicitly revokes the token in the DB

**Action required:** Run `supabase/refresh-tokens-migration.sql` in your main Supabase project.

---

## New Features

### Order status polling
**Files:** `nexOOS/src/components/OrderStatus.tsx`, `greenovate-be/src/apps/order-service/`
- `OrderStatus.tsx` polls `GET /api/orders/track?receiptNumber=` every 30 seconds
- Exponential backoff on errors (doubles delay up to 5 minutes)
- Polling stops automatically when status reaches `Delivered` or `Cancelled`
- Backend: new `GET /orders/track` endpoint queries `receipts → transactions` table and maps POS statuses to frontend statuses

### order.placed event
**Files:** `src/apps/order-service/order-service.service.ts`,
`supabase/order-events-migration.sql`
- After every successful checkout, a fire-and-forget insert writes to `order_events` table
- Schema: `event_type`, `order_id`, `receipt_number`, `user_id`, `payload`, `processed`, `created_at`
- Never blocks the checkout response — logged to console if insert fails

**Action required:** Run `supabase/order-events-migration.sql` in your main Supabase project.

### Idempotency key (backend)
**File:** `src/apps/order-service/order-service.controller.ts`
- In-memory cache with 10-minute TTL
- `Idempotency-Key` header accepted and forwarded through api-gateway
- Same key within TTL returns cached result without re-processing
- Expired cache entries are evicted on each request

---

## Infrastructure

### Graceful 503 failover
**Files:** `src/shared/http/request-downstream.ts`,
`apps/api-gateway/src/filters/service-unavailable.filter.ts`,
`apps/api-gateway/src/api-gateway.module.ts`
- `requestDownstream` now aborts after **5 seconds** using `AbortController`
- On timeout or network failure, throws `ServiceUnavailableError`
- Global `GatewayExceptionFilter` catches it and returns a clean `503 JSON` response
- All other unhandled exceptions also return `503` instead of crashing

### Correlation IDs
**Files:** `apps/api-gateway/src/middleware/correlation-id.middleware.ts`,
`apps/api-gateway/src/api-gateway.module.ts`,
`apps/api-gateway/src/controllers/orders-gateway.controller.ts`
- Gateway reads `x-correlation-id` from every incoming request, or generates a UUID if absent
- Stamped on every response header
- Forwarded to order-service on all three order endpoints
- Order service logs the correlation ID on every `placeOrder` call

---

## Tests Added

| File | Tests | Coverage area |
|---|---|---|
| `src/services/auth-jwt.spec.ts` | 20 | JWT sign, verify, expiry, type guards |
| `src/controllers/auth-integration.spec.ts` | 14 | Login, refresh, logout |
| `src/controllers/auth-edge-cases.spec.ts` | 7 | Reuse detection, missing user |
| `src/apps/order-service/order-idempotency.spec.ts` | 8 | Idempotency cache + auth guard |
| `src/apps/order-service/order-placement.spec.ts` | 16 | Delivery/pickup, validation, rollback |
| `src/apps/order-service/order-promo.spec.ts` | 12 | Promo codes, edge cases |
| `src/apps/order-service/order-status.spec.ts` | 9 | Status mapping, terminal states |
| **Total** | **86** | |

### Test infrastructure
- `tests/fixtures/order-fixtures.ts` — shared Supabase mock builders + seed data
- `.env.test` — test environment template (Supabase mocked for unit tests)
- `.github/workflows/ci.yml` — GitHub Actions: runs tests on push/PR to main/develop

### Load tests
- `tests/performance/baseline.js` — 3 weighted k6 scenarios (browse 60%, orders 25%, checkout 15%)
- `tests/performance/utils/helpers.js` — auth + request helpers
- `tests/performance/results/baseline-template.md` — fill-in template after each run
- `tests/performance/results/threshold-breaches.md` — breach diagnosis playbook

---

## SQL Migrations to Run

| File | Target DB | Required? |
|---|---|---|
| `supabase/refresh-tokens-migration.sql` | Main Supabase | Optional (auth degrades gracefully) |
| `supabase/order-events-migration.sql` | Main Supabase | Optional (orders still work, just no event log) |

---

## Coverage Summary

| Service | Statements | Target | Status |
|---|---|---|---|
| `auth.service.ts` (JWT core) | 100% | 70% | ✅ |
| `order-service.service.ts` | 81% | 70% | ✅ |
| `order-service.controller.ts` | 58% | 70% | ⚠️ gap: search + track endpoints untested |
| `auth.controller.ts` | 28% | 70% | ⚠️ gap: registration + password reset untested |
