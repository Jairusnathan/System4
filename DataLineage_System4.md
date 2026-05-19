# System 4 — Online Ordering System (OOS)
## Comprehensive Analytical Profile & Data Lineage Report

> **Date:** 2026-05-19 | **Role:** Principal Software Engineer & Enterprise Data Architect  
> **Codebase:** `greenovate-be/` (NestJS microservices) + `nexOOS/` (Next.js frontend)  
> **Supabase Databases:** Two isolated Supabase projects — Auth/Order DB and Cart DB

---

## Section 1: Exact Data Sources

### 1.1 Supabase Tables — Auth/Order Database (Primary OOS DB)

| Table | Owner Service | Read By | Key Columns |
|---|---|---|---|
| `public.online_orders` | order-service | order-service, nexOOS admin | `id`, `customer_id`, `receipt_id`, `transaction_id`, `order_number`, `tx_no`, `branch_id`, `shipping_address`, `payment_method`, `payment_status`, `fulfillment_status`, `delivery_method`, `subtotal`, `delivery_fee`, `discount_amount`, `total`, `promo_code`, `metadata`, `created_at`, `cancelled_at`, `cancellation_reason` |
| `public.online_order_items` | order-service | order-service (Apriori), nexOOS admin | `id`, `online_order_id`, `product_id`, `product_name`, `category`, `unit_price`, `quantity`, `line_total` |
| `public.transactions` | order-service (writes) | POS (System 1) also writes here | `id`, `status`, `paid_at`, `subtotal`, `total_amount`, `payment_method`, `vat`, `items_count`, `discount_type`, `discount_amount`, `receipt_id`, `cashier_name` |
| `public.receipts` | order-service | order-service | `receipt_id`, `receipt_number`, `issued_at` |
| `public.return_requests` | order-service | order-service, nexOOS admin | `id`, `online_order_id`, `customer_id`, `receipt_number`, `reason`, `description`, `items` (JSONB), `status`, `created_at` |
| `public.customers` | auth-service | auth-service | `id`, `customer_number`, `full_name`, `email`, `phone`, `birthday`, `gender`, `address`, `profile_image`, `created_at`, `failed_login_attempts`, `account_locked_until` |
| `public.staff` | auth-service | auth-service | `id`, `staff_number`, `first_name`, `last_name`, `full_name`, `username`, `email`, `role`, `password`, `is_active`, `is_onboarded`, `failed_login_attempts`, `account_locked_until` |
| `public.browsing_history` | auth-service | auth-service (analytics) | `id`, `customer_id`, `product_id`, `category`, `view_count`, `viewed_at` |
| `public.search_analytics` | auth-service | auth-service (analytics) | `id`, `query`, `source`, `searched_at` |
| `public.audit_logs` | auth-service | auth-service (admin) | `id`, `staff_id`, `staff_name`, `staff_role`, `action`, `category`, `details`, `entity_id`, `created_at` |
| `public.oos_settings` | auth-service | nexOOS frontend (public) | `key`, `value`, `updated_at` |
| `public.refresh_token_families` | auth-service | auth-service | `user_id`, `token_hash`, `family_id`, `expires_at` |

### 1.2 Supabase Tables — Cart Database (Isolated Project)

| Table | Owner Service | Key Columns |
|---|---|---|
| `cart_items` | cart-service | `id`, `customer_id`, `product_id`, `branch_id`, `quantity`, `created_at` |

### 1.3 Supabase Stored Procedures / RPC Functions

| Function | Schema | Purpose |
|---|---|---|
| `issue_next_receipt_number()` | public | Atomically generates sequential receipt numbers |
| `increment_product_view(p_customer_id, p_product_id, p_category)` | public | Upserts `browsing_history`; inserts on first view, increments `view_count` on repeat |

### 1.4 Non-Database Analytics Storage

| Store | Location | Written By | Content |
|---|---|---|---|
| `search-analytics.log` | Filesystem, project root | analytics-service (NestJS) + auth-service | JSON lines: `{ query, source, timestamp }` — flat-file backup alongside DB writes |

