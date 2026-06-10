# nexOOS (System 4) Conversational Live Demo Script
## Tag-Team Presentation Guide: Justyn Iglesias & Jairus Valenton
**Duration:** ~10-12 Minutes | **System Name:** nexOOS / PharmaQuick (OOS System 4)

---

> [!IMPORTANT]
> **Presentation Layout:**
> * **Left Side of Screen:** Customer Storefront & Cashier/Admin portals (`http://localhost:3000`).
> * **Right Side of Screen:** Interactive terminal log, DB visualizer, or Swagger API gateway docs (`http://localhost:3001/api`).
>
> **Role Division:**
> * **Justyn Iglesias (Business, UX & Operations Specialist):** Drives the user experience, cashier portal, supervisor dashboard, admin role management, and business logic overrides.
> * **Jairus Valenton (Technical, Architecture & Analytics Specialist):** Operates the mouse/keyboard during Justyn's sections, and walks through NestJS microservices, shared Supabase database schemas, Apriori algorithms, and the AWS/Kafka ETL pipeline.

---

## 🎭 Live Tag-Team Demo Script

### 🟢 PART 1: THE HOOK & SYSTEM OVERVIEW (Justyn & Jairus)
* **On-Screen:** *The storefront homepage is open on the left. The NestJS API Gateway terminal is open on the right.*

**Justyn Iglesias:**
> "Good day, everyone! I'm **Justyn Iglesias**, the Business and Operations Lead for Squad 1. 
> 
> Let's look at the reality of traditional small-to-midsize pharmacy operations today: they are plagued by manual paper logbooks, standalone offline cash registers, and disconnected spreadsheets. Sales are audited only at the end of the day—if at all. In-store inventory is a guessing game until someone physically counts the shelves. And online? It’s completely disconnected, leading to double-selling stock they don't even have."
> 
> *That is the exact problem we set out to solve.*
> 
> Today, **Jairus Valenton** and I are proud to present **nexOOS (PharmaQuick)**—a unified pharmacy operations platform. It unifies physical POS inventory, online checkouts, automated staffing logistics, and predictive procurement into one highly audited system."

**Jairus Valenton:**
> "Thanks, Justyn. I'm **Jairus Valenton**, and I'll walk you through the technical backbone of what we built. 
> 
> Under the hood, nexOOS runs a Next.js storefront and admin panel on the frontend. The backend is a decoupled, containerized **NestJS microservices architecture** comprised of 7 independent services—including Auth, Catalog, Cart, Order, Delivery, and Promo. 
> 
> All incoming traffic is routed through a single API Gateway on port `3001` which injects correlation IDs for distributed tracing. 
> 
> We separate concerns by isolating database traffic into **three Supabase projects**:
> 1. Our **Primary Auth/Order DB** (`public.online_orders`, `public.customers`).
> 2. A **POS/Inventory DB** (`public.products`, `public.branch_inventory`), which acts as our live POS integration bridge.
> 3. An isolated **Cart DB** (`public.cart_items`) to keep uncommitted operational writes off our transactional ledgers."

**Justyn Iglesias:**
> "But our real differentiator isn't just the stack—it's how we enforce security and operational integrity through **Role-Based Access Control (RBAC)**. 
> 
> We have designed four distinct portals: Cashier, Supervisor, Manager, and Admin. Each user has unique, token-enforced permissions. Let's start on the front line with the Cashier Portal. Jairus, take it away."

---

### 🟢 PART 2: THE CASHIER FRONT LINE (Justyn & Jairus)
* **On-Screen:** *Storefront login page. Jairus operates the browser on the left.*

**[Live Demo Actions — Jairus]**
* Logs in with Cashier credentials.
* Clicks the profile pill -> Shows the **Clock In** button.
* Points to the active shift timer now ticking on screen.

**Jairus Valenton:**
> "In a typical pharmacy, shift accountability is just a sign-in sheet that gets ignored. If cash goes missing, there is no digital trail. 
> 
> With nexOOS, shift accountability is absolute. The moment a cashier logs in, they must **Clock In** to begin a tracked shift timer in our `public.staff` database table. 
> 
> Every single event—from adding items to processing a discount—is linked to this cashier and this shift. If they step away and forget to sign out, our system automatically locks them out after 15 minutes of inactivity.
> 
> Now, let's process a fast sale."

**[Live Demo Actions — Jairus]**
* Searches for "vitamins" (intentionally misspelled as *"vytamins"*).
* Adds 2 items of a product to the cart.
* Clicks checkout.

