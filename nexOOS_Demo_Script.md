# nexOOS — System Demo Script
**Presenters:** Justyn Iglesias & Jairus Valenton

---

## 🟢 INTRO — JUSTYN IGLESIAS (Introduction & Admin Portal) · 1~2 minutes

"Good day, everyone. I'm Justyn Iglesias. Before Jairus walks you through the customer experience, let me set the stage for why we built this."

"Here's the reality most retail pharmacies face today: they have a physical store running on a POS system, and then they have some kind of online presence — whether that's a Facebook page, a Shopee listing, or a basic website. The problem? Those two channels don't talk to each other. A customer orders online, the item gets sold in-store ten minutes earlier, and now you have a double-sold item, a broken promise, and an angry customer."

"That's the problem nexOOS was built to solve."

"nexOOS is a full-stack, cloud-ready Online Ordering System purpose-built for Philippine retail pharmacies. It's not just an online storefront — it's a unified operations platform that bridges your physical POS and your digital channel in real-time, while giving management a live view of demand, inventory, procurement, and customer behavior — all from one dashboard."

"Here's how it's built: the customer storefront runs on Next.js and React, backed by seven independent NestJS microservices sitting behind an API Gateway. We use three isolated Supabase PostgreSQL instances — one for authentication, one for the order pipeline, and one that is shared directly with the physical POS. That shared database is the key to everything. When an in-store cashier sells a box of Biogesic, the online storefront reflects that stock decrement instantly. No sync delay. No double-selling."

"We also integrate Google Generative AI for intelligent search, PayMongo for full payment processing — GCash, Maya, GrabPay, cards — and a Nodemailer email pipeline that automatically sends order confirmations, status updates, and return notifications."

"Today, Jairus will walk you through the full customer journey — from browsing to checkout. Then I'll take you inside the Admin Control Panel to show you how this system turns raw transaction data into procurement decisions and operational intelligence. Let's begin."

---

## 🔵 SPEAKER 1 — JAIRUS VALENTON (Customer Storefront) · ~4 minutes

### Opening (15 sec)
"Thank you, Justyn. I'm Jairus, and I'm going to walk you through what your customer actually experiences — from the moment they land on the storefront to the moment their order is confirmed."

### 1. Homepage & Branch-Aware Inventory (40 sec)
"In traditional online pharmacies, inventory is usually one number — a global count that doesn't tell you which branch actually has stock. A customer orders, and only after the fact does someone realize the nearest branch is out. That's a fulfillment failure built into the system."

"nexOOS solves this from the first page. The storefront shows product cards with per-branch stock visibility. A customer can see, in real time, which branch has how many units available — and that number comes directly from the shared POS database. When a cashier sells a unit in-store, this number goes down immediately."

*(Browse homepage → open a product card → point to per-branch inventory counter)*

"That's not a cached number. That's a live read from the same database your cashier is ringing up sales on right now."

### 2. AI-Powered Search (35 sec)
"Here's one we're proud of. Most e-commerce search returns zero results the moment a customer makes a typo. Type 'biogesig' instead of 'biogesic' — nothing. Lost sale."

"Our search is powered by Google Generative AI. Let me type a misspelled query."

*(Type a misspelled product name in search bar)*

"The system corrects the intent, not just the spelling. It understands what the customer is trying to find and surfaces the right products. And as they type, it generates instant suggestions. Customers find what they need faster — fewer abandonments, more conversions."

### 3. Cart — Frequently Bought Together (30 sec)
"Once a customer adds a product to their cart, the system doesn't just sit there. It runs our Apriori market basket analysis against historical order data and surfaces a 'Frequently Bought Together' carousel — real co-purchase rules, not manually curated bundles."

*(Add a product to cart → show 'Frequently Bought Together' section)*

"If 80% of customers who buy paracetamol also buy a fever patch, the system shows that combination automatically. This drives average basket size without any manual merchandising effort from the admin."

### 4. Intelligent Checkout (50 sec)
"Checkout is where most online stores lose customers. Long address forms, surprise delivery fees, no promo code support. We rebuilt it with four specific friction-reducers."

"First — Philippine address autocomplete. Instead of typing a full address manually, the customer selects their province, then municipality, then barangay from a live hierarchy. The system uses the ph-locations library and Google Maps geocoding to populate this instantly."

*(Walk through address selection)*

"Second — dynamic delivery fee. As soon as the delivery address is set, the system calculates the applicable fee and shows it before the customer commits. The current delivery fee is configurable by admin — no code change needed."