---

### 1.5 Channel Discriminator — Shared Table Isolation

**Context:** `public.transactions` and `public.receipts` are shared with System 1 (POS). All other OOS tables are exclusive.

**Discriminator in use:**

| Mechanism | Column | Value | File | Line |
|---|---|---|---|---|
| Soft tag on insert | `cashier_name` | `'Ecommerce'` | `order-service/src/order/order.service.ts` | 333, 473 |
| Structural join | `public.online_orders.transaction_id` | FK → `transactions.id` | `online-orders-migration.sql` | 20 |

**How it works in practice:** All OOS analytics query `public.online_orders` and `public.online_order_items` directly — the shared `public.transactions` table is never queried for OOS analytics. The only reason OOS writes to `transactions` is for receipt-number sequencing and payment status tracking. The `cashier_name = 'Ecommerce'` value is the only programmatic tag; there is **no formal `sales_channel` column** in the transactions schema.

---

## Section 2: Actual Analytics Pipeline — Feature Engineering

All mathematical transformations occur **client-side in the Next.js frontend** (`nexOOS/src/app/admin/page.tsx`) and **in one NestJS endpoint** (`order-service/src/order/order.controller.ts`). There are **no server-side SQL aggregation queries** for analytics beyond simple `COUNT` and `SUM`.

### 2.1 Market Basket Analysis — Apriori Algorithm

**Locations:**
- Backend: `greenovate-be/order-service/src/order/order.controller.ts` — Lines 280–396 (`POST /orders/internal/co-purchases`)
- Frontend: `nexOOS/src/app/admin/page.tsx` — Lines 151–309 (`buildMarketBasket()`)

**Data source queried:**
```
online_order_items → select('online_order_id, product_id')   // no filter, all OOS items
```

**Exact formulas implemented:**

```
N = total number of non-cancelled online orders (transactions)

minSupport  = MAX(2 / N, 0.05)          // Backend adaptive
              = 0.30 (30%)              // Frontend fixed (MBA_MIN_SUP constant)
minConfidence = 0.30                   // Backend
              = 0.50 (50%)             // Frontend fixed (MBA_MIN_CONF constant)

For each frequent itemset {A, B}:
  support(A∩B)   = count(orders containing both A and B) / N
  confidence(A→B) = support(A∩B) / support(A)
  lift(A→B)       = confidence(A→B) / support(B)
  leverage(A→B)   = support(A∩B) − support(A) × support(B)
  conviction(A→B) = (1 − support(B)) / MAX(1e-9, 1 − confidence(A→B))
```

**Output:** Top-N product pairs ranked by lift DESC → confidence DESC → support DESC.

**Frontend display bins:**
- Lift ≥ 3 → `"Very Strong"` (green badge)
- Lift ≥ 2 → `"Strong"` (blue badge)
- Lift < 2 → `"Moderate"` (amber badge)

---

### 2.2 Revenue & Order Volume Time Series

**Location:** `nexOOS/src/app/admin/page.tsx` — Lines 83–131 (`buildDaily`, `buildMonthly`, `buildOverall`, `buildCompare`)

**Data source:** `online_orders` fetched via `/api/admin/orders?limit=500` — up to 500 most recent orders loaded into browser memory, then sliced client-side.

**Exact transformations:**

```
buildDaily(orders, year, month):
  For each day d in month:
    revenue[d] = SUM(order.total) WHERE order.date matches d AND status != 'Cancelled'
    orders[d]  = COUNT(orders) WHERE order.date matches d AND status != 'Cancelled'

buildMonthly(orders, year):
  For each month m:
    revenue[m] = SUM(order.total) WHERE year matches AND status != 'Cancelled'

buildOverall(orders):
  Group by "Mon YYYY" label → SUM(total), COUNT()

buildCompare(orders, yearA, yearB):
  For each month: revenue[yearA][m], revenue[yearB][m]  (side-by-side)
```

