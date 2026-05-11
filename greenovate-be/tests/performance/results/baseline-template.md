# Baseline Load Test Results

**Date:** YYYY-MM-DD  
**Tester:**  
**Environment:** staging / production  
**BASE_URL:**  
**k6 version:** (run `k6 version`)  
**Duration:** 3 minutes per scenario  

---

## Setup

```bash
k6 run tests/performance/baseline.js \
  -e BASE_URL=http://localhost:4000 \
  -e TEST_EMAIL=<test-user-email> \
  -e TEST_PASSWORD=<test-user-password> \
  -e TEST_PRODUCT_ID=<a-valid-product-id>
```

---

## Traffic Distribution

| Scenario | Rate | Weight |
|---|---|---|
| browse_products | 6 req/s | 60% |
| order_history   | 2 req/s | 25% |
| checkout_flow   | 1 req/s | 15% |

---

## Results Summary

Paste the k6 summary output here after running.

```
# paste k6 output here
```

---

## Key Metrics

| Metric | browse_products | order_history | checkout_flow | Overall |
|---|---|---|---|---|
| p50 (ms) | | | | |
| p95 (ms) | | | | |
| p99 (ms) | | | | |
| Avg (ms) | | | | |
| Error rate | | | | |
| Req/s | | | | |

---

## Threshold Results

| Threshold | Target | Actual | Pass? |
|---|---|---|---|
| p(95) overall | < 500ms | | |
| p(99) overall | < 1500ms | | |
| Error rate | < 1% | | |
| p(95) browse | < 300ms | | |
| p(95) order history | < 500ms | | |
| p(95) checkout | < 1500ms | | |
| Check pass rate (browse) | > 99% | | |
| Check pass rate (checkout) | > 95% | | |

---

## Bottlenecks Identified

List any endpoints or flows that failed thresholds or showed high latency:

1. **Endpoint / Scenario:**  
   - p95: __ ms (threshold: __ ms)  
   - Root cause hypothesis:  
   - Action: (fix / document / accept)

2. *(add more as needed)*

---

## Infrastructure at Time of Test

| Component | Detail |
|---|---|
| API Gateway | port 4000, single instance |
| Order Service | port 4105, single instance |
| Auth Service | port 4101, single instance |
| Supabase | shared / dedicated |
| Server CPU / RAM | |
| Node.js version | |

---

## Next Run

After any fixes, re-run and record results here to confirm improvement:

**Date:**  
**Changes made:**  
**p95 before / after:**  
