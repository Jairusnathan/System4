# Complete Guide: Kafka → S3 Analytics Pipeline Implementation
**Version:** 1.0  
**Date:** 2026-05-22  
**For:** nexOOS System 4 (Online Ordering System)  
**Purpose:** Reusable playbook for implementing event streaming to S3 across multiple systems

---

## TABLE OF CONTENTS
1. [Overview & Vision](#overview--vision)
2. [Architecture](#architecture)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Current Implementation State](#current-implementation-state)
5. [How to Apply to Other Systems](#how-to-apply-to-other-systems)

---

## OVERVIEW & VISION

### Business Goal
> "How can we optimize the online ordering experience by streamlining fulfillment, maximizing high-ticket cart conversions, and ensuring top-selling products are always in stock?"

**Data Pipeline Required:**
- Capture ALL business events (orders, returns, customers, searches, admin actions)
- Stream via governed Kafka broker (APICenter)
- Land in S3 Bronze (raw JSON)
- Transform via AWS Glue → S3 Silver (Parquet)
- Analyze via Athena → Power BI dashboards (Gold)

### Why This Approach?
- ✅ **Governed Kafka:** APICenter manages topics, permissions, compliance
- ✅ **S3 Bronze:** Immutable event log, audit trail
- ✅ **Medallion Architecture:** Bronze (raw) → Silver (cleaned) → Gold (KPIs)
- ✅ **Real-time + Historical:** Backfill past data + stream future events
- ✅ **Shared Infrastructure:** Multiple systems (POS, Supply Chain, Rewards) use same Kafka broker

---

## ARCHITECTURE

### High-Level Flow
```
Supabase (Order Service)
       ↓
NestJS Microservices (Event Publishing)
       ↓
APICenter Tribe (Kafka Broker)
       ↓
Kafka Topics: tribe.greenovate.{events, commands, audit}
       ↓
S3 Bronze (Raw JSON) ← Batch flush when 1000 events accumulate
       ↓
AWS Glue (Parquet transformation)
       ↓
S3 Silver (Cleaned data)
       ↓
Athena SQL (Query layer)
       ↓
Power BI Dashboards (3 personas: Customer, Admin, Owner)
```

### Key Components

#### 1. **APICenter Tribe**
- Managed Kafka broker (hosted by external team)
- One tribe per organization: `tribe.greenovate`
- Three topic types:
  - `tribe.greenovate.events` — All business events
  - `tribe.greenovate.commands` — Command/action events
  - `tribe.greenovate.audit` — Admin/compliance events

#### 2. **Event Types & Mapping**
| Domain | Event | Kafka Topic | Source Table |
|---|---|---|---|
| Orders | order_placed | events | online_orders |
| Orders | fulfillment_status_changed | events | online_orders |
| Returns | return_request_created | events | return_requests |
| Customers | customer_registered | events | customers |
| Products | product_viewed | events | browsing_history |
| Products | product_searched | events | search_analytics |
| Admin | admin_action | audit | audit_logs |

#### 3. **Data Dependencies**
```
customers (no deps)
    ↑
    └─ online_orders
         ├─ online_order_items
         └─ return_requests

products (no deps)

transactions (no deps - shared with POS)

browsing_history → customers + products
search_analytics (no deps)
audit_logs (no deps)
```

---

## STEP-BY-STEP IMPLEMENTATION

### PHASE 1: SET UP APICENTER INTEGRATION

#### Step 1.1: Create ApiCenterService in each Microservice

**What:** NestJS service that manages Kafka publishing via APICenter SDK  
**Files to Create:**
- `order-service/src/order/api-center.service.ts`
- `auth-service/src/auth/api-center.service.ts`
- `catalog-service/src/catalog/api-center.service.ts`

**Key Features:**
```typescript
// Constructor + Dependency Injection
constructor(private readonly configService: ConfigService) {}

// Initialize on module startup
async onModuleInit(): Promise<void> {
  // Load APICenter SDK (@implementsprint/sdk)
  // Authenticate with tribe credentials
  // Store client for later use
}

// Check if configured
isConfigured(): boolean {
  return Boolean(env.APICENTER_URL && env.APICENTER_TRIBE_ID && env.APICENTER_TRIBE_SECRET);
}

// Publish events to Kafka
async kafkaPublish(topic, eventType, payload, key?): Promise<void> {
  // Fire-and-forget with error logging
  // Don't throw on failure (graceful degradation)
}

// Build topic names dynamically
buildTopic(suffix: string): string {
  // Map domain suffixes to actual Kafka topics
  // orders/returns/users/products → "events"
  // admin → "audit"
}
```

**Configuration (Environment Variables):**
```
OOS_ORDER_APICENTER_URL=https://api-center-test.itsandbox.site
OOS_ORDER_APICENTER_TRIBE_ID=greenovate
OOS_ORDER_APICENTER_TRIBE_SECRET=***
```

**Fallback Pattern:** Check both service-specific AND shared env vars
```typescript
buildTopic(suffix: string): string {
  const tribeId = (
    this.configService.get<string>('APICENTER_TRIBE_ID') ??
    this.configService.get<string>('OOS_ORDER_APICENTER_TRIBE_ID') ??
    'unknown'
  );
  // ...
}
```

---

#### Step 1.2: Inject ApiCenterService into Each Module

**What:** Register service as provider so it initializes on startup  
**Files to Modify:**
- `order-service/src/order/order.module.ts`
- `auth-service/src/auth/auth.module.ts`
- `catalog-service/src/catalog/catalog.module.ts`

**Implementation:**
```typescript
@Module({
  providers: [OrderService, ApiCenterService], // Add ApiCenterService
  controllers: [OrderController],
})
export class OrderModule {}
```

**Result:** Service initializes, authenticates with APICenter, ready for event publishing

---

### PHASE 2: WIRE UP EVENT PUBLISHING IN BUSINESS LOGIC

#### Step 2.1: Identify Business Events

**What:** Find every Supabase write operation that represents a business event  
**Process:**
1. List all domain-specific tables (online_orders, return_requests, customers, etc.)
2. For each table, identify operations that represent events:
   - INSERT → event_created (order_placed, customer_registered)
   - UPDATE to specific status field → event_status_changed (fulfillment_status_changed)
   - UPDATE payment field → payment_status_changed

**Example: Order Service**
```typescript
// File: order-service/src/order/order.service.ts

async createOrder(data) {
  // 1. Write to Supabase
  const order = await supabase.from('online_orders').insert(data).single();
  
  // 2. Publish event (AFTER successful write)
  await this.apiCenterService.kafkaPublish(
    this.apiCenterService.buildTopic('orders'),
    'order_placed',
    {
      order_id: order.id,
      customer_id: order.customer_id,
      total: order.total,
      items: order.online_order_items,
      created_at: order.created_at,
    },
    order.id  // Key for partitioning
  );
}

async updateFulfillmentStatus(orderId, newStatus) {
  // 1. Write to Supabase
  const order = await supabase
    .from('online_orders')
    .update({ fulfillment_status: newStatus })
    .eq('id', orderId)
    .single();
  
  // 2. Publish event
  await this.apiCenterService.kafkaPublish(
    this.apiCenterService.buildTopic('orders'),
    'fulfillment_status_changed',
    {
      order_id: orderId,
      new_status: newStatus,
      occurred_at: new Date().toISOString(),
    },
    orderId
  );
}
```

**Event Publishing Rules:**
- ✅ Publish AFTER successful Supabase write
- ✅ Fire-and-forget (no error thrown if Kafka fails)
- ✅ Include relevant context (IDs, amounts, timestamps)
- ✅ Use order/customer ID as Kafka key for partitioning
- ✅ Preserve business semantics (event name = what happened)

---

#### Step 2.2: Integrate into All Business Logic

**What:** Add kafkaPublish calls to every relevant operation  
**Target Operations (by service):**

**Order Service:**
- ✅ order_placed (after order insert)
- ✅ fulfillment_status_changed (after status update)
- ✅ order_cancelled (after cancellation)
- ✅ payment_status_changed (after payment update)
- ✅ return_request_created (after return insert)

**Auth Service:**
- ✅ customer_registered (after customer insert)
- ✅ customer_login (after successful auth)
- ✅ admin_action (after any admin operation in audit log)

**Catalog Service:**
- ✅ stock_committed (after inventory reserve)
- ✅ stock_released (after inventory restore)
- ✅ product_created (after product insert)
- ✅ price_updated (after price change)

**Delivery Service:**
- ✅ delivery_assigned (after assignment)
- ✅ delivery_status_changed (after status update)
- ✅ delivery_completed (after completion)

**Result:** All business events are captured in real-time

---

### PHASE 3: BACKFILL HISTORICAL DATA

#### Step 3.1: Create Backfill Script

**What:** One-time script that reads all historical Supabase data and publishes to Kafka  
**File:** `greenovate-be/scripts/kafka-backfill.ts`

**Key Features:**
```typescript
// Load env from .env files
loadEnvFile('order-service/.env');
loadEnvFile('auth-service/.env');

// Authenticate with APICenter (get access token)
async function getToken(): Promise<string> {
  // POST /api/v1/auth/token with tribe credentials
  // Return access token (with 1-hour expiry caching)
}

// Publish events to Kafka (uses token)
async function kafkaPublish(topic, eventType, payload, key) {
  // POST /api/v1/kafka/publish
  // Headers: Authorization, X-Tribe-Id, X-SDK-Version, X-SDK-Tribe-Id
}

// Handle pagination (tables may have 1000+ rows)
async function fetchAll<T>(db, table, select, filter?): Promise<T[]> {
  // Loop: fetch PAGE_SIZE (1000) rows at a time
  // Stop when data.length < PAGE_SIZE
  // Return all accumulated data
}

// Batch publisher with rate limiting
async function processBatch<T>(label, items, handler) {
  // Process BATCH_SIZE (50) items in parallel
  // Wait BATCH_DELAY (150ms) between chunks
  // Display progress
}

// Main flow
// 1. Connect to Supabase (order-service + auth-service)
// 2. For each table:
//    - fetchAll() rows
//    - processBatch() to publish events
// 3. Report total published + failed
```

**Supported Tables:**
| Table | Events | Count |
|---|---|---|
| online_orders | order_placed, fulfillment_status_changed | ~40-50 |
| return_requests | return_request_created | ~15-20 |
| customers | customer_registered | ~50-100 |
| browsing_history | product_viewed | ~200+ |
| search_analytics | product_searched | ~50-100 |
| audit_logs | admin_action | ~25-50 |

**Safety:**
- ✅ Supabase READ ONLY
- ✅ Safe to re-run (duplicates deduped by Kafka)
- ✅ Idempotent (no side effects)

---

#### Step 3.2: Handle Governance Constraints

**Issue:** Kafka topics must be pre-registered in Confluent Cloud  
**Solution:** Map 6 business domains → 2 actual infrastructure topics

```typescript
buildTopic(suffix: string): string {
  const topicMap: Record<string, string> = {
    orders  : 'events',      // order_placed, fulfillment_status_changed
    returns : 'events',      // return_request_created
    users   : 'events',      // customer_registered
    products: 'events',      // product_viewed, product_searched
    admin   : 'audit',       // admin_action (separate topic)
  };
  return `tribe.${tribeId}.${topicMap[s] ?? s}`;
}
```

**Why:** Reduces topic proliferation; eventType field preserves business semantics

---

### PHASE 4: CONFIGURE EVENT DISTRIBUTION & FLUSHING

#### Step 4.1: Understand Minimum Flush Size

**Concept:** S3 only receives batch when Kafka accumulates 1000 events  
**Distribution:**
- Total events needed: 1000
- Divided across: 4 external systems (POS, Supply Chain, Rewards, OOS)
- Per system: ~250 events

**For nexOOS:**
- Historical backfill: ~117-142 events
- Real-time events: Accumulate as app operates
- Target: 250+ events to fulfill nexOOS share

**Implication:** Cannot trigger S3 flush with backfill alone; need real-time volume

---

#### Step 4.2: Generate Test Data (if Historical Volume Insufficient)

**What:** Create realistic test orders, customers, returns to pad event count  
**File:** `greenovate-be/scripts/populate-test-data.ts`

**Why:**
- Backfill only generates ~117 events from existing data
- Need 250+ per system to contribute fairly to 1000 minimum
- Test data simulates business activity

**Generation Order (respecting dependencies):**
1. Customers (75) — no dependencies
2. Products (verify existing)
3. Transactions (filter OOS from shared 17k)
4. Online Orders (250) — refs customers, transactions
5. Order Items (~750) — refs orders, products
6. Browsing History (~200) — refs customers, products
7. Search Analytics (75) — no deps
8. Returns (30) — refs orders
9. Audit Logs (40) — no deps

**Result:** ~1400+ test records → ~800+ events

---

### PHASE 5: EXECUTION

#### Step 5.1: Pre-Flight Checks

**Before running backfill:**
- ✅ APICenter credentials configured (in .env)
- ✅ Kafka topics exist and provisioned (confirm with Maxine's team)
- ✅ Tribe permissions granted (external:kafka:write)
- ✅ Services deployed with event publishing wired
- ✅ Test data generated (if needed)

#### Step 5.2: Run Scripts in Order

```bash
# 1. Populate test data (if needed)
npm run populate

# 2. Wait for Maxine's team to provision audit topic
# (Currently blocking 25 admin_action events)

# 3. Run backfill
npm run backfill

# Expected output:
# ✅ 117+ events published to Kafka
# ⏳ 25 events pending (audit topic provisioning)
# Total: 142+ events in Kafka queue
```

#### Step 5.3: Monitor Accumulation

```
Expected timeline:
- T=0: Backfill completes (142 events in Kafka)
- T=1h: Real-time orders accumulate (180 events)
- T=2h: Browsing/search events add up (200 events)
- T=24h: System operation → 250+ events for nexOOS
- T=other systems: POS (250), Supply Chain (250), Rewards (250)
- T=when total=1000: S3 flush triggers
```

#### Step 5.4: Verify S3 Arrival

```
Check S3 bucket:
s3://nexoos-bronze/tribe=greenovate/topic=events/
  - Should have JSON files with order_placed, fulfillment_status_changed, etc.
  
Glue job should auto-trigger:
  - Converts JSON → Parquet
  - Creates schema in Athena
  
Athena tables ready:
  - athena_silver.orders
  - athena_silver.order_status_changes
  - athena_silver.returns
  - athena_silver.payments
```

---

## CURRENT IMPLEMENTATION STATE

### What's Done ✅

| Component | Status | Details |
|---|---|---|
| **ApiCenterService** | ✅ Complete | order, auth, catalog services |
| **Event Publishing** | ✅ Complete | Wired in order, auth, catalog services |
| **Backfill Script** | ✅ Complete | Reads 6 tables, publishes events |
| **Test Data Script** | ✅ Complete | Generates ~1400 records |
| **npm Scripts** | ✅ Complete | `npm run backfill` and `npm run populate` |

### What's In Progress ⏳

| Blocker | Owner | Impact | Notes |
|---|---|---|---|
| tribe.greenovate.audit provisioning | Maxine's team | 25 admin_action events blocked | Once provisioned, re-run backfill |
| S3 Bronze setup | Maxine's team | Cannot receive events | Needs bucket + Glue job config |
| Real-time event accumulation | App usage | Reaching 1000 events | Natural through business operations |

### What's Pending (Not Yet Started) 🔄

| Task | Owner | Effort | Notes |
|---|---|---|---|
| Athena SQL schema creation | AWS team | Medium | Once S3 Bronze populated |
| Silver/Gold table definitions | Analytics team | Medium | Medallion layer transformation |
| Power BI dashboard wiring | BI team | High | 3 personas: Customer, Admin, Owner |
| Continuous monitoring setup | DevOps | Low | Alert on backlog > 500 events |

---

## HOW TO APPLY TO OTHER SYSTEMS

### For POS System (In-Store Sales)

#### Phase 1: Set Up APICenter Integration
```
1. Create pos-service/api-center.service.ts
   - Same pattern as order-service
   - Use OOS_POS_APICENTER_* env vars (or shared APICENTER_*)
   
2. Add to pos-service/src/pos/pos.module.ts
   - Inject ApiCenterService
   
3. Environment vars in pos-service/.env
   OOS_POS_APICENTER_URL=https://api-center-test.itsandbox.site
   OOS_POS_APICENTER_TRIBE_ID=greenovate
   OOS_POS_APICENTER_TRIBE_SECRET=***
```

#### Phase 2: Wire Up Event Publishing
```
In pos-service/src/pos/pos.service.ts:

- transaction_created (after sale insert)
- transaction_voided (after void)
- customer_lookup (after customer search)
- shift_opened (after shift start)
- shift_closed (after shift end)
- inventory_adjusted (after stock count)
```

#### Phase 3: Backfill Historical Data
```
1. Create greenovate-be/scripts/populate-test-data-pos.ts
   - Source: POS database (separate from OOS)
   - Tables: transactions, pos_customers, pos_inventory
   - Same dependency order logic
   
2. Add to package.json:
   "populate:pos": "npx ts-node --skip-project scripts/populate-test-data-pos.ts"
```

#### Phase 4: Run Backfill
```
npm run populate:pos
npm run backfill  # Uses same script (auto-detects all Supabase URLs in env)
```

---

### For Supply Chain System (Procurement & Inventory)

#### Phase 1: Set Up APICenter Integration
```
1. Create supply-chain-service/api-center.service.ts
   
2. Environment vars in supply-chain-service/.env
   OOS_SUPPLY_CHAIN_APICENTER_URL=...
   OOS_SUPPLY_CHAIN_APICENTER_TRIBE_ID=greenovate
   OOS_SUPPLY_CHAIN_APICENTER_TRIBE_SECRET=***
```

#### Phase 2: Wire Up Event Publishing
```
In supply-chain-service:

- purchase_order_created (PO issued)
- purchase_order_received (goods arrived)
- stock_level_updated (inventory recount)
- supplier_delivery_late (alert)
- reorder_point_breached (alert)
- forecast_generated (demand forecast)
```

#### Phase 3: Backfill + Test Data
```
1. Create greenovate-be/scripts/populate-test-data-supply-chain.ts
   - Tables: purchase_orders, suppliers, stock_movements, forecasts
   
2. Add to package.json:
   "populate:supply-chain": "..."
```

---

### For Rewards System (Loyalty & Points)

#### Phase 1-3: Same as Above
```
Events:
- points_issued (after purchase)
- points_redeemed (after redemption)
- tier_upgraded (after milestone)
- membership_created (new member)
- promotion_activated (new offer)
```

---

### Checklist for Each New System

**Set Up Phase:**
- [ ] Create service/api-center.service.ts (copy template from order-service)
- [ ] Add to module providers
- [ ] Add environment variables (.env file)
- [ ] Update buildTopic() to handle system-specific domain suffixes

**Event Publishing Phase:**
- [ ] Identify all business events in service
- [ ] Add kafkaPublish() calls after Supabase writes
- [ ] Test locally (check logs for publish calls)

**Backfill Phase:**
- [ ] Create populate-test-data-{system}.ts script
- [ ] Identify source database tables
- [ ] Generate test data (follow dependency order)
- [ ] Update backfill script to include new system's Supabase connection

**Execution Phase:**
- [ ] Run: npm run populate:system
- [ ] Wait for audit topic provisioning
- [ ] Run: npm run backfill
- [ ] Monitor Kafka for event accumulation
- [ ] Confirm S3 arrival

---

## KEY TAKEAWAYS FOR REPLICATION

### Design Principles
1. **Event-Driven:** Capture events at write time, not retroactively
2. **Fire-and-Forget:** Don't block business logic on Kafka failures
3. **Governed Infrastructure:** Use APICenter for compliance, not raw Kafka
4. **Medallion Architecture:** Bronze (raw) → Silver (clean) → Gold (insights)
5. **Shared Topics:** Multiple systems → same topics (eventType preserves semantics)
6. **Dependency-First:** Populate parent tables before children
7. **Batch with Rate Limiting:** Avoid overwhelming broker (BATCH_SIZE=50, BATCH_DELAY=150ms)

### Common Pitfalls to Avoid
- ❌ Publishing BEFORE Supabase write (if write fails, event is orphaned)
- ❌ Throwing errors on Kafka failure (blocks business logic)
- ❌ Using sequential publishes (slow; use Promise.all())
- ❌ Forgetting foreign key dependencies (causes insertion failures)
- ❌ Not setting Kafka partition key (loses ordering)
- ❌ Assuming Kafka topics exist (verify with governance team first)
- ❌ Backfilling without test data (never reach 1000 event minimum)

### Success Metrics
| Metric | Target | How to Measure |
|---|---|---|
| Events published | 1000+ per system | Kafka broker metrics |
| S3 flush triggered | Within 24h | Check s3://nexoos-bronze/ |
| Athena queries work | 100% | SELECT COUNT(*) athena_silver.orders |
| Power BI dashboards live | 3 personas | BI tool connections |
| No dropped events | 0 | Compare Kafka published vs S3 arrived |

---

## TEMPLATES & CODE SNIPPETS

### ApiCenterService Template
```typescript
// Copy from: order-service/src/order/api-center.service.ts
// Modify:
// 1. Class name: ApiCenterService (keep same)
// 2. Logger name: new Logger(ApiCenterService.name)
// 3. buildTopic() mapping for system-specific domains
// 4. Import path for SDK (@implementsprint/sdk)
```

### Event Publishing Template
```typescript
// In any service.ts that writes to Supabase:
async doSomething(data) {
  // Write to Supabase
  const result = await supabase.from('table').insert(data).single();
  
  // Publish event (AFTER successful write)
  await this.apiCenterService.kafkaPublish(
    this.apiCenterService.buildTopic('domain'),
    'event_name',
    { /* context */ },
    result.id  // key
  );
}
```

### Backfill Script Template
```typescript
// Copy from: greenovate-be/scripts/kafka-backfill.ts
// Modify:
// 1. Env var loading (add new system .env paths)
// 2. Data source queries (change table/column names)
// 3. Event extraction logic (map to system events)
// 4. BatchPublisher calls (processBatch invocations)
```

### Test Data Script Template
```typescript
// Copy from: greenovate-be/scripts/populate-test-data.ts
// Modify:
// 1. Table creation order (dependency analysis)
// 2. Record counts (TEST_CUSTOMERS, TEST_ORDERS, etc.)
// 3. Data generation (realistic values for system)
// 4. Insert queries (table names, columns)
```

---

## QUESTIONS TO ASK BEFORE REPLICATING

1. **What's the source database?** (Supabase, PostgreSQL, MySQL?)
2. **What events should flow to analytics?** (Define per business area)
3. **How many historical records to backfill?** (Determines script volume)
4. **Are there shared tables?** (e.g., POS + OOS share transactions table)
5. **What's the expected event rate?** (Orders: 100/day, Searches: 10000/day)
6. **Who maintains Kafka topics?** (Is it Maxine's team again?)
7. **Are there data privacy concerns?** (PII handling in S3?)

---

**End of Guide**

Next step: Apply this template to POS, Supply Chain, and Rewards systems. Then monitor combined 1000-event threshold for S3 flush.

