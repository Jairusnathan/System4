# Conversation Summary: Kafka Backfill Strategy Clarification
**Date:** 2026-05-22  
**Topic:** Determining which tables to backfill and reaching 1000 event minimum  
**Outcome:** Transaction-only backfill with test data generation strategy

---

## Initial Question: "Only Transactions Will Go to S3?"

**User Question:**
> "they say only transactions will go to the s3? what do u think about this"

**Context:** Maxine's team had stated "only transactions will go to the s3," but it was unclear what that meant:
- Did they mean only order/return transactions?
- Or did they mean something else about the data flow?

**Investigation Approach:** Read the backfill script to clarify what was currently being backfilled and explain Maxine's statement.

---

## Clarification 1: Full Backfill Scope (6 Tables)

**Current Backfill Implementation (at that time):**
1. ✅ `online_orders` → `order_placed` events
2. ✅ `return_requests` → `return_request_created` events
3. ✅ `customers` → `customer_registered` events
4. ✅ `browsing_history` → `product_viewed` events
5. ✅ `search_analytics` → `product_searched` events
6. ✅ `audit_logs` → `admin_action` events

**Total:** 142 events (117 published + 25 pending)

**Maxine's Statement Analysis:**
- She said "minimum flush size 1000"
- She said "so di papasok s3, waiting na mag 1000" (won't go to s3, waiting to reach 1000)
- She saw "59 events pending" in the queue
- Conclusion: The Kafka → S3 pipeline only flushes when batch reaches 1000 events

---

## Clarification 2: "Transactions Only" = Narrowing Scope

**User Clarification:**
> "but the api tribe want only the transactions only"

**Realization:**
Not all 6 tables contain transaction data. Transactions are:
- ✅ `online_orders` (customer purchases)
- ✅ `return_requests` (refund/return transactions)
- ❌ `customers` (master data, not a transaction)
- ❌ `browsing_history` (behavioral data, not a transaction)
- ❌ `search_analytics` (behavioral data, not a transaction)
- ❌ `audit_logs` (admin actions, not core transactions)

**Decision:** Remove non-transaction tables; keep only orders + returns.

**Events After Trimming:** ~117 events (down from 142)

---

## Clarification 3: The "4 Systems" Misunderstanding

**User Question:**
> "so which one will follow, the pipeline or the maxine team"

This led to discussion about who manages the pipeline. Then:

**User Question:**
> "i mean that 1000 data, is will divided into 4 system s"

**Initial Misunderstanding (WRONG):**
I thought the user meant 4 microservices within nexOOS:
- order-service
- auth-service
- catalog-service
- delivery-service

So I suggested backfilling from all 4 services.

**User Correction:**
> "no that 1000 data i think will be divided into 4 system"

Then clarified:

> "but the apicenter tribe want that have 1000 data from different system like paghahatian ng 4 system yung 1000 data and ithink tig 250 data kami"

Translation: "The APICenter tribe wants 1000 data from different systems, like dividing the 1000 data among 4 systems, and I think we get 250 data each."

**Final Clarification:**
> "no like 500 more transactions data"
> "their are other 4 system here that also have transation, for us our system is all about online ordering, other system have pos, supply chain and rewards system"

**The 4 Systems Are External Companies:**
1. **Online Ordering System (nexOOS)** — our system
   - Transactions: orders, returns
   - Our share: 250 events

2. **POS System** — another company
   - Transactions: in-store sales, refunds
   - Their share: 250 events

3. **Supply Chain System** — another company
   - Transactions: purchase orders, inventory movements
   - Their share: 250 events

4. **Rewards System** — another company
   - Transactions: points issued, redemptions
   - Their share: 250 events

**Total across all 4 companies:** 1000 events → triggers S3 flush

**Our Responsibility (nexOOS):** Provide 250+ transaction events from our online ordering system

---

## Clarification 4: Data Dependencies

**User Question:**
> "but we need to add new data since kulang pa" (but we need to add new data since it's still short)

**And:**
> "ok draft everything i talk about now, we need the others since the orders table have dependency in the other tables like customers"

**Realization:**
To generate transaction events, we need:
- `online_orders` ← depends on `customers` (FK: customer_id)
- `online_orders` ← depends on `products` (via order items)
- `online_order_items` ← depends on `online_orders`
- `return_requests` ← depends on `online_orders`

**So we MUST include `customers`** even though it's not a "transaction table," because:
1. Foreign key integrity requires it
2. `order_placed` events need customer context
3. Without test customers, we can't generate test orders

**Updated Transaction Tables:**
- ✅ `customers` (REQUIRED dependency)
- ✅ `online_orders` (core transaction)
- ✅ `online_order_items` (line items)
- ✅ `return_requests` (return transactions)

---

## Strategy Evolution: Event Count Target

### Initial State
- Backfilled: 117 events (orders + returns only)
- Target: 250 per nexOOS system
- Gap: 133 events

### User Request
> "but i need i think 500 more"

**Interpretation:** Need 500 MORE events (not 500 total)
- Current: 117
- Plus: 500 more
- **Total: 617 events needed**

### Why 500 More?
- Current orders/returns in Supabase are insufficient
- Test data generation required
- Need to account for multiple events per order:
  - `order_placed` (1 per order)
  - `fulfillment_status_changed` (1+ per order)
  - `payment_status_changed` (1+ per order)
  - `order_cancelled` (only for cancelled orders)
  - `return_request_created` (only for returned orders)

---

## Final Strategy: Test Data Generation

### Data Generation Plan

**Phase 1: Create Test Customers**
- Target: 50-100 test customers
- Ensures `online_orders.customer_id` has valid references
- Required before creating orders

**Phase 2: Create Test Orders**
- Target: 200-300 test orders
- Varied fulfillment statuses:
  - Processing
  - Packed
  - Shipped
  - Delivered
  - Cancelled
- Varied payment statuses:
  - pending
  - paid
  - failed
- Order totals: $50–$500 range
- Timestamps: Spread over last 30 days

**Phase 3: Create Test Order Items**
- 2-5 line items per order
- Reference test products
- Realistic categories (pharmacy, groceries, essentials)
- Proper pricing structure

**Phase 4: Create Test Returns**
- Target: 20-30 return requests
- Reference corresponding orders
- 10-20% return rate (realistic)

### Event Multiplication Math
```
200 test orders × 3 events per order = 600 events
  (order_placed + fulfillment_status_changed + payment_status_changed)

+ 50 cancelled orders × 1 additional event = 50 events
  (order_cancelled)

+ 30 returns × 1 event = 30 events
  (return_request_created)

─────────────────────────────────────────────────
Total from test data: ~680 events

+ Existing 117 events: 117 events
─────────────────────────────────────────────────
GRAND TOTAL: ~797 events (exceeds 500 more target)
```

---

## Key Decisions Made

### ✅ FINAL CONFIRMATION
1. **Transaction-only approach** — orders + returns only
2. **Include customer data** — required dependency, not optional
3. **Generate ~200-300 test orders** — to reach 500+ event target
4. **Multi-event backfill** — extract order_cancelled, payment_status_changed
5. **Test data timeline** — spread over last 30 days for realism
6. **Dependency-first generation** — customers → orders → items → returns

### ⏳ PENDING EXTERNAL ACTIONS
1. Maxine's team: Provision `tribe.greenovate.audit` topic
2. Maxine's team: Confirm S3 Bronze bucket and Glue job config
3. Real-time events: Other 3 systems contribute to reach 1000 total

---

## Implementation Checklist

### Pre-Backfill (Data Generation)
- [ ] Create TypeScript test data generation script
- [ ] Generate 50-100 test customers in Supabase
- [ ] Generate 200-300 test orders with mixed statuses
- [ ] Generate test order items (line items)
- [ ] Generate 20-30 test returns
- [ ] Verify foreign key integrity (no orphaned records)
- [ ] Verify order totals are realistic ($50–$500)
- [ ] Verify timestamps are spread over 30 days

### Backfill Script Updates
- [ ] Add `order_cancelled` event extraction
- [ ] Add `payment_status_changed` event extraction
- [ ] Test locally with new event types
- [ ] Verify event count reaches ~680+

### Execution
- [ ] Wait for Maxine's team: `tribe.greenovate.audit` provisioning
- [ ] Run: `npm run backfill`
- [ ] Verify all events published to Kafka
- [ ] Monitor Kafka broker for batch accumulation
- [ ] Wait for combined 1000 events (including other 3 systems)
- [ ] Confirm S3 Bronze receives flush
- [ ] Verify Glue transformation to Silver (Parquet)
- [ ] Confirm Athena tables created

### Validation
- [ ] Power BI can query Athena Silver/Gold
- [ ] NorthStar dashboards display correctly
- [ ] All 3 personas (Customer, Admin, Owner) have data

---

## NorthStar Alignment Check

### Does transaction-only data answer the North Star question?

**North Star:** "How can we optimize the online ordering experience by streamlining fulfillment, maximizing high-ticket cart conversions, and ensuring top-selling products are always in stock?"

| Persona | Need | Data Source | ✅ Covered? |
|---|---|---|---|
| **Online Customer** | Cart value vs Global AOV | `online_orders.total` | ✅ YES |
| **Store Admin** | Queue volume, velocity surge | `online_orders.fulfillment_status, created_at` | ✅ YES |
| **Business Owner** | Category demand, velocity | `online_order_items.category, quantity` | ✅ YES |

**Answer: YES** — Transaction data provides all necessary analytical fuel for NorthStar dashboards.

---

## Success Criteria

| Metric | Target | Status |
|---|---|---|
| Test data generated | 200–300 orders | 🔄 Pending |
| Events from test data | ~680+ | 🔄 Pending |
| Total backfilled events | ~797 (existing 117 + new 680) | 🔄 Pending |
| Kafka topic published | `tribe.greenovate.events` | ✅ Active |
| S3 flush triggered | When 1000 total (all 4 systems) | ⏳ Waiting |
| Athena queries working | Silver/Gold tables | ⏳ Pending |
| Power BI dashboards live | NorthStar metrics | ⏳ Pending |

---

## Next Action

**PROCEED WITH TEST DATA GENERATION SCRIPT**

Should I create a TypeScript script (`greenovate-be/scripts/generate-test-orders.ts`) that:
1. Connects to order-service Supabase
2. Generates 50-100 test customers
3. Generates 200-300 test orders with realistic data
4. Generates order items and returns
5. Inserts all with proper FK relationships
6. Reports total records created

**Ready to proceed?** ✅

