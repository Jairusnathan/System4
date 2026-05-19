# Analytics Pipeline Audit — System 4 (Online Ordering System)
> **Audit Date:** 2026-05-19  
> **Auditor:** Senior Data Engineer Review  
> **Codebase Root:** `c:\Users\user\Downloads\nexoos backup\System4\`  
> **Pipeline Model:** Descriptive ➔ Feature Engineering ➔ Predictive ➔ Feature Engineering 2 ➔ Prescriptive  

---

## Executive Summary

System 4 (NexOOS / Online Ordering System) has a **partially implemented** analytics pipeline. The Descriptive layer is solid — the admin dashboard correctly reads exclusively from `public.online_orders` and `public.online_order_items`, which cleanly isolates online transactions. The Market Basket Analysis (Apriori) algorithm is a genuine data science implementation present in both the backend and frontend. However, the **Predictive and Prescriptive tiers are critically incomplete for all three personas**, and several prescriptive actions defined in the pipeline diagram have **zero code counterparts** in the codebase.

---

## 0. Omnichannel Architecture Rule — Channel Discriminator Audit

> **CRITICAL CHECK:** System 4 shares `public.transactions` and `public.receipts` with System 1 (POS). Every OOS analytical query must discriminate online-only data.

### ✅ PASS — Primary Analytics Tables Are Channel-Isolated

The online ordering system writes to its **own dedicated tables** (`online_orders`, `online_order_items`) rather than querying the shared `public.transactions` table for analytics:

| Layer | Table Used | Channel-Safe? |
|---|---|---|
| Admin Dashboard KPIs (`adminGetStats`) | `online_orders` | ✅ Yes |
| Admin Order Listing (`adminListAllOrders`) | `online_orders` | ✅ Yes |
| Market Basket Analysis (frontend + backend) | `online_order_items` | ✅ Yes |
| Co-purchase Recommendations (Apriori API) | `online_order_items` | ✅ Yes |
| Sold Counts API | `online_order_items` | ✅ Yes |

### ⚠️ PARTIAL — `public.transactions` Writes Lack a Formal `sales_channel` Column

When an online order is placed (`order.service.ts`, lines 333 and 463), a row is inserted into the **shared** `public.transactions` table. The only discriminator used is the implicit `cashier_name = 'Ecommerce'` field:

```typescript
// order.service.ts – Line 333 (COD) and Line 473 (Online Payment)
cashier_name: 'Ecommerce'   // ← soft discriminator, not a dedicated column
```

**Risk:** If any future analytical query is written against `public.transactions` (e.g., for cross-system revenue reporting), it must filter on `cashier_name = 'Ecommerce'` or `WHERE id IN (SELECT transaction_id FROM online_orders)`. There is no formal `sales_channel = 'ONLINE'` column in the transactions table per the migration files, which is a schema-level gap.

**No existing analytics query directly queries `public.transactions` for OOS metrics**, so no current contamination exists — but it is a **latent risk** for future queries.

---

## 1. Persona Alignment Audit

### 1.1 Online Customer Persona ✅ / ⚠️ Partial

**Descriptive Layer (present):**
- `Account.tsx` fetches and displays the customer's full order history via `/api/orders/my-return-requests` and the `AppContext` orders state.
- The customer can see order status (Processing, In Transit, Delivered, Cancelled), receipt number, items, subtotal, delivery fee, and totals.

**Prescriptive Layer for Customer (missing):**
The pipeline diagram specifies that the cart value should be compared against the Global Average Order Value to determine a Shipping Logic Flag and prescribe expedited shipping for high-ticket carts. **This logic does not exist in the codebase.**

```
Pipeline Spec (Customer):
  DESCRIPTIVE: What is the current online cart value vs. global average?
  FE 1: Calculate Global Average Order Value & Cart Difference
  PREDICTIVE: Which high-value transactions require expedited shipping?
  FE 2: Assess Cart Value vs 2x Global Average Threshold
  PRESCRIPTIVE: Which specific shipping tier should be recommended?
```

**Verdict:** The customer persona handles order viewing and placement correctly, but the **analytically-driven delivery SLA risk prediction and expedited shipping prescription are entirely absent.**

---

### 1.2 Store Admin Persona ✅ / ⚠️ Partial

**Descriptive Layer (present):**
- `adminGetStats()` in `order.service.ts` (lines 90–119) correctly retrieves today's order count, total orders, processing/in-transit/delivered/cancelled counts, and today's revenue — all from `online_orders`.
- The admin dashboard (`/admin/page.tsx`) renders KPI cards, revenue/orders time-series charts, status breakdown pie charts, top products, category revenue, market basket analysis, and search analytics.
- The Market Basket Analysis on the admin dashboard (lines 151–309) runs a full client-side Apriori implementation, providing product pairing insights.

**Predictive & Prescriptive Layer for Admin (missing):**
The pipeline diagram specifies volume surge detection:

```
Pipeline Spec (Store Admin):
  DESCRIPTIVE: How many pending online orders are currently in the fulfillment queue?
  FE 1: Compute Recent Daily Online Volume vs 14-Day Historical Average
  PREDICTIVE: When will the current pending queue breach acceptable turnaround times?
  FE 2: Evaluate Queue Volume (>80 or Velocity Surge >1.5x)
  PRESCRIPTIVE: Which operational shift should be implemented to handle the pending volume surge?