"Third — promo code validation. Enter a code, and the system checks it against the promotions table in real time — discount type, minimum subtotal, usage limits — all enforced server-side."

*(Apply a promo code)*

"Fourth — high-value cart detection. If the order subtotal crosses a threshold, the system automatically recommends Priority Shipping. No manual upsell needed."

### 5. Payment & Order Confirmation (30 sec)
"At checkout, the customer selects their payment method — we support GCash, Maya, GrabPay, credit and debit cards, and QR PH — all through PayMongo. The Order Service initiates a secure checkout session, PayMongo handles the payment, and the webhook returns confirmation back to our system."

*(Select GCash → show payment flow)*

"On success, two things happen: the customer gets a real-time order confirmation email with their receipt number and tracking info, and the admin dashboard updates immediately."

### Transition (10 sec)
"That's the full customer journey — intelligent, frictionless, and fully tracked. Now, what does the admin see on the other side of that transaction? Justyn?"

---

## 🟢 SPEAKER 2 — JUSTYN IGLESIAS (Admin Control Panel) · ~3 minutes

### Opening (10 sec)
"Thanks, Jairus. Everything he just showed you — every search, every cart add, every order — generates data. I'm going to show you what we do with it."

### 1. Live Dashboard — Operational Intelligence (40 sec)
"The moment I open the admin panel, I see today's numbers: revenue so far, pending orders waiting for fulfillment, and a status breakdown — how many orders are processing, in transit, delivered, or cancelled."

*(Open admin dashboard → point to KPI cards)*

"Below that, I have a time-series revenue chart and an order volume trend — not a report I have to generate, just a live view of how today is tracking against the pattern. If sales are unusually slow by noon, I see it here, not at end of day when it's too late to act."

### 2. Order Fulfillment & Return Management (30 sec)
"Order Management lets me see every placed order — filterable by status, date, or customer. I update fulfillment status here: Processing to In Transit to Delivered. When a status changes, the customer automatically receives an email notification. No manual follow-up."

*(Open Orders → update a status → point to email trigger)*

"Return requests come in the same panel. I can approve or reject the return, and if approved, a refund is triggered back through PayMongo. End-to-end return integrity — no manual tracking, no sticky notes."

### 3. Market Basket Analysis (35 sec)
"This is one of the features I want to highlight specifically, because most small businesses have this data but never use it. The analytics page runs Apriori association rule mining on our historical order data."

*(Open Analytics → show Market Basket table)*

"What this table tells me is: customers who buy Product A buy Product B together with X% confidence and Y times the expected probability — that's the lift metric. This is the same algorithm used by large-scale e-commerce platforms. We built it natively into the admin so that bundling decisions, cross-selling promotions, and layout choices are driven by actual purchase patterns — not gut feel."

### 4. Category Demand Velocity & Procurement Prescriptions (40 sec)
"Here's the operational insight that separates this from a basic dashboard. The Demand Velocity table shows weekly sales velocity per product category — and compares it against the 14-day rolling average."

*(Open Analytics → Category Demand Velocity table)*

"When velocity surges more than 50% above baseline, the system flags that category as BULK PROCUREMENT — buy in bulk now, secure volume discounts, prevent a stockout during high demand. When demand is stable or declining, it flags JUST-IN-TIME — keep capital liquid, order small and frequently. A business owner can look at this table and immediately know how to deploy their purchasing budget this week. No spreadsheet, no analyst, no guesswork."

### 5. Zero-Code System Configuration (25 sec)
"Last thing I want to show: the Settings panel. Every business rule that would normally require a developer — delivery fee, minimum order amount, free delivery threshold, order cutoff time — is configurable right here by any admin user."

*(Open Settings → change delivery fee → save)*

"That change goes live immediately. No code deployment. No Slack message to a developer. The business stays in control of its own rules."

### Final Close (25 sec)
"Let me close with the architecture that makes this possible in production:"

"Inventory sync — shared POS Supabase instance means zero lag between in-store and online stock. Authentication — JWT-based with brute-force lockout after five failed attempts. Payments — PayMongo covering the full Philippine digital payment landscape. Analytics — Apriori market basket analysis and demand velocity running on real transaction data. And audit logging — every admin action is timestamped and recorded for compliance."

"nexOOS is not an online store bolted onto a pharmacy. It's a unified retail operations engine where every sale — physical or digital — flows into the same data model, and every business decision is backed by the data those sales generate."

"Thank you."

---

*Demo flow: Customer Storefront → Admin Dashboard → Analytics → Settings*
*Estimated total runtime: ~10 minutes*