**Justyn Iglesias:**
> "Notice the search bar. We integrated **Google's Generative AI SDK** directly into the Catalog Service. 
> 
> Even with typos, the AI detects the correct SKU intent, pulls the real-time stock levels, and generates corrected instant matches.
> 
> Furthermore, the cashier doesn't do mental math. Subtotals, 12% VAT calculations, and promotional discounts are calculated in real-time by the `order-service` DTOs."

**Jairus Valenton:**
> "When the customer pays in Cash, we enter the amount and complete the transaction. In less than 10 milliseconds, the backend executes the database transaction:
> 1. Generates an atomic receipt sequence via `issue_next_receipt_number()` in `public.receipts`.
> 2. Decrements stock levels inside `public.branch_inventory` instantly.
> 3. Enters an audited record in `public.online_orders` with the soft tag `cashier_name = 'Ecommerce'` so in-store sales remain isolated.
> 
> But what if the customer wants to pay using cashless e-wallets?"

**[Live Demo Actions — Jairus]**
* Adds another product. Moves to checkout.
* Selects **GCash/Maya** under payment options.
* Clicks Complete -> Shows the PayMongo checkout redirect page.

**Justyn Iglesias:**
> "We localized payment. By leveraging our private API Center SDK integration (`@implementsprint/sdk`), our `order-service` initiates a secure **PayMongo** session. 
> 
> The customer pays via GCash, Maya, or Credit Card. Upon payment, the PayMongo webhook updates `online_orders.payment_status` to `'paid'` and clears the `cart_items` staging table. 
> 
> No more lost sales because customers aren't carrying cash!"

**Jairus Valenton:**
> "And check out the bottom of the cart. This carousel displays recommended items powered by our backend **Apriori Association Engine**. 
> 
> It analyzes previous order combinations in the `online_order_items` table using data-mined support and lift metrics to recommend items frequently bought together. It's a scientific upsell tool at the point of checkout."

---

### 🔵 PART 3: THE SUPERVISOR COMMAND CENTER (Justyn & Jairus)
* **On-Screen:** *Jairus logs out of Cashier and logs in as a Supervisor.*

**[Live Demo Actions — Jairus]**
* Logs in with Supervisor credentials.
* Points to the sidebar instantly expanding to show *Dashboard, History, Shift Reports,* and *Activity Log*.

**Justyn Iglesias:**
> "Now, watch what happens when we switch to a Supervisor account. 
> 
> The sidebar instantly unlocks administrative capabilities that cashiers cannot access. This isn't just a visual hide-and-seek; our **NestJS RBAC Route Guard** intercepts incoming JWT payloads. Even if a cashier attempts to manually type the admin URL, they are blocked at the gateway level with an 'Access Denied' message."

**[Live Demo Actions — Jairus]**
* Navigates to **Transaction History**.
* Expands a past transaction and clicks the **Partial Refund** button.

**Jairus Valenton:**
> "In traditional pharmacies, refunding is a paper headache. 
> 
> On nexOOS, the supervisor can open transaction history, view the itemized ledger, and execute a **Partial Refund** using `PATCH /orders/admin/returns/:id`. 
> 
> The backend updates `public.return_requests` and triggers PayMongo's refund API upstream, reversing the charges automatically.
> 
> But as a supervisor, you also need to check shift handovers."

**[Live Demo Actions — Jairus]**
* Clicks on the **Activity Log** and **Shift Reports** tabs.

**Justyn Iglesias:**
> "The **Activity Log** captures every single operational state change across all services. 
> 
> We log clock-ins, discounts, voids, and returns to `public.audit_logs`. We can filter this list by staff member, action type, or date range to maintain a strict forensic trail.
> 
> And **Shift Reports** compile all cashier handover logs and cash reconciliation discrepancies. The supervisor has complete operational oversight of the shift in real-time."

---

### 🟣 PART 4: THE LOGISTICS MANAGER & BRANCH TRANSFERS (Jairus & Justyn)
* **On-Screen:** *Supervisor is still open. Jairus logs out and logs in as Manager.*

**[Live Demo Actions — Jairus]**
* Logs in with Manager credentials.
* Navigates to **Inventory** -> **Stock Branch Transfer**.
* Fills out a transfer request: *Source: Makati Branch*, *Destination: Quezon City Branch*, *Qty: 100 Biogesic*.

