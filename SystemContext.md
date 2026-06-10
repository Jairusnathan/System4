npm# Online Ordering System (OOS) - System Context

This document outlines the core architectural components, technologies, interactions, and data models within the OOS codebase. It serves as the foundational context for generating a High-Level Architecture (HLA) diagram or technical design document.

---

## 1. System Overview

The **Online Ordering System (OOS)** — internally referred to as **nexoos / PharmaQuick** — is a cloud-ready, containerized microservices web application enabling customers to browse a product catalog, place online orders, track deliveries, and manage their accounts. It provides a companion admin panel for staff to manage orders, inventory, promotions, customer accounts, and system settings.

The system interfaces with an existing Point-of-Sale (POS) system via a shared Supabase (PostgreSQL) database instance, enabling real-time inventory synchronization between in-store and online channels.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js v16 / React v19 (TypeScript), Tailwind CSS v4, Motion (animations), Recharts (analytics charts), Lucide React (icons) |
| **Backend** | NestJS v11 (TypeScript/Node.js) — one process per microservice |
| **Database** | Supabase (managed PostgreSQL) — 3 separate project instances |
| **Authentication** | JWT (HS256) + bcrypt password hashing; HttpOnly refresh token cookies |
| **Email** | Nodemailer via Gmail SMTP |
| **Payment** | PayMongo (payment gateway integration) |
| **AI/ML** | Google Generative AI SDK (@google/genai) — product recommendations & search |
| **Geo/Location** | ph-locations library — Philippine province/municipality/barangay data |
| **API Analytics** | APICenter SDK (@implementsprint/sdk) — API consumption tracking per service |
| **Containerization** | Docker + Docker Compose |
| **Load Testing** | k6 + InfluxDB + Grafana |
| **Testing** | Jest (unit/integration), Playwright (E2E), Supertest (API) |
| **API Documentation** | Swagger / OpenAPI (@nestjs/swagger) |

---

## 3. High-Level Components (Microservices)

The backend follows an **API Gateway + Microservices** pattern. All frontend traffic is routed through a single gateway which proxies requests to downstream services.

### 3.1. API Gateway (`api-gateway`)

- **Role**: Single entry point for all client requests. Routes `/api/*` traffic to the appropriate downstream service via configured `SERVICE_URL` environment variables. Enforces edge security (Helmet, CORS, rate limiting). Injects `x-correlation-id` for distributed tracing.
- **Port (Dev / Docker)**: `3001` / `4000`
- **Key Config**: `OOS_GATEWAY_ALLOWED_ORIGINS`, per-service URL env vars

### 3.2. Auth Service (`auth-service`)

- **Role**: Manages customer registration/login, staff authentication, JWT issuance/refresh, password reset flows, account lockout (5 failed attempts → 60-min lock), and admin account management. Also owns user analytics (browsing history, category/product interest tracking, search analytics). Persists system-wide configurable settings (`oos_settings` table).
- **Port (Dev / Docker)**: `3002` / `4101`
- **Database**: Primary Supabase instance (customers, staff, refresh_tokens, browsing_history, search_analytics, oos_settings)

### 3.3. Catalog Service (`catalog-service`)

- **Role**: Serves the product catalog with filtering (category, price range, branch, in-stock), full-text search with suggestions, and product recommendations. Reads from the shared POS database, making it the bridge between the OOS and the existing in-store POS system.
- **Port (Dev / Docker)**: `3005` / `4103`
- **Database**: Catalog/POS Supabase instance (products, storebranches, branch_inventory, receipts, transactions)

### 3.4. Cart Service (`cart-service`)

- **Role**: Manages per-user shopping cart state (CRUD). Cart data is persisted in Supabase per authenticated user.
- **Port (Dev / Docker)**: `3004` / `4102`
- **Database**: Cart Supabase instance

### 3.5. Order Service (`order-service`)

- **Role**: Core order lifecycle management — order placement (with idempotency), payment initiation/status via PayMongo, fulfillment status transitions (Processing → In Transit → Delivered → Cancelled), return/refund requests, and admin order management. Sends transactional emails (order confirmation, status updates) via SMTP.
- **Port (Dev / Docker)**: `3003` / `4104`
- **Database**: Order Supabase instance (online_orders, online_order_items, return_requests, receipts, transactions)

### 3.6. Delivery Service (`delivery-service`)

- **Role**: Calculates delivery fee estimates and estimated delivery times based on address and branch location. Exposes Philippine location data (provinces, municipalities, barangays) for address form auto-complete.
- **Port (Dev / Docker)**: `3007` / `4105`
- **Key Dependency**: `ph-locations` library

### 3.7. Promo Service (`promo-service`)

- **Role**: Validates promotional codes at checkout — checks code existence, active status, minimum subtotal requirements, usage limits, and computes the discount amount (fixed or percentage, with max cap).
- **Port (Dev / Docker)**: `3006` / `4106`
- **Database**: Promo Supabase instance