```

**What exists instead:** The admin dashboard shows a simple count of `processingOrders` (a static integer from the stats API). There is **no historical daily volume calculation, no 14-day moving average, no queue breach prediction, and no staffing/shift reassignment prescription**.

The `safe('/api/admin/orders?limit=500', token)` call loads up to 500 orders for client-side chart building, but the `buildDaily()` and `buildMonthly()` functions only build revenue/order-count time series for charting — **they do not compute any velocity or surge indicators**.

**Verdict:** Admin descriptive analytics are functional. Predictive velocity analysis and staffing prescriptions are entirely absent.

---

### 1.3 Business Owner Persona ✅ / ⚠️ Partial

**Descriptive Layer (present):**
- `buildCategory()` in `admin/page.tsx` (lines 145–149) groups order items by category and sums revenue — this is a basic descriptive breakdown of which product categories generate the most online revenue.
- `buildTopProducts()` computes top-selling products by unit quantity.

**Predictive & Prescriptive Layer for Business Owner (missing):**
The pipeline diagram specifies:

```
Pipeline Spec (Business Owner):
  DESCRIPTIVE: Which product categories drive the most revenue?
  FE 1: Calculate Baseline Daily Velocity & 14-Day Demand Surge
  PREDICTIVE: What is the predicted demand velocity for top-selling categories?
  FE 2: Cross-reference Revenue vs Historical Revenue, Active Sales Velocity
  PRESCRIPTIVE: What specific procurement strategy (Bulk vs Just-in-Time) must be executed?
```

**What exists instead:** The `buildCategory()` function returns `{ name, revenue }` pairs for the selected date filter — it has no time-series dimension, no 14-day lookback window, no velocity or surge calculation, and no cross-reference against historical baselines. There is no procurement prescription logic anywhere in the codebase.

**Verdict:** The owner persona has a basic descriptive category breakdown. The 14-day demand surge, velocity calculation, and Bulk vs JIT procurement prescriptions are entirely absent.

---

## 2. Feature Engineering & Prescriptive Validation

### 2.1 Customer — Global AOV Comparison & Delivery SLA Prediction

| Step | Expected | Found in Code | Status |
|---|---|---|---|
| FE 1: Calculate Global AOV | `AVG(total) FROM online_orders WHERE NOT cancelled` | Not found anywhere | ❌ MISSING |
| FE 1: Cart Difference | `cartTotal - globalAOV` | Not found anywhere | ❌ MISSING |
| PREDICTIVE: High-value threshold | `IF cartTotal > 2x globalAOV` | Not found anywhere | ❌ MISSING |
| FE 2: Shipping logic flag | Binary classification on cart vs. threshold | Not found anywhere | ❌ MISSING |
| PRESCRIPTIVE: Expedited shipping recommendation | UI prompt suggesting premium shipping tier | Not found anywhere | ❌ MISSING |

The `Checkout.tsx` component computes `effectiveCartTotal` (line 181) as a simple sum — it is used only to display the subtotal and enforce the `MIN_ORDER_AMOUNT` gate. No global average is fetched, no comparison is made, and no SLA-risk flag is raised or displayed to the customer.

**Formula that should exist but does not:**
```
globalAOV = AVG(total) FROM public.online_orders WHERE fulfillment_status != 'Cancelled'
cartDifference = cartTotal - globalAOV
IF cartDifference > globalAOV  -- i.e., cart > 2x average
  → flag as HIGH_VALUE_CART
  → prescribe: "Your order qualifies for Priority Shipping. Add [expedited_option] to guarantee on-time delivery."
