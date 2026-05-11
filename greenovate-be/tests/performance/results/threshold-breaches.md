# Threshold Breach Playbook (OOS-209)

When a k6 run ends with `✗` on a threshold, use this guide to diagnose and respond.

---

## Thresholds Quick Reference

| Threshold | Limit | Abort? |
|---|---|---|
| `http_req_duration p(95)` | < 500ms | No |
| `http_req_duration p(99)` | < 1500ms | No |
| `http_req_failed rate` | < 1% | **Yes** |
| `browse_products p(95)` | < 300ms | No |
| `order_history p(95)` | < 500ms | No |
| `checkout_flow p(95)` | < 1500ms | No |
| `checks{flow:browse} rate` | > 99% | No |
| `checks{flow:checkout} rate` | > 95% | No |

> `abortOnFail: true` on `http_req_failed` — if error rate exceeds 1% the test stops early to avoid hammering a broken service.

---

## Breach Response by Scenario

### browse_products p(95) > 300ms

**Likely causes:**
- Supabase query on `products` table doing a full scan (missing index on `category` or `status`)
- No caching on the catalog service — every request hits the DB

**Actions:**
- [ ] Add `EXPLAIN ANALYZE` on the product listing query in Supabase
- [ ] Check if `inStockOnly` filter has a composite index on `(status, stock)`
- [ ] Consider a short-lived in-memory cache (30–60s) on the catalog service for product lists
- [ ] If p95 is 300–500ms: **document and accept** — within overall threshold

---

### order_history p(95) > 500ms

**Likely causes:**
- `orders` table query missing index on `created_at` or `user_id`
- JWT validation overhead on every request

**Actions:**
- [ ] Add index `idx_orders_created_at` if missing
- [ ] Confirm `requireUserId()` is not making a DB call on every request (should be JWT-only)
- [ ] If p95 is 500–800ms: **document and accept** for now

---

### checkout_flow p(95) > 1500ms

This is the most critical — checkout is revenue.

**Likely causes:**
- `create_receipt` Supabase RPC is slow (check POS DB query plan)
- Transaction insert + items insert = 2 sequential DB writes
- Downstream calls to catalog (commit-stock), promo, cart are sequential

**Actions:**
- [ ] Measure each step individually using k6 `Trend` metrics (see below)
- [ ] Check if `commit-stock` and `clear-cart` can be parallelised with `Promise.all`
- [ ] Check POS DB indexes on `transactions(receipt_id)` and `receipts(receipt_id)`
- [ ] If p95 is 1500–2000ms: **document** with a note to optimise in next sprint
- [ ] If p95 > 2000ms: **fix before launch**

---

### http_req_failed > 1% (abort)

**Likely causes:**
- A downstream service (order-service, auth-service) crashed under load
- Connection pool exhaustion on Supabase
- Memory pressure causing OOM restarts

**Actions:**
- [ ] Check service logs immediately after the run
- [ ] Look for `503 Service Unavailable` responses (our gateway now returns these)
- [ ] Check Supabase dashboard for connection limit warnings
- [ ] Reduce k6 `rate` and re-run to find the breaking point
- [ ] Scale `preAllocatedVUs` down if services can't handle the load

---

## Adding Per-Step Metrics (for diagnosing checkout slowness)

Add this to `baseline.js` if you need to pinpoint which step is slow:

```javascript
import { Trend } from 'k6/metrics';

const deliveryEstimateDuration = new Trend('delivery_estimate_duration', true);
const placeOrderDuration = new Trend('place_order_duration', true);

// In checkout_flow():
const t1 = Date.now();
getDeliveryEstimate(data.token);
deliveryEstimateDuration.add(Date.now() - t1);

const t2 = Date.now();
placeOrder(...);
placeOrderDuration.add(Date.now() - t2);
```

k6 will then report `delivery_estimate_duration` and `place_order_duration` separately in the summary.

---

## Accepted Breaches Log

Record thresholds that were breached but accepted (with reasoning):

| Date | Threshold | Actual | Reason accepted | Revisit by |
|---|---|---|---|---|
| | | | | |