### 3.8. Frontend Client (`nexOOS`)

- **Role**: Customer-facing storefront and admin panel SPA/SSR application. Customer flows: browse catalog, search, view product recommendations, manage cart, checkout (with promo & delivery), track orders, request returns, manage account profile. Admin flows: dashboard, order management, product/branch/inventory management, customer management, staff account management, promo management, audit logs, analytics, system settings.
- **Port (Dev)**: `3000`
- **Key Features**: Google GenAI integration for AI-assisted features, Recharts for analytics dashboards, Playwright E2E test suite

---

## 4. Database Architecture

The system uses **three isolated Supabase (PostgreSQL) instances** to separate concerns and align with service ownership:

### 4.1. Primary (Auth) Supabase

Owned by: Auth Service

| Table | Purpose |
|---|---|
| `customers` | Customer accounts (email, phone, password hash, lockout state) |
| `staff` | Admin/staff accounts (roles: admin, staff; active/onboarded flags) |
| `refresh_tokens` | Hashed refresh tokens for JWT rotation (with expiry) |
| `browsing_history` | Per-customer product view events (product_id, category, view_count) |
| `search_analytics` | Search query logs (query text, source, timestamp) |
| `oos_settings` | Key-value system config (delivery_fee, min_order_amount, oos_enabled, etc.) |
| `branches` | Branch master data (name, address, coordinates, opening/closing hours) |

### 4.2. Catalog / POS Supabase

Owned by: Catalog Service (read-only bridge to POS system)

| Table | Purpose |
|---|---|
| `products` | Product catalog (id, name, description, category, price, image_url, sku) |
| `storebranches` | Branch data replicated from POS |
| `branch_inventory` | Per-branch stock levels (quantity_on_hand, quantity_reserved) |
| `receipts` | Historical POS receipts (used for order-receipt linking) |
| `transactions` | POS payment transactions |

### 4.3. Order Supabase

Owned by: Order Service

| Table | Purpose |
|---|---|
| `online_orders` | Master order record (customer, branch, totals, payment & fulfillment status, delivery method) |
| `online_order_items` | Line items per order (product_id, name, category, unit_price, quantity, line_total) |
| `return_requests` | Return/refund submissions (items JSONB, reason, status workflow) |
| `receipts` | POS receipt references linked to online orders |
| `transactions` | Payment transaction records (PayMongo data) |

---

## 5. Core Business Entities & Relationships

```
Customer ──< OnlineOrder >── Branch
                │
                ├── OnlineOrderItem >── Product (from POS/Catalog DB)
                ├── Payment (PayMongo transaction)
                ├── Promo (optional discount)
                ├── DeliveryInfo (method, address, fee)
                └── ReturnRequest (optional, post-delivery)

Product ──< BranchInventory >── Branch

Staff ──< AuditLog

Cart (per Customer) ──< CartItem >── Product
```

**Order Fulfillment Status Flow:**
```
Processing → In Transit → Delivered
     └──────────────────────→ Cancelled
```

**Return Request Status Flow:**
```
pending → reviewing → approved → completed
                   └──→ rejected
```

**Payment Status Values:** `pending` | `paid` | `failed` | `refunded` | `partially_refunded`

**Delivery Methods:** `claim_at_branch` | `same_day` | `scheduled`

---

## 6. API Surface (via Gateway)

All routes are prefixed with `/api` and served through the API Gateway at port `3001`.

| Domain | Route Prefix | Key Operations |
|---|---|---|
| **Auth** | `/api/auth` | login, register, refresh, logout, update-profile, password-reset, browsing-history, category/product interests |
| **Products** | `/api/products` | list (with filters), search, suggestions, recommendations |
| **Cart** | `/api/cart` | get cart, update cart |
| **Orders** | `/api/orders` | place order, my orders, track by receipt, cancel, return request |
| **Payment** | `/api/orders/payment` | initiate, status check, cancel |
| **Branches** | `/api/branches` | list branches, get branch inventory |
| **Delivery** | `/api/delivery` | estimate fee/time, locations data |
| **Promos** | `/api/promos` | validate promo code |
| **Admin — Auth** | `/api/auth/admin` | profile, customers, staff accounts, audit logs, settings, analytics |
| **Admin — Orders** | `/api/orders/admin` | all orders, update status, stats, return requests |

**Security on API endpoints:**
- Public: `/auth/login`, `/auth/register`, `/auth/public/settings`, `/products`, `/branches`, `/delivery/locations`
- JWT-protected: All other customer endpoints (`Authorization: Bearer <token>`)
- Staff/Admin-only: All `/admin/*` routes (validated via `staffRole` JWT claim)

---

## 7. Communication Patterns

