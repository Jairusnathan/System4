# System 4: Power BI Data Requirements & Pipeline Analysis

Base sa pipeline image at sa microservices architecture (decoupled Supabase databases) ng System 4, narito ang breakdown ng bawat persona mula kaliwa pakanan (Descriptive hanggang Prescriptive), pati na rin ang specific tables sa inyong mga microservices na kailangan mong i-export as CSV papuntang PowerBI.

---

## 1. Online Customer (Cart & Shipping Optimization)

**Pipeline Flow:**
*   **Descriptive:** Ina-assess ang current online cart value kumpara sa global average order value.
*   **Feature Eng 1:** Kinakalkula ang Global Average Order Value at Cart Difference.
*   **Predictive:** Ina-identify kung aling high-value transactions ang kailangan ng expedited shipping.
*   **Feature Eng 2:** Ine-evaluate ang Cart Value kung lampas 2x ng Global Average Threshold.
*   **Prescriptive:** Nire-recommend ang specific shipping tier (expedited vs standard) para sa high-ticket transactions.

**Tables Needed para sa PowerBI (CSV Export):**
*   **`cart_items`** *(from cart-service)*: Para makuha ang mga naka-pending na items sa cart ng mga online customers (`quantity`, `product_id`).
*   **`online_orders`** *(from order-service)*: Ito ang magiging basis ng iyong **Global Average Order Value**. Kailangan mo ang `total`, `subtotal`, `delivery_method`, at `delivery_fee` columns.
*   **`online_order_items`** *(from order-service)*: Para malaman ang breakdown ng prices per item para sa high-value carts.

**PowerBI Guide:**
Gagawa ka ng measure sa PowerBI gamit ang DAX para ma-compute ang `Global Average Order Value = AVERAGE(online_orders[total])`. Tapos, igagawa mo ng column o measure ang mga `cart_items` para i-flag kung ang current cart ba nila ay `> 2 * Global Average Order Value`.

---

## 2. Store Admin (Fulfillment & Staffing Management)

**Pipeline Flow:**
*   **Descriptive:** Binabantayan kung ilang pending orders ang nasa fulfillment queue.
*   **Feature Eng 1:** Kinu-compute ang recent daily volume vs historical average volume.
*   **Predictive:** Pini-predict kung kailan lalagpas sa acceptable turnaround time ang current queue.
*   **Feature Eng 2:** Ine-evaluate ang Queue Volume (kung > 30) o Velocity Surge (kung > 1.5x ng average).
*   **Prescriptive:** Nire-recommend kung anong operational shift (e.g., magdagdag ng tao) ang kailangan para ma-clear ang queue bago ang next volume surge.

**Tables Needed para sa PowerBI (CSV Export):**
*   **`online_orders`** *(from order-service)*: Kailangan mo itong i-filter based sa `fulfillment_status` (e.g., 'Processing'). Importanteng i-extract ang `created_at` at `updated_at` para mabilang ang daily volume.
*   **`order_events`** *(from order-service)*: **Critical Table ito!** Dito nakalagay ang mga `event_type` at `created_at` timestamp ng bawat state ng order. Ito ang gagamitin mo para ma-compute ang **turnaround time** o delay (halimbawa, oras na lumipas mula order placed hanggang fulfilled).

**PowerBI Guide:**
Sa PowerBI, gumawa ng line chart o area chart para ipakita ang Daily Volume (count ng `online_orders` per day). Pwede kang gumawa ng gauge visual para ipakita ang "Current Queue Volume" na mag-rered kung lampas 30 ang naka 'Processing' na status.

---

## 3. Business Owner (Revenue & Procurement Strategy)

**Pipeline Flow:**
*   **Descriptive:** Ina-identify kung anong product categories ang nagdadala ng pinakamalaking revenue.
*   **Feature Eng 1:** Kinakalkula ang baseline daily velocity at 14-day demand surge ng mga products.
*   **Predictive:** Pini-predict ang demand velocity para sa top-selling products.
*   **Feature Eng 2:** Kinu-cross reference ang historical revenue at active sales velocity.
*   **Prescriptive:** Nire-recommend ang specific procurement strategy (Bulk, Standard, o Just-in-Time) para sa mga top-selling categories.

**Tables Needed para sa PowerBI (CSV Export):**
*   **`online_order_items`** *(from order-service)*: Ito ang magiging pangunahing table mo. Kailangan ang `product_name`, `category`, `quantity` (sales velocity), at `line_total` (revenue).
*   **`online_orders`** *(from order-service)*: Para mai-join ang mga items sa `created_at` date at mai-filter lamang ang mga orders na may `payment_status` = 'paid'.

**PowerBI Guide:**
I-plot mo ang sum ng `line_total` at `quantity` at i-group by `category`. Pwede kang gumawa ng DAX measure na nagco-compute ng 14-day moving average (`CALCULATE(SUM(online_order_items[quantity]), DATESINPERIOD(...))`) para ma-identify ang demand surge.

---

## Paano mo ito i-sshowcase sa PowerBI (General Advice):

1. **Export as CSV:** Pumunta sa Supabase Studio (gamit ang URL sa `.env`) ng bawat microservice (order-service, cart-service) at i-export ang mga mentioned tables as CSV.
2. **Data Modeling (PowerBI):** I-import lahat ng CSV sa PowerBI. Gamitin ang `online_orders` bilang central fact table mo. I-link ang `online_order_items` gamit ang `online_order_id` / `id` column.
3. **Dashboards:** Gumawa ng 3 magkahiwalay na Pages/Tabs sa PowerBI (Page 1: Online Customer Metrics, Page 2: Store Admin Queue, Page 3: Business Owner Procurement) para masagot mo ng buo ang buong pipeline ng inyong North Star Question.
