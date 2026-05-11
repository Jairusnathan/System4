# Test Coverage Report (OOS-227)

**Date:** 2026-05-11  
**Test suites:** 7  
**Total tests:** 86 passing, 0 failing

---

## Coverage by Service (Targeted Files Only)

These are the files we own and wrote tests for. Overall project % is low because
branches, products, delivery, and promo services have no tests yet (out of scope for this sprint).

### Order Service

| File | Statements | Branches | Functions | Lines | Target |
|---|---|---|---|---|---|
| `order-service.service.ts` | **81.25%** | 65.45% | 89.47% | **80.76%** | 70% ✅ |
| `order-service.controller.ts` | 58.49% | 53.33% | 40% | 60.41% | 70% ⚠️ |

**order-service.service.ts is above 70% ✅**

Uncovered lines in the service (65-70, 205, 213, 268, 275, 282) are:
- `search()` method — not critical for order flow, lower priority
- A few error-path branches in stock commit/release
- `normalizePaymentMethodForPos()` edge cases

Uncovered lines in the controller (37-54, 60-72) are:
- `search` endpoint — not tested yet
- `track` endpoint — not tested yet

### Auth Service

| File | Statements | Branches | Functions | Lines | Target |
|---|---|---|---|---|---|
| `auth.service.ts` | **100%** | **90%** | **100%** | **100%** | 70% ✅ |
| `auth.controller.ts` | 28.13% | 12.36% | 28.57% | 27.69% | 70% ⚠️ |

**auth.service.ts (JWT core) is 100% ✅**

`auth.controller.ts` is below 70% because the following flows have no tests yet:
- Registration flow (lines 107–253) — email verification, OTP, new user creation
- Password reset flow (lines 411–539) — request reset, verify code, update password
- Profile update (lines 545–590)
- Address management (lines 598–743)

These are valid flows to test in a future sprint. The critical flows (login, refresh, logout)
that we tested represent the highest-risk paths in the auth controller.

---

## Coverage by Test File

| Test file | Tests | What it covers |
|---|---|---|
| `auth-jwt.spec.ts` | 20 | `AppAuthService` — sign, verify, expiry, type guards |
| `auth-integration.spec.ts` | 14 | Login, refresh, logout happy paths |
| `auth-edge-cases.spec.ts` | 7 | Reuse detection, revoked token, missing user |
| `order-idempotency.spec.ts` | 8 | Idempotency cache, auth guard, error passthrough |
| `order-placement.spec.ts` | 16 | Delivery/pickup paths, validation, stock rollback |
| `order-promo.spec.ts` | 12 | Promo apply/reject, edge cases |
| `order-status.spec.ts` | 9 | Status mapping, null cases, terminal states |

---

## What Would Reach 70% on auth.controller.ts

To push `auth.controller.ts` to ≥70%, add tests for:
1. Registration step 1 — `POST /auth/register` (send OTP)
2. Registration step 2 — `POST /auth/register/verify` (confirm OTP + create user)
3. Password reset — `POST /auth/request-password-reset`

Estimated: ~15 additional tests would bring it to ~75%.

---

## How to Re-run

```bash
# Coverage for order + auth only (fast)
npx jest --coverage \
  --testPathPattern="auth-jwt|auth-integration|auth-edge-cases|order-idempotency|order-placement|order-promo|order-status"

# Full project coverage (slow, includes untested services)
npx jest --coverage
```