---

### 2.3 Fulfillment Rate

**Location:** `nexOOS/src/app/admin/page.tsx` — Lines 513–517

```
periodOrders  = COUNT(filtered orders)
delivered     = COUNT(filtered orders WHERE status == 'Delivered')
fulfillment % = ROUND((delivered / MAX(periodOrders, 1)) × 100)
```

---

### 2.4 Category Revenue Breakdown

**Location:** `nexOOS/src/app/admin/page.tsx` — Lines 145–149 (`buildCategory`)

```
For each non-cancelled order item:
  categoryRevenue[item.category] += item.price × item.quantity
Sort DESC, take top 6
```

---

### 2.5 Top Products by Units Sold

**Location:** `nexOOS/src/app/admin/page.tsx` — Lines 139–143 (`buildTopProducts`)

```
For each non-cancelled order item:
  unitsSold[item.name] += item.quantity
Sort DESC, take top 7
```

---

### 2.6 Search Query Trending

**Location:** `greenovate-be/auth-service/src/analytics/analytics.service.ts` — Lines 27–51 (`getTrending`)

```
since = NOW() − 7 days
SELECT query FROM search_analytics WHERE searched_at >= since

// Client-side aggregation in Node.js:
counts = Map<query.toLowerCase().trim(), count>
Return top-N sorted by count DESC
```

---

### 2.7 Product View Aggregation (Admin)

**Location:** `greenovate-be/auth-service/src/auth/auth.controller.ts` — Lines 1043–1075

```
SELECT product_id, category, view_count, viewed_at
FROM browsing_history
WHERE viewed_at BETWEEN [from] AND [to]
ORDER BY view_count DESC

// Node.js aggregation:
For each row: total_views[product_id] += row.view_count
Return sorted DESC by total_views, slice to limit
```

---

### 2.8 Customer Category Interest Score

**Location:** `greenovate-be/auth-service/src/auth/auth.controller.ts` — Lines 1094–1120

```
SELECT category, view_count FROM browsing_history WHERE customer_id = $userId

// Aggregation:
score[category] += MAX(view_count, 1)
Return sorted DESC — used to personalize product display
```

---

### 2.9 Customer Auth Statistics (Admin)

**Location:** `greenovate-be/auth-service/src/auth/auth.controller.ts` — Lines 1077–1092

```
totalCustomers = COUNT(*) FROM customers
newToday       = COUNT(*) FROM customers WHERE created_at >= TODAY_00:00:00
```

---

### 2.10 Sold Counts per Product (for catalog badges)

**Location:** `greenovate-be/order-service/src/order/order.controller.ts` — Lines 398–427

```
SELECT product_id, quantity FROM online_order_items WHERE product_id IN ($ids)

// Node.js aggregation:
soldCount[product_id] = SUM(quantity)
```

---

## Section 3: North Star Analytics Question

Based on all controllers and services in the codebase, the core business problem is:

> **"How do we maximize online order revenue and fulfillment speed by identifying which products are bought together, which categories drive the most online demand, and which customers are most engaged — so we can prescribe the right product pairings, staffing, and stocking decisions in real time?"**

**Operationally decomposed:**
1. **Revenue visibility** — Admins need a single real-time view of today's online revenue, order pipeline status, and fulfillment rate without manual SQL.
2. **Product discovery optimization** — Customers browsing online should surface co-purchased products and high-affinity categories to increase Average Order Value.
3. **Fulfillment queue management** — Admins need to see how many orders are Processing vs. In Transit to allocate fulfillment staff.
4. **Return & refund lifecycle** — Admins need to manage return requests with status transitions (pending → reviewing → approved/rejected) to protect revenue from erosion.
5. **Procurement signals** — Owners need to know which product categories are trending online so they can adjust purchasing before stockouts occur.

---

## Section 4: Stakeholders, Personas & Analytical Stage Mapping

