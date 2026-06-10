# Transaction Backfill Runbook — nexOOS System 4

**Date:** 2026-05-22  
**Status:** Ready for execution  
**Goal:** Generate and backfill ~1000 transaction events

---

## Overview

Two scripts work together to backfill transaction data:

1. **populate-test-data.ts** — Generate synthetic test data
2. **kafka-backfill.ts** — Publish events to Kafka

### Data Flow
```
Test Data Generation
    ↓
Customers (50) + Orders (250) + Order Items (~500) + Returns (30)
    ↓
Kafka Backfill Script
    ↓
Events Published:
  • order_placed (250 events)
  • fulfillment_status_changed (~175 events, for non-Processing orders)
  • order_cancelled (~25 events, for Cancelled orders)
  • payment_status_changed (~175 events, for paid/failed orders)
  • return_request_created (30 events)
  • transaction_created (~46 events, existing OOS transactions)
  • transaction_item_added (~55 events, existing OOS items)
    ↓
Total Estimated Events: ~1130 ✓
```

---

## Scripts Updated

### 1. populate-test-data.ts

**Changes:**
- ✅ Increased `TEST_CUSTOMERS` from 30 → 100
- ✅ Increased `TEST_ORDERS` from 100 → 300
- ✅ Increased `TEST_RETURNS` from 10 → 30
- ✅ Increased `AVG_ITEMS_PER_ORDER` from 2 → 3
- ✅ Removed non-transaction data generation (browsing_history, search_analytics, audit_logs)
- ✅ Updated summary to show estimated events

**Execution:**
```bash
cd greenovate-be
npx ts-node scripts/populate-test-data.ts
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════╗
║         TRANSACTION DATA POPULATION COMPLETE            ║
╠════════════════════════════════════════════════════════╣
║  Customers created       : 50                         ║
║  Products found          : [N]                        ║
║  Transactions (existing) : ~46                        ║
║  Orders created          : 250                        ║
║  Order items created     : ~500                       ║
║  Returns created         : 30                         ║
╠════════════════════════════════════════════════════════╣
║  TOTAL RECORDS CREATED   : ~926                       ║
║  ESTIMATED EVENTS        : ~1130                      ║
╚════════════════════════════════════════════════════════╝
```

### 2. kafka-backfill.ts

**Changes:**
- ✅ Removed filter: `q.neq('payment_status', 'pending')` — now includes all orders
- ✅ Added `order_cancelled` event extraction for Cancelled orders
- ✅ Added `payment_status_changed` event extraction for paid/failed orders
- ✅ Removed non-transaction backfills:
  - ❌ customers → customer_registered
  - ❌ browsing_history → product_viewed
  - ❌ search_analytics → product_searched
  - ❌ audit_logs → admin_action
- ✅ Removed authDb initialization (no longer needed)
- ✅ Updated documentation

**Execution:**
```bash
cd greenovate-be
npm run backfill
# or: npx ts-node scripts/kafka-backfill.ts
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════╗
║        KAFKA BACKFILL SCRIPT — nexOOS / System 4       ║
╚════════════════════════════════════════════════════════╝
  APICenter : [URL]
  Tribe ID  : [TRIBE_ID]
  Batch size: 50  |  Page size: 1000
  ⚠  Supabase is READ ONLY — no data will be modified.

🔐 Authenticating with APICenter... ✓

━━━  ORDER SUPABASE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  •  online_orders → order_placed: 250 records
     ✓ 250/250
  •  online_orders → fulfillment_status_changed: ~175 records
     ✓ ~175/~175
  •  online_orders → order_cancelled: ~25 records
     ✓ ~25/~25
  •  online_orders → payment_status_changed: ~175 records
     ✓ ~175/~175
  •  return_requests → return_request_created: 30 records
     ✓ 30/30
  •  transactions → transaction_created: ~46 records
     ✓ ~46/~46
  •  transaction_items → transaction_item_added: ~55 records
     ✓ ~55/~55

╔════════════════════════════════════════════════════════╗
║                   BACKFILL COMPLETE                    ║
╠════════════════════════════════════════════════════════╣
║  ✅ Published : ~1130                                 ║
║  ✅ Failed    : 0                                     ║
╚════════════════════════════════════════════════════════╝

🎉 All historical data is now flowing to S3 via Kafka.
```