- **Synchronous REST/HTTP**: All inter-service communication is synchronous HTTP. The frontend calls the API Gateway; the gateway proxies to individual services using configured `SERVICE_URL` env vars. No message broker or event bus is in use.
- **Idempotency**: Order placement (`POST /orders/place`) supports an `idempotency-key` header with a 10-minute TTL cache to prevent duplicate orders on network retries.
- **Correlation IDs**: `x-correlation-id` header is propagated through the gateway for distributed request tracing.
- **Email Notifications**: Triggered synchronously from Order Service on order confirmation and status changes via Gmail SMTP (Nodemailer).
- **Payment Webhooks**: PayMongo communicates payment status changes back to the Order Service (redirect URL-based flow using `OOS_ORDER_APP_BASE_URL`).

---

## 8. Security Model

| Concern | Implementation |
|---|---|
| **Transport** | HTTPS in production; Helmet.js HTTP security headers |
| **Authentication** | JWT (HS256), shared secret across auth/order/cart services |
| **Token Storage** | Access token in-memory (Authorization header); refresh token in HttpOnly cookie |
| **Password Storage** | bcrypt (10 rounds) |
| **Brute Force Protection** | Account lockout after 5 failed login attempts (60-min lock) for both customers and staff |
| **CORS** | Configured at gateway level via `OOS_GATEWAY_ALLOWED_ORIGINS` |
| **Authorization** | Role-based via JWT claims (`staffRole`) for admin endpoints |
| **Audit Trail** | All admin actions logged to `audit_logs` table with action, category, timestamp, and details JSONB |
| **Secrets Management** | Per-service `.env` files; pre-commit hooks block `.env` file commits |

---

## 9. External Integrations

| Integration | Purpose | Used By |
|---|---|---|
| **Supabase** | Managed PostgreSQL + Auth (3 instances) | All backend services |
| **PayMongo** | Online payment gateway (card, e-wallet) | Order Service |
| **Gmail SMTP** | Transactional emails (confirmation, reset, status updates) | Auth Service, Order Service |
| **Google Generative AI** | AI-powered product recommendations, search, possibly chatbot | Frontend |
| **APICenter SDK** | API usage analytics and tracking | All backend services |
| **ph-locations** | Philippine address data (province/municipality/barangay hierarchy) | Delivery Service |
| **POS System** | Shared catalog/POS Supabase DB for real-time inventory sync | Catalog Service |

---

## 10. Infrastructure & Deployment

- **Local Development**: Each service runs independently on assigned dev ports (3000–3007). A root-level `package.json` workspace manages the monorepo with shared scripts.
- **Containerized Deployment**: `docker-compose.yml` (in `greenovate-be/`) orchestrates all 8 backend services plus InfluxDB and Grafana for observability.
- **Port Mapping (Dev → Docker)**:

| Service | Dev Port | Docker Port |
|---|---|---|
| Next.js Frontend | 3000 | 3000 |
| API Gateway | 3001 | 4000 |
| Auth Service | 3002 | 4101 |
| Cart Service | 3004 | 4102 |
| Catalog Service | 3005 | 4103 |
| Order Service | 3003 | 4104 |
| Delivery Service | 3007 | 4105 |
| Promo Service | 3006 | 4106 |
| InfluxDB | 8086 | 8086 |
| Grafana | — | 3000 (internal) |

- **Observability**: k6 load testing scripts feed metrics into InfluxDB, visualized via Grafana dashboards.
- **CI/CD**: GitHub Actions workflows detected (`.github/workflows/`).

---

## 11. Configurable Business Rules (via `oos_settings`)

These values are runtime-configurable by admins through the settings panel without code changes:

| Setting Key | Description | Default |
|---|---|---|
| `delivery_fee` | Standard delivery fee | ₱50 |
| `free_delivery_min` | Subtotal threshold for free delivery | ₱500 |
| `min_order_amount` | Minimum order subtotal | ₱100 |
| `max_order_items` | Maximum distinct items per order | 20 |
| `oos_enabled` | Toggle to enable/disable the entire OOS | true |
| `order_cutoff_time` | Last time of day orders are accepted | configurable |
| `contact_email` | Support email displayed to customers | configurable |
| `contact_phone` | Support phone displayed to customers | configurable |

---

## 12. Key Design Decisions

1. **Three Supabase Instances**: Auth, Catalog (shared with POS), and Orders are isolated into separate database projects — preventing cross-domain queries but enabling independent scaling and clear ownership.
2. **Synchronous-Only Communication**: No message broker (no Kafka/RabbitMQ). All service-to-service calls are synchronous HTTP, simplifying the architecture at the cost of tighter coupling and no event-driven decoupling.
3. **POS Integration via Shared DB**: The Catalog Service reads directly from the POS system's Supabase instance, enabling real-time inventory visibility without building a sync pipeline.
4. **Idempotent Order Placement**: Order creation uses a client-supplied `idempotency-key` with a server-side cache (10-min TTL) to safely handle network retries.
5. **Stateless Services**: All services are stateless (JWT auth, no server-side sessions), enabling horizontal scaling behind a load balancer.
6. **AI-Augmented Frontend**: Google GenAI is integrated directly in the Next.js frontend for features like product recommendations and possibly conversational search, keeping AI logic client-side / edge.