### Persona A — Online Customer (End User)

**Access Control:** JWT token with `{ userId, email }` — no `isAdmin` flag. Enforced in `order-service` via `authService.requireUserId()`.

#### Descriptive (What historical data is shown)

| Data Point | Source Table | Query |
|---|---|---|
| Full order history | `online_orders` + `online_order_items` | `.eq('customer_id', userId).order('created_at', { ascending: false }).limit(50)` |
| Fields shown | — | `receipt_number`, `order_number`, `tx_no`, `date`, `subtotal`, `delivery_fee`, `discount_amount`, `total`, `promo_code`, `fulfillment_status`, `shipping_address`, `payment_method`, per-item: `product_name`, `unit_price`, `quantity`, `category` |
| Return request history | `return_requests` | `.eq('customer_id', userId).order('created_at', desc)` |
| Browsing history (last 60) | `browsing_history` | `.eq('customer_id', userId).order('viewed_at', desc).limit(60)` |
| Product interests (view counts) | `browsing_history` | `.eq('customer_id', userId).order('view_count', desc).limit(60)` |
| Category interest scores | `browsing_history` | `SUM(view_count) GROUP BY category` — personalization signal |

#### Predictive (Algorithms actively running)

| Algorithm | Location | What it computes |
|---|---|---|
| Co-purchase Apriori | `order.controller.ts` Lines 280–396 | For each item in cart, finds products with lift > 1 and confidence ≥ 30%, served as "You may also like" carousel |
| Category fallback recommendations | `Checkout.tsx` Lines 331–403 | If no Apriori match, fetches products by cart item categories as fallback |

#### Prescriptive (Recommendations generated)

| Trigger | Recommendation Text | Location |
|---|---|---|
| Cart total < `min_order_amount` (₱100 default) | UI blocks checkout: minimum order amount gate enforced | `Checkout.tsx` Line 240 |
| Cart total ≥ `free_delivery_min` (₱500 default) | Delivery fee set to ₱0: `isFreeDelivery = true` | `Checkout.tsx` Lines 235–237 |
| Product in cart → Apriori co-purchase match | Displays "Customers also bought" carousel of lift-ranked products | `Checkout.tsx` Lines 331–403 |
| Order placed | Transactional email: order confirmation with items, total, ETA | `order-service/mailer.service.ts` |
| Order cancelled | Transactional email: cancellation confirmation | `order-service/mailer.service.ts` |
| Return approved/rejected | Status update visible in account → "Refund Requests" tab | `Account.tsx` |

---

### Persona B — Store Admin (Fulfillment Operator)

**Access Control:** JWT token with `{ userId, email, isAdmin: true, staffRole, isOnboarded }`. Enforced via `requireAdmin()` checking `decoded.isAdmin === true`. Admin users live in the `staff` table (separate from `customers`).

**Roles within Admin:** `super_admin`, `admin`, `staff` — differentiated in `staff.role` column. Only one `super_admin` allowed; cannot be created via API.

#### Descriptive (What historical data is shown)

