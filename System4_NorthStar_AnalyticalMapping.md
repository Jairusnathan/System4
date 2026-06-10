# System 4 (OOS) — North Star Analytical Model Mapping

> **System:** System 4 — Online Ordering System (NexOOS)
> **Document Date:** 2026-05-20
> **Pipeline Model:** Descriptive → Feature Engineering 1 → Predictive → Feature Engineering 2 → Prescriptive

---

## North Star Question

> **"How can we optimize the online ordering experience by streamlining fulfillment, maximizing high-ticket cart conversions, and ensuring top-selling products are always in stock?"**

### North Star Alignment Assessment: ✅ CONFIRMED — No Change Required

The provided North Star question directly maps to all three analytical rows in the pipeline diagram:

| North Star Component | Analytical Row | Persona |
|---|---|---|
| "Streamlining fulfillment" | Fulfillment Queue → Staffing Matrix | Store Admin |
| "Maximizing high-ticket cart conversions" | Cart Value → Shipping Tier Prescription | Online Customer |
| "Ensuring top-selling products are always in stock" | Category Velocity → Procurement Strategy | Business Owner |

---

## Analytical Model Mapping

### Row 1 — Online Customer: High-Ticket Cart Conversion

| Stage | Label | Question / Computation |
|---|---|---|
| **DESCRIPTIVE** | Online Customer | What is the current online cart value compared to the store's global average order value? |
| **FEATURE ENG 1** | Cart Profiling | Calculate Global Average Order Value & Cart Difference |
| **PREDICTIVE** | — | Which high-value transactions require expedited shipping to guarantee secure delivery? |
| **FEATURE ENG 2** | Shipping Logic | Assess Cart Value vs 2× Global Average Threshold |
| **PRESCRIPTIVE** | — | Which specific shipping tier should be recommended to the customer to guarantee fulfillment speed for high-ticket transactions? |

**Formula:**
```
globalAOV        = AVG(total) FROM online_orders WHERE fulfillment_status != 'Cancelled'
cartDifference   = cartTotal - globalAOV
IF cartTotal > 2 × globalAOV
  → flag: HIGH_VALUE_CART
  → prescribe: "Your order qualifies for Priority Shipping. Select [expedited_tier] to guarantee on-time delivery."
```

---

### Row 2 — Store Admin: Fulfillment Queue & Staffing

| Stage | Label | Question / Computation |
|---|---|---|
| **DESCRIPTIVE** | Store Admin | How many pending online orders are currently sitting in the fulfillment queue? |
| **FEATURE ENG 1** | Volume Tracking | Compute Recent Daily Volume vs Historical Average |
| **PREDICTIVE** | — | When will the current pending queue breach acceptable turnaround times? |
| **FEATURE ENG 2** | Staffing Matrix | Evaluate Queue Volume (>30) or Velocity Surge (>1.5×) |
| **PRESCRIPTIVE** | — | Which operational shift should be implemented to clear the current pending queue before the next predicted volume surge? |

**Formula:**
```sql
-- 14-day daily volume baseline
SELECT DATE(created_at) AS day, COUNT(*) AS daily_count
FROM public.online_orders
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND fulfillment_status != 'Cancelled'
GROUP BY day;

velocitySurge = todayOrders / AVG(daily_count over 14 days)

IF currentQueue > 30 OR velocitySurge > 1.5
  → ALERT: "Surge detected. Recommend reassigning [N] staff from [department] to fulfillment."
```

---

### Row 3 — Business Owner: Category Demand & Procurement

| Stage | Label | Question / Computation |
|---|---|---|
| **DESCRIPTIVE** | Business Owner | Which product categories are driving the most revenue to ensure the store never runs out of stock? |
| **FEATURE ENG 1** | Velocity Calculation | Calculate Baseline Daily Velocity & 14-Day Demand Surge |
| **PREDICTIVE** | — | What is the predicted demand velocity for top-selling product categories? |
| **FEATURE ENG 2** | Procurement Logic | Cross-Reference Historical Revenue vs Active Sales Velocity |
| **PRESCRIPTIVE** | — | What specific procurement strategy (Bulk vs Standard vs Just-In-Time) must be executed for top-selling categories? |

**Formula:**
```
surge_7d    = SUM(units) FROM online_order_items — last 7 days, by category
baseline_7d = SUM(units) FROM online_order_items — prior 7 days, by category
surgeRatio  = surge_7d / MAX(baseline_7d, 1)

IF surgeRatio > 1.5  → "BULK ORDER — High velocity (+50%). Pre-order stock immediately."
IF surgeRatio > 1.0  → "MONITOR — Moderate demand increase. Review reorder points."
ELSE                 → "JIT — Demand stable or declining. Maintain Just-in-Time restocking."
```