**Jairus Valenton:**
> "The Manager role inherits all Supervisor capabilities—but adds critical authority over supply chains and logistics. 
> 
> A common nightmare for pharmacies is a stock-out in one branch while another branch has dusty excess. Stock transfers are usually handled via chaotic text messages and paper forms. 
> 
> Our system replaces that with **Stock Branch Transfers**. Managers can select source and destination branches, select products, and submit a formal request. 
> 
> This logs the logistics event in `public.branch_inventory` with zero manual syncs."

**[Live Demo Actions — Jairus]**
* Navigates to **Reports & Analysis**.
* Displays the Recharts charts showing category trends and sales velocity.

**Justyn Iglesias:**
> "But our manager portal doesn't just display static historical graphs. It tells managers what procurement strategy to execute right now using a **14-day Category Demand Velocity model**.
> 
> Under our analytics dashboard, if a category's velocity rises by more than 50% week-over-week, the system flags the category as **BULK ORDER**—prescribing manager action to buy in bulk and grab volume discounts. 
> 
> If the demand velocity is slow or declining, the system flags it as **Just-In-Time (JIT) Procurement**, protecting cash liquidity. We take the guesswork out of ordering."

---

### 🔴 PART 5: THE ADMIN DIRECTORY & DATA LAKE (Justyn & Jairus)
* **On-Screen:** *Jairus logs out and logs in as Admin.*

**[Live Demo Actions — Jairus]**
* Logs in with Admin credentials.
* Clicks the user profile dropdown and selects **Role Management**.

**Justyn Iglesias:**
> "We close with the **Admin Portal**—the command center of the entire system. 
> 
> As an administrator, I have the absolute key to access control: **Role Management**. 
> 
> Here, I can create new users, instantly provisioned via **Supabase Auth** with custom JWT payloads.
> 
> If a Cashier gets promoted to Supervisor, I can update their role right here. The next time they log in, the API Gateway detects their upgraded JWT token, and their sidebar dynamically expands to unlock dashboards, histories, and logs at runtime without a single line of redeployed code!"

**[Live Demo Actions — Jairus]**
* Toggles the active switch of a mock cashier to **Inactive**.

**Jairus Valenton:**
> "And when an employee leaves the company, we don't delete them. We simply toggle their status to **Inactive**. 
> 
> Supabase immediately revokes their session tokens, blocking login access, but their historic transactions, shift handovers, and audit logs remain intact for compliance purposes.
> 
> But let's look at the enterprise data engineering pipeline running behind this entire dashboard."

**[Live Demo Actions — Jairus]**
* Switches tab to open the `ETL_Pipeline_Architecture.md` or a terminal showing the backfill script output.

**Jairus Valenton:**
> "Every time Justyn completed a sale, processed a refund, or deactivated a user, the backend triggered our event pipeline. 
> 
> We used the private API Center SDK to initialize an `ApiCenterService` wrapper. 
> 
> It publishes live transaction events to **Confluent governed Kafka topics** at `tribe.greenovate.events`. 
> 
> The events are batch flushed to our **AWS S3 Bronze Data Lake** at `s3://nexoos-bronze/`. 
> 
> From there, **AWS Glue** transforms raw JSON into Parquet formats (Silver Tier), which we index and query via **AWS Athena** (Gold Tier) to feed our corporate Power BI Dashboard."

**Justyn Iglesias:**
> "Our dashboard's North Star Metric is **Gross Online Revenue & Order Fulfillment Velocity**. 
> 
> It answers the core business question: *How can we maximize gross online revenue, accelerate the checkout conversion funnel, and optimize supply-chain procurement strategies by utilizing real-time product association rules, category demand surges, and fulfillment queue velocity metrics?*
> 
> From cashiers scanning items at the counter, to supervisors monitoring shift logs, to managers transferring stock across branches, and administrators securing access controls—every layer of nexOOS is unified, secured, and built on robust math. 
> 
> We invite you to sit down, test the checkout, play with the settings, and see how nexOOS can scale your business. 
> 
> Thank you very much, and we are now open for any questions!"

---

## 🎙️ Presentation Cue & Tag-Team Rules

* **Visual Teamwork:** When Justyn is speaking, Jairus must actively navigate the screens, hover over key elements (like the Apriori carousel, the PayMongo checkout, and the role management table), and point out the indicators on the screen.
* **The Hand-Off Rule:** Maintain high energy. Keep eye contact with the judges when speaking, and pivot body language toward each other during the verbal hand-offs (e.g., *"...and that's Jairus Valenton,"* or *"...Marius, take it away"*).
* **Technical Pride:** Jairus should sound extremely precise about database tables, ports, DTO validations, and the AWS/Kafka pipeline, while Justyn maintains the executive, operations-focused narrative.