```

---

### 2.2 Admin — Daily Volume Velocity & Turnaround Delay Prediction

| Step | Expected | Found in Code | Status |
|---|---|---|---|
| FE 1: Recent daily online volume | Count of orders per day for last N days | Not found | ❌ MISSING |
| FE 1: 14-Day Historical Average | Rolling 14-day mean of daily order counts | Not found | ❌ MISSING |
| FE 1: Volume vs Avg | `dailyOrders / historicalAvg` as velocity ratio | Not found | ❌ MISSING |
| PREDICTIVE: Queue breach threshold | `IF queueVolume > 80 OR velocityRatio > 1.5x` | Not found | ❌ MISSING |
| FE 2: Staffing Matrix | Evaluate breach severity (Critical vs Moderate) | Not found | ❌ MISSING |
| PRESCRIPTIVE: Shift reassignment alert | UI alert prescribing staff action | Not found | ❌ MISSING |

The `adminGetStats()` method returns `processingOrders` (line 103) as a live count, but no rolling window, velocity ratio, or breach threshold comparison is computed. The admin dashboard's "Order Pipeline" cards simply display raw counts with no predictive context.

**Formula that should exist but does not:**
```sql
-- 14-day daily volume baseline
SELECT DATE(created_at) as day, COUNT(*) as daily_count
FROM public.online_orders
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND fulfillment_status != 'Cancelled'
GROUP BY day;

-- Velocity Surge = today's count / AVG(14-day baseline)
velocitySurge = todayOrders / AVG(daily_count over 14 days)

-- Prescription
IF currentQueue > 80 OR velocitySurge > 1.5
  → ALERT: "Surge detected. Recommend reassigning [N] staff from [department] to fulfillment."
```

**Prescriptive UI Gap:** The admin dashboard's attention banner (`needsAttention` on line 518) only flags `pendingOrders + pendingReturns` for order management, with a simple "Review" link. There is **no staffing recommendation panel, no velocity surge indicator, and no shift reassignment directive** anywhere in `admin/page.tsx`.

---

### 2.3 Business Owner — 14-Day Demand Surge & Procurement Strategy

| Step | Expected | Found in Code | Status |
|---|---|---|---|
| FE 1: Baseline Daily Velocity | Daily units sold per category over 14 days | Not found | ❌ MISSING |
| FE 1: 14-Day Demand Surge | Compare current 7-day vs prior 7-day category sales | Not found | ❌ MISSING |
| PREDICTIVE: Demand velocity per category | Top-N category velocity scores | Not found | ❌ MISSING |
| FE 2: Revenue vs Historical Revenue | Cross-reference category revenue against past windows | Not found | ❌ MISSING |
| FE 2: Active Sales Velocity | `units sold this week / baseline rate` | Not found | ❌ MISSING |
| PRESCRIPTIVE: Bulk vs JIT decision | Procurement logic gate per category | Not found | ❌ MISSING |

The `buildCategory()` function (admin/page.tsx, lines 145–149) only aggregates revenue per category for the selected view period. It has no time-window comparison capability. The result is a static bar chart with no velocity signal or procurement prescription attached.

**Formula that should exist but does not:**
```
surge_7d = SUM(units) FROM online_order_items, last 7 days, by category
baseline_7d = SUM(units) FROM online_order_items, prior 7 days, by category
surgeRatio = surge_7d / MAX(baseline_7d, 1)

IF surgeRatio > 1.5:
  procurement = "BULK ORDER — High velocity surge detected (+50%). Pre-order stock immediately."
ELSE IF surgeRatio > 1.0:
  procurement = "MONITOR — Moderate demand increase. Review reorder points."
ELSE:
  procurement = "JIT — Demand stable or declining. Maintain Just-in-Time restocking."