---

## Loyalty Automation & Feedback Loop

| Component | Description |
|---|---|
| **Action Execution** | Automatically triggers API alerts (low-stock notifications, dynamic shipping tier updates, and staff reassignment pings) to the POS and Online portals |
| **Outcome Tracking** | Measures if prescribed actions successfully improved the North Star metrics (e.g., Did the expedited shipping upsell convert? Did the reorder prevent a stockout?) |
| **Continuous Learning** | Feeds success/failure data back into the Shared Database to continuously refine and improve Predictive algorithms |

---

## Dashboard Gap Analysis

### Current Implementation Status

| Row | Descriptive | Feature Eng 1 | Predictive | Feature Eng 2 | Prescriptive |
|---|---|---|---|---|---|
| Online Customer — Cart Tier | ⚠️ Partial | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing |
| Store Admin — Fulfillment Queue | ✅ Present | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing |
| Business Owner — Category Revenue | ✅ Present | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing |

### What IS Working

| Feature | Location | Notes |
|---|---|---|
| Admin KPI dashboard (order counts, revenue, status) | `admin/page.tsx` | Descriptive layer — online-only via `online_orders` table |
| Market Basket Analysis (Apriori) | `admin/page.tsx:151–309` | Full implementation with support, confidence, lift, conviction |
| Delivery fee & ETA calculation | `Checkout.tsx:465–543` | Real-time per shipping method — works today |
| Promo code validation against subtotal threshold | `Checkout.tsx:545–605` | Working prescriptive gate for the customer tier |
| Co-purchase "also bought" carousel | `order.controller.ts:280–396` | Apriori-based upsell at checkout |
| Category revenue breakdown | `admin/page.tsx:145–149` | Static aggregation — descriptive only, no velocity |

### What Is Missing

| # | Missing Item | Persona | Pipeline Stage | File to Change |
|---|---|---|---|---|
| 1 | Global AOV fetch + cart-vs-AOV comparison | Customer | FE 1 | `order.service.ts`, `Checkout.tsx` |
| 2 | 2× AOV threshold check + HIGH_VALUE_CART flag | Customer | Predictive / FE 2 | `Checkout.tsx` |
| 3 | Expedited shipping recommendation UI prompt | Customer | Prescriptive | `Checkout.tsx` |
| 4 | 14-day rolling daily order volume time-series | Admin | FE 1 | `order.service.ts` |
| 5 | Velocity surge ratio (today / 14-day avg) | Admin | FE 1 | `order.service.ts` |
| 6 | Queue breach threshold logic (>30 orders or >1.5×) | Admin | Predictive / FE 2 | `order.service.ts` |
| 7 | Staffing alert card with shift reassignment directive | Admin | Prescriptive | `admin/page.tsx` |
| 8 | Category-level 14-day demand surge (week-over-week) | Owner | FE 1 | `admin/page.tsx` |
| 9 | Active sales velocity per category | Owner | FE 2 | `admin/page.tsx` |
| 10 | Bulk vs JIT procurement recommendation card | Owner | Prescriptive | `admin/page.tsx` |
| 11 | Dedicated owner analytics page (currently a redirect stub) | Owner | All tiers | `admin/analytics/page.tsx` |

---

## Remediation Priority

| Priority | Task | Effort |
|---|---|---|
| P1 | Add `sales_channel` column to `public.transactions` to formalize channel isolation | Low (schema + 2 inserts) |
| P2 | Customer: `getGlobalAOV()` endpoint + cart comparison + shipping prompt in `Checkout.tsx` | Medium |
| P3 | Admin: 14-day velocity surge endpoint + Staffing Alert card in `admin/page.tsx` | Medium |
| P4 | Owner: Extend `buildCategory()` with 14-day windows + Procurement Strategy table | Medium |
| P5 | Replace analytics redirect stub with a full Procurement Analytics page | High |

---

## Does the Dashboard Currently Answer the North Star Question?

> **Answer: NO — Partially.**

The dashboard answers **"which products/categories sell the most"** (descriptive) and **"how many pending orders exist"** (descriptive), but it does **not yet**:
- Identify which carts are high-ticket and prescribe an expedited shipping upgrade
- Predict when the fulfillment queue will breach turnaround SLAs
- Compute demand velocity surges per category or prescribe a Bulk vs JIT procurement decision

The North Star question itself is **appropriate and does not need to change.** The gap is entirely in the Predictive and Prescriptive layers of the implementation, which are defined in the pipeline diagram but have zero code counterparts in the current codebase.