| Dashboard Widget | Source Table | Exact Query |
|---|---|---|
| Total orders (all time) | `online_orders` | `COUNT(*)` — no filter |
| Orders today | `online_orders` | `COUNT(*) WHERE created_at >= today_00:00` |
| Today's revenue | `online_orders` | `SUM(total) WHERE created_at >= today AND fulfillment_status != 'Cancelled'` |
| Processing count | `online_orders` | `COUNT(*) WHERE fulfillment_status = 'Processing'` |
| In Transit count | `online_orders` | `COUNT(*) WHERE fulfillment_status = 'In Transit'` |
| Delivered count | `online_orders` | `COUNT(*) WHERE fulfillment_status = 'Delivered'` |
| Cancelled count | `online_orders` | `COUNT(*) WHERE fulfillment_status = 'Cancelled'` |
| Pending returns | `return_requests` | `COUNT(*) WHERE status = 'pending'` |
| All orders list (paginated) | `online_orders` + `online_order_items` | `.order('created_at', desc).range(offset, offset+limit)` with optional status/search filter |
| Return requests (paginated) | `return_requests` | `.order('created_at', desc)` with optional status filter |
| Total customers | `customers` | `COUNT(*)` |
| New customers today | `customers` | `COUNT(*) WHERE created_at >= today_00:00` |
| Top search queries (7-day) | `search_analytics` | `SELECT query WHERE searched_at >= NOW()-7d` → count per query |
| Most viewed products | `browsing_history` | `SUM(view_count) GROUP BY product_id` → sort DESC |
| Revenue/Orders time series | `online_orders` (500 rows, in-memory) | `buildDaily()` / `buildMonthly()` / `buildOverall()` / `buildCompare()` |
| Orders by status (pie) | `online_orders` (500 rows, in-memory) | `COUNT GROUP BY fulfillment_status` |
| Payment methods (pie) | `online_orders` (500 rows, in-memory) | `COUNT GROUP BY payment_method` |
| Top products by units | `online_order_items` (via 500 orders) | `SUM(quantity) GROUP BY product_name` → top 7 |
| Revenue by category | `online_order_items` (via 500 orders) | `SUM(price × quantity) GROUP BY category` → top 6 |
| Market basket analysis | `online_order_items` (via 500 orders) | Full Apriori with support, confidence, lift, leverage, conviction → top 8 pairs |
| Fulfillment rate % | `online_orders` (500 rows) | `COUNT(Delivered) / COUNT(all) × 100` |
| Return requests by status | `return_requests` (200 rows) | `COUNT GROUP BY status` |
| Audit logs | `audit_logs` | Paginated, filterable by category, date, search. 30-day category counts included |

#### Predictive (Algorithms actively running)

| Algorithm | Input | Output |
|---|---|---|
| Market Basket Analysis (Apriori, client-side) | `online_order_items` from 500 loaded orders | Frequent itemsets → association rules. Confidence and lift scores per product pair |
| Lift binning | `lift` value per pair | Strength label: Very Strong / Strong / Moderate |

**No time-series forecasting, queue breach detection, or demand surge algorithms are active.**

#### Prescriptive (Actions generated)

| Trigger | Prescribed Action | Implementation |
|---|---|---|
| `pendingOrders + pendingReturns > 0` | Amber attention banner: *"X pending orders and Y return requests need your attention."* with "Review →" link | `admin/page.tsx` Line 534–546 |
| Admin updates order status | `PATCH /orders/admin/status` → `fulfillment_status` updated in `online_orders` | `order.service.ts` Lines 71–88 |
| Admin approves/rejects return | `PATCH /orders/admin/returns/:id` → `status` updated in `return_requests` | `order.controller.ts` Lines 240–278 |
| Market basket pair — lift ≥ 3 | Badge: `"Very Strong"` — implies bundle/promotion opportunity | `admin/page.tsx` Lines 900–903 |
| Market basket pair — lift 2–3 | Badge: `"Strong"` — implies cross-sell potential | `admin/page.tsx` Lines 901–902 |

**No staffing directive, shift reassignment alert, or volume surge warning is generated.**

---

### Persona C — Business Owner (Executive Viewer)

**Access Control:** Same JWT `isAdmin: true` as Store Admin — no separate owner-only role exists in the schema. Role differentiation is `staff.role = 'admin'` vs. `'staff'` vs. `'super_admin'` but the analytics dashboard does not branch on role.

**Note:** `/admin/analytics/page.tsx` is a 10-line redirect stub that routes immediately to `/admin`. There is no dedicated owner analytics page.

#### Descriptive (What is shown — same admin dashboard)

Owners viewing `/admin` see all the same widgets listed under Persona B. Category revenue and top-product charts serve as the primary owner-relevant descriptive layer.

