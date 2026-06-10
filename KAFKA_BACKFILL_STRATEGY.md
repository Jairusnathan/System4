# Kafka Backfill Strategy — nexOOS System 4

**Document Date:** 2026-05-22  
**Status:** In Progress — Data Generation Phase  
**Pipeline:** Supabase → Kafka (APICenter) → S3 Bronze → Glue → Athena Silver/Gold → Power BI

---

## 1. Business Context

### North Star Question
> "How can we optimize the online ordering experience by streamlining fulfillment, maximizing high-ticket cart conversions, and ensuring top-selling products are always in stock?"

### Three Analytical Personas
1. **Online Customer** — Cart value vs Global AOV; expedited shipping recommendations
2. **Store Admin** — Fulfillment queue volume; velocity surge detection; staffing alerts
3. **Business Owner** — Category demand; procurement strategy (Bulk vs JIT)

**Data Source:** Only **transaction tables** answer these questions:
- `online_orders` (order history, totals, fulfillment status)
- `return_requests` (refund history)
- `customers` (DEPENDENCY — required for order_placed events with customer context)

---

## 2. Event Distribution Strategy

### Minimum Flush Requirement
- **Total minimum events:** 1000 (across 4 external systems, not 4 microservices)
- **Distribution:** 250 events per external system
- **nexOOS share:** ~250 events

### External Systems
1. **Online Ordering System (nexOOS)** — our system (250 events)
2. **POS System** — in-store sales (250 events)
3. **Supply Chain System** — purchase orders (250 events)
4. **Rewards System** — points/redemptions (250 events)

---

## 3. Current Backfill Status

### Published Events (117 total)
| Table | Event Type | Count | Status |
|---|---|---|---|
| `online_orders` | `order_placed` | ~40-50 | ✅ Published |
| `online_orders` | `fulfillment_status_changed` | ~20-30 | ✅ Published |
| `return_requests` | `return_request_created` | ~15-20 | ✅ Published |
| `audit_logs` | `admin_action` | ~25 | ⏳ Pending (audit topic provisioning) |

### Gap to Target
- **Current:** 117 events (142 after audit topic provisioning)
- **Target per nexOOS:** 250 events
- **Shortfall:** ~108 events (50-100 more needed minimum)
- **User request:** 500 MORE events (total 617+)

---

## 4. Data Dependencies

### Online Order Event Requirements
To backfill `order_placed` events, we need:
```
online_orders ← customers (FK: customer_id)
              ← online_order_items (FK: online_order_id)
              ← products (via online_order_items.product_id)
```

**Required tables for test data generation:**
1. **customers** — Must exist first (customer_id PK)
2. **products** — Must exist (product_id PK) 
3. **online_orders** — References customers + products
4. **online_order_items** — References orders + products
5. **return_requests** — References online_orders

---

## 5. Test Data Generation Plan

### Phase 1: Create Test Customers (50-100 records)
```sql
INSERT INTO customers (id, full_name, email, phone, birthday, gender, created_at)
VALUES 
  (uuid(), 'Test Customer 1', 'test1@example.com', '+63912345601', '1990-01-01', 'M', NOW()),
  ...
```

### Phase 2: Create Test Orders (200-300 records)
- Each order references a test customer
- Order totals: $50–$500 (realistic range)
- Fulfillment status: Mix of Processing, Packed, Shipped, Delivered, Cancelled
- Created timestamps: Spread over last 30 days (realistic timeline)

```
200 orders × 3 events per order (order_placed + fulfillment_status_changed + payment_status_changed)
= 600 events
+ 50 cancelled orders × 1 event (order_cancelled) = 50 events
+ 30 returns × 1 event (return_request_created) = 30 events
─────────────────────────────────────────────────────
Total: ~680 events from test data
```

### Phase 3: Create Test Order Items
- Each order has 2-5 line items
- Reference test products
- Realistic category distribution (pharmacy, groceries, etc.)

### Phase 4: Create Test Returns
- 10-20% of orders have returns
- Reference corresponding orders

---

## 6. Backfill Script Behavior

### Events Generated Per Order
| Scenario | Events |
|---|---|
| Normal order (placed → fulfilled) | 3 (order_placed + fulfillment_status_changed + payment_status_changed) |
| Cancelled order | 2 (order_placed + order_cancelled) |
| Returned order | +1 (return_request_created) |

### Current Backfill Coverage
✅ `order_placed` — published  
✅ `fulfillment_status_changed` — published  
✅ `return_request_created` — published  
⏳ `order_cancelled` — NOT YET (can add from cancelled orders)  
⏳ `payment_status_changed` — NOT YET (can add from payment status transitions)  

---

## 7. Implementation Roadmap

### Step 1: Generate Test Data (NOW)
- [ ] Create test customers (50-100)
- [ ] Create test products (if not enough exist)
- [ ] Create test orders (200-300) with varied statuses
- [ ] Create test order items (line items)
- [ ] Create test returns (20-30)
- [ ] Verify foreign key integrity

### Step 2: Update Backfill Script
- [ ] Add `order_cancelled` event extraction
- [ ] Add `payment_status_changed` event extraction
- [ ] Re-test script locally

### Step 3: Run Backfill
- [ ] Wait for Maxine's team to provision `tribe.greenovate.audit` topic
- [ ] Run: `npm run backfill`
- [ ] Verify all events published (target: 600+ events)

### Step 4: Monitor S3 Flush
- [ ] Wait for nexOOS events + other 3 systems → 1000 total
- [ ] S3 Bronze receives batch
- [ ] Glue transforms to Parquet (Silver)
- [ ] Athena queries Silver/Gold tables
- [ ] Power BI connects to Athena for dashboards

---

## 8. Key Decisions

### ✅ Confirmed
- **Transaction-only backfill** (orders + returns, not searches/views/registrations)
- **Include customer data** (required dependency for order events)
- **Generate test data** (to reach 500+ event target)
- **All 4 external systems contribute to 1000 minimum** (we provide 250+)

### ⏳ Pending
- Maxine's team: Provision `tribe.greenovate.audit` topic for 25 admin_action events
- Maxine's team: Confirm S3 Bronze bucket location and Glue job configuration

---

## 9. Rollback & Safety

✅ **Supabase is READ ONLY** — Backfill script doesn't modify any data  
✅ **Safe to re-run** — Duplicate events handled by pipeline deduplication  
✅ **Test data is isolated** — Can be deleted after S3 flush completes if needed  

---

## 10. Success Criteria

| Criterion | Target | Status |
|---|---|---|
| Total events backfilled | 600+ | 🔄 In Progress |
| Kafka topic published | `tribe.greenovate.events` | ✅ Active |
| S3 Bronze receives batch | When 1000 total across systems | ⏳ Waiting |
| Athena Silver/Gold ready | Schema auto-discovered by Glue | ⏳ Pending Glue job |
| Power BI connected | Queries Athena for dashboards | ⏳ Pending NorthStar implementation |