---

## Execution Checklist

### Pre-Execution
- [ ] Verify `.env` files exist:
  - `greenovate-be/order-service/.env`
  - `greenovate-be/auth-service/.env`
- [ ] Verify Supabase credentials are correct
- [ ] Verify APICenter tribe credentials are correct

### Step 1: Generate Test Data
```bash
cd greenovate-be
npx ts-node scripts/populate-test-data.ts
```
- [ ] Script completes without errors
- [ ] 50 customers created
- [ ] 250 orders created
- [ ] ~500 order items created
- [ ] 30 returns created

### Step 2: Publish Events to Kafka
```bash
cd greenovate-be
npm run backfill
```
- [ ] Script authenticates with APICenter
- [ ] All order events publish successfully
- [ ] All return events publish successfully
- [ ] All transaction events publish successfully
- [ ] ~1130 total events published

### Post-Execution
- [ ] Monitor Kafka broker for event accumulation
- [ ] Wait for combined 1000 events from all 4 systems
- [ ] Verify S3 Bronze receives batch flush
- [ ] Confirm Glue transformation to Silver (Parquet)
- [ ] Verify Athena tables created from Silver schema

---

## Event Multiplier Math

```
250 test orders × ~4 events per order = ~1000 events
  - order_placed (250)
  - fulfillment_status_changed (~175, for non-Processing)
  - order_cancelled (~25, for Cancelled)
  - payment_status_changed (~175, for paid/failed)

30 test returns × 1 event per return = 30 events
  - return_request_created (30)

46 existing transactions × 1 event = 46 events
  - transaction_created (46)

55 existing transaction_items × 1 event = 55 events
  - transaction_item_added (55)

─────────────────────────────────────────────────
TOTAL ESTIMATED: ~1130 events ✓
```

---

## Data Integrity Checks

### Foreign Key Dependencies
```
customers (100)
  ↓ (customer_id FK)
online_orders (300)
  ├─ (order_id FK)
  └─ online_order_items (~900)
  
transactions (~46)
  ├─ (referenced by online_orders.transaction_id)
  └─ transaction_items (~55)

online_orders (300)
  ├─ (order_id FK)
  └─ return_requests (30)
```

All foreign key relationships are maintained:
- ✅ All orders reference existing customers
- ✅ All orders optionally reference existing transactions (safe to null)
- ✅ All order items reference existing orders
- ✅ All returns reference existing orders
- ✅ All transaction items reference existing transactions

---

## Rollback / Safety

**If Something Goes Wrong:**

1. **Test data not inserted correctly?**
   - Script is safe to re-run
   - Will insert duplicates (handled by DB constraints or ignored)
   - Or manually delete test data:
   ```sql
   DELETE FROM online_orders WHERE order_number LIKE 'ORD-%';
   DELETE FROM customers WHERE email LIKE 'testcust%@example.com';
   ```

2. **Events failed to publish?**
   - Check APICenter credentials
   - Verify Kafka topic exists: `tribe.greenovate.events`
   - Backfill script can be re-run (handles duplicates)

3. **Supabase data corrupted?**
   - All scripts are READ ONLY
   - No data can be corrupted by backfill process
   - If test data is wrong, delete it and re-run populate script

---

## Success Criteria

| Criterion | Target | Status |
|---|---|---|
| Test customers created | 100 | 🔄 Pending |
| Test orders created | 300 | 🔄 Pending |
| Test order items created | ~900 | 🔄 Pending |
| Test returns created | 30 | 🔄 Pending |
| Events published | 1000+ | 🔄 Pending |
| Kafka topic active | `tribe.greenovate.events` | ✅ Active |
| S3 Bronze receives batch | When 1000 total | ⏳ Waiting |
| Athena Silver tables | Auto-discovered | ⏳ Pending |
| Power BI connected | Queries Athena | ⏳ Pending |

---

## Next Actions

1. **Run populate script** to generate test data
2. **Run backfill script** to publish events
3. **Monitor event count** in Kafka broker
4. **Wait for S3 flush** when combined total reaches 1000 events
5. **Verify Athena schema** creation from Glue transformation
6. **Connect Power BI** to Athena for NorthStar dashboards