| Owner-Relevant Widget | Computation | Source |
|---|---|---|
| Revenue by Category | `SUM(item.price × item.quantity) GROUP BY category` — filtered to selected date range | `buildCategory()`, `admin/page.tsx` Line 145 |
| Top Products by Units | `SUM(item.quantity) GROUP BY product_name` | `buildTopProducts()`, `admin/page.tsx` Line 139 |
| Overall Revenue Trend | Month-by-month revenue across all time | `buildOverall()`, `admin/page.tsx` Line 104 |
| Year-over-Year Compare | Revenue by month for two selected years | `buildCompare()`, `admin/page.tsx` Line 122 |

#### Predictive — None active for Owner persona

No demand velocity, 14-day surge ratio, or category-level forecasting exists in any backend service or frontend component.

#### Prescriptive — None active for Owner persona

No procurement strategy (Bulk vs. JIT), reorder point recommendation, or stock-out risk alert is generated anywhere in the codebase.

---

## Section 5: Complete Data Flow Diagram (Textual)

```
CUSTOMER ACTION
  └─ Browse product → POST /auth/product-view
       └─ auth-service → RPC increment_product_view()
            └─ browsing_history (upsert, view_count++)

  └─ Search query → POST /analytics/search
       └─ auth-service → INSERT search_analytics + append log file

  └─ Add to cart → cart-service → cart_items (upsert)

  └─ Checkout (COD)
       ├─ Validate promo → promo-service
       ├─ Reserve stock → catalog-service
       ├─ RPC issue_next_receipt_number() → receipts
       ├─ INSERT transactions (cashier_name='Ecommerce')
       ├─ INSERT online_orders
       ├─ INSERT online_order_items
       └─ Clear cart → cart-service

  └─ Checkout (GCash/Maya/Card)
       ├─ Same as COD through online_orders INSERT
       ├─ Create PayMongo checkout session → API Center
       └─ Webhook/poll: payment confirmed →
            UPDATE transactions.status = 'paid'
            UPDATE online_orders.payment_status = 'paid'

ADMIN ACTION
  └─ View Dashboard → GET /orders/admin/stats
       └─ COUNT queries on online_orders (5 parallel)
       └─ COUNT queries on return_requests

  └─ View Analytics Charts → GET /admin/orders?limit=500
       └─ Returns up to 500 online_orders with nested online_order_items
       └─ All chart math runs in browser (React useMemo)

  └─ Update Order Status → PATCH /orders/admin/status
       └─ UPDATE online_orders.fulfillment_status

  └─ View Product Views → GET /auth/admin/analytics/product-views
       └─ SELECT from browsing_history → aggregate in Node.js
```

---

## Section 6: Key Architectural Observations

| # | Observation | Impact |
|---|---|---|
| 1 | All OOS-specific analytics use `online_orders` / `online_order_items` — never raw `transactions` | Channel isolation is structurally guaranteed for current analytics |
| 2 | `cashier_name = 'Ecommerce'` is the only discriminator on the shared `transactions` table | Any future cross-system query against `transactions` must add `WHERE cashier_name = 'Ecommerce'` or `WHERE id IN (SELECT transaction_id FROM online_orders)` |
| 3 | Admin dashboard loads up to 500 orders into browser memory for all chart computations | Chart accuracy degrades silently if total orders exceed 500; no server-side aggregation exists |
| 4 | Apriori runs entirely in the browser for the admin MBA chart | Works correctly for small datasets; will lag with thousands of orders |
| 5 | `/admin/analytics/page.tsx` is a redirect stub | No dedicated owner analytics surface exists — Owner and Admin see identical dashboards |
| 6 | `oos_settings` table drives runtime business rules | `delivery_fee` (₱50), `free_delivery_min` (₱500), `min_order_amount` (₱100), `max_order_items` (20), `order_cutoff_time` (21:00) are all configurable without redeployment |
| 7 | Staff authentication is entirely separate from customer authentication | `staff` table (admin) vs. `customers` table (online shoppers) — never co-mingled in JWT claims |
