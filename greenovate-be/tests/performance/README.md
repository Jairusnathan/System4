# k6 Performance Tests

## Scripts

| File | Purpose |
|---|---|
| `smoke.js` | Single-request sanity check (CI gate) |
| `baseline.js` | Weighted load test — 3 scenarios, 3 minutes |
| `utils/helpers.js` | Shared auth, request, and check helpers |
| `results/baseline-template.md` | Copy + fill in after each baseline run |
| `results/threshold-breaches.md` | Playbook for investigating failed thresholds |

---

## Requirements

Install k6 once:

```bash
# macOS
brew install k6

# Windows (winget)
winget install k6 --source winget

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

---

## Running the Tests

### 1. Smoke test (quick sanity check)

```bash
k6 run tests/performance/smoke.js \
  -e BASE_URL=http://localhost:4000
```

### 2. Baseline load test (OOS-205 / OOS-208)

Make sure all services are running first:
```bash
npm run dev:backend   # starts api-gateway + all services
```

Then run:
```bash
k6 run tests/performance/baseline.js \
  -e BASE_URL=http://localhost:4000 \
  -e TEST_EMAIL=your-test-user@email.com \
  -e TEST_PASSWORD=yourpassword \
  -e TEST_PRODUCT_ID=a-valid-product-id-from-your-db
```

### 3. Save results for documentation

```bash
k6 run tests/performance/baseline.js \
  -e BASE_URL=http://localhost:4000 \
  -e TEST_EMAIL=your@email.com \
  -e TEST_PASSWORD=yourpassword \
  -e TEST_PRODUCT_ID=prod-xxx \
  --out json=tests/performance/results/baseline-$(date +%Y%m%d).json
```

Then copy `results/baseline-template.md` → `results/baseline-YYYYMMDD.md` and fill it in.

---

## Traffic Weights

```
browse_products  ████████████ 60%   6 req/s   (product listing + search)
order_history    █████        25%   2 req/s   (GET /orders/search)
checkout_flow    ███          15%   1 req/s   (delivery estimate + place order)
```

---

## Thresholds

A run **passes** when all thresholds are green (`✓`).  
Only `http_req_failed > 1%` aborts the run early.

| Threshold | Limit |
|---|---|
| Overall p95 | < 500ms |
| Overall p99 | < 1500ms |
| Error rate | < 1% |
| Browse p95 | < 300ms |
| Order history p95 | < 500ms |
| Checkout p95 | < 1500ms |

See `results/threshold-breaches.md` for what to do when a threshold fails.

---

## CI Integration

The CI workflow (`.github/workflows/ci.yml`) runs unit tests on every push.  
Load tests are **not** run in CI automatically — they require live services and test credentials.  
Run them manually before each production release.