```

---

## 3. Gap Analysis Summary

### 3.1 Missing Formulas / Computations

| # | Missing Formula | Persona | Pipeline Stage |
|---|---|---|---|
| 1 | Global Average Order Value (AOV) from `online_orders` | Customer | FE 1 |
| 2 | Cart vs. AOV difference and 2x threshold check | Customer | FE 2 / Predictive |
| 3 | Daily online order volume time-series (14-day window) | Admin | FE 1 |
| 4 | Velocity surge ratio (`today / 14-day avg`) | Admin | FE 1 |
| 5 | Queue breach threshold logic (>80 orders or >1.5x surge) | Admin | Predictive / FE 2 |
| 6 | Category-level 14-day demand surge (week-over-week) | Owner | FE 1 |
| 7 | Active sales velocity per category | Owner | FE 2 |
| 8 | Bulk vs. JIT procurement decision gate | Owner | Prescriptive |

---

### 3.2 Missing Prescriptive Actions in Frontend

| # | Missing UI Action | Component | Persona |
|---|---|---|---|
| 1 | Expedited shipping recommendation badge/prompt when cart > 2x AOV | `Checkout.tsx` | Customer |
| 2 | Shipping tier upgrade suggestion on order confirmation | `Checkout.tsx` / `Success.tsx` | Customer |
| 3 | Velocity surge alert with staff reassignment directive | `admin/page.tsx` | Admin |
| 4 | Staffing matrix panel (Operational Shift recommendation) | `admin/page.tsx` | Admin |
| 5 | Procurement strategy card (Bulk vs JIT) per top category | `admin/page.tsx` | Business Owner |
| 6 | 14-day demand surge indicator on category analytics charts | `admin/page.tsx` | Business Owner |

The admin analytics page (`/admin/analytics/page.tsx`) is **a redirect stub** (10 lines) that bounces to `/admin`. There is no dedicated owner-level procurement analytics page.

---

### 3.3 Analytical Queries Missing Channel Filter

| # | Query Location | Table Queried | Channel Filter Present? | Risk |
|---|---|---|---|---|
| All admin stats | `order.service.ts:90–119` | `online_orders` | ✅ Inherently filtered (OOS-only table) | None |
| Market basket (frontend) | `admin/page.tsx:252–309` | `online_orders` data (already fetched) | ✅ Inherently filtered | None |
| Co-purchase Apriori (backend) | `order.controller.ts:280–396` | `online_order_items` | ✅ Inherently filtered | None |
| `transactions` table inserts | `order.service.ts:333, 463` | `public.transactions` (shared!) | ⚠️ Only `cashier_name='Ecommerce'` as soft tag | Latent risk |
| Search analytics | `analytics.service.ts` | Log file (not DB) | ✅ N/A | None |
| Product view analytics | `auth-service` (proxied) | `browsing_history` or similar | Not audited (service proxied) | Unknown |

---

## 4. What IS Working (Strengths)

| Feature | Location | Notes |
|---|---|---|
| **Market Basket Analysis (Apriori)** | `admin/page.tsx:151–309` and `order.controller.ts:280–396` | Full implementation with support, confidence, lift, leverage, conviction. Mirrors Python `mlxtend` basis. |
| **Channel isolation via dedicated tables** | `online_orders`, `online_order_items` | All OOS analytics correctly avoid polluting or reading from POS-only data paths. |
| **Admin KPI dashboard** | `admin/page.tsx` | Revenue, order counts, fulfillment rates, return status, search analytics — all online-only. |
| **Delivery estimate integration** | `Checkout.tsx:465–543` | Real-time delivery fee and ETA calculation per shipping method. |
| **Min order / free delivery thresholds** | `Checkout.tsx:234–240` | `MIN_ORDER_AMOUNT` and `free_delivery_min` settings from `useOosSettings` — a prescriptive rule for the customer tier. |
| **Promo code prescriptive gate** | `Checkout.tsx:545–605` | Dynamic validation against subtotal threshold — a working prescriptive recommendation engine. |
| **Co-purchase recommendations** | `order.controller.ts:280–396` + `Checkout.tsx:331–403` | Apriori-based "also bought" carousel in checkout — a form of prescriptive upsell. |

---

## 5. Recommended Remediation Roadmap

### Priority 1 — Add `sales_channel` Column to `public.transactions` (Schema)

Add a proper discriminator to the shared table to eliminate latent risk:
```sql
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS sales_channel TEXT 
  CHECK (sales_channel IN ('POS', 'ONLINE')) DEFAULT 'POS';
```
Update `order.service.ts` inserts to set `sales_channel: 'ONLINE'`.

---

### Priority 2 — Customer: Global AOV Fetch + Cart Comparison (Backend + Checkout UI)

Add endpoint in `order.service.ts`:
```typescript
async getGlobalAOV(): Promise<number> {
  const { data } = await db.from('online_orders')
    .select('total')
    .neq('fulfillment_status', 'Cancelled');
  const totals = (data ?? []).map(r => Number(r.total));
  return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
}
```
In `Checkout.tsx`, fetch the AOV at checkout load, compute `cartDifference = cartTotal - globalAOV`, and display a shipping upgrade prompt when `cartTotal > 2 * globalAOV`.

---

### Priority 3 — Admin: 14-Day Velocity Surge + Staffing Alert

Add to `adminGetStats()` or a new `/orders/admin/velocity` endpoint:
```typescript
// Fetch daily counts for last 14 days
const past14Days = await db.from('online_orders')
  .select('created_at')
  .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
  .neq('fulfillment_status', 'Cancelled');

const dailyCounts = groupByDay(past14Days);
const avg14Day = mean(dailyCounts);
const velocitySurge = (todayOrders / Math.max(avg14Day, 1));
const surgeFlag = currentQueue > 80 || velocitySurge > 1.5;
```
In `admin/page.tsx`, add a **Staffing Alert card** that renders when `surgeFlag === true`, recommending shift reassignment.

---

### Priority 4 — Owner: 14-Day Category Demand Surge + Procurement Card

Extend `buildCategory()` to accept two date windows and compute a `surgeRatio`. Add a new **Procurement Strategy table** in the admin dashboard showing each top category's surge ratio and the corresponding Bulk vs JIT recommendation.

---

### Priority 5 — Dedicated Owner Analytics Page

Replace the redirect stub at `/admin/analytics/page.tsx` with a full procurement analytics page showing the 14-day demand surge visualization, velocity trend lines per category, and a procurement action recommendation panel.

---

*End of Audit Document*
