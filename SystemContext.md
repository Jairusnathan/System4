# PharmaQuick (nexOOS) - System Context

This document outlines the core architectural components, technologies, and interactions within the PharmaQuick codebase (frontend `nexOOS`, backend `greenovate-be`). It is intended as the foundational context for generating a High-Level Architecture (HLA) diagram or technical design document.

## 1. System Overview

PharmaQuick is a containerized, microservices-based e-commerce web application for an online pharmacy with multiple physical branches. It provides:

- A customer-facing storefront (browse catalog, branch-aware inventory, cart, checkout, online payment, order tracking, return requests, account profile, browsing/interest personalization).
- An internal admin console (catalog, branches, customer accounts, staff/role management, orders, returns, audit logs, analytics dashboards, system settings).
- A backend split into focused NestJS microservices fronted by an API Gateway, persisting state in Supabase-managed PostgreSQL, and integrating with an external **API Center** (consumed via `@implementsprint/sdk` / `TribeClient`) for cross-tribe shared services such as payment checkout and email delivery.

## 2. Technology Stack

- **Frontend**:
  - [Next.js 16](nexOOS/package.json) (App Router) / React 19 / TypeScript
  - Tailwind CSS v4, `motion` (Framer Motion successor), Lucide icons
  - Recharts for admin dashboards
  - Google GenAI SDK (`@google/genai`) for select assistive features
  - `nodemailer`, `bcrypt`, `jsonwebtoken` available server-side inside Next route handlers
- **Backend**:
  - NestJS 11 (TypeScript) microservices under [greenovate-be/](greenovate-be/)
  - Per-service `ConfigModule`, `helmet`, `cookie-parser`, CORS enabled at the gateway
  - `axios` and native `fetch` for inter-service HTTP calls
  - `bcrypt` for password hashing, `jsonwebtoken` for access/refresh JWTs
- **Database & Identity**:
  - **Supabase** (managed PostgreSQL) — two Supabase projects are referenced (`SUPABASE_*` and `SECOND_SUPABASE_*`) to split concerns; the service-role key is used server-side only
  - **Custom JWT auth** (not Supabase Auth): credentials are validated against `customers` and `staff` tables; access tokens are returned in the response body and refresh tokens are issued as HTTP-only cookies
- **External Platform (API Center / Tribe SDK)**:
  - `@implementsprint/sdk` (`TribeClient`) used by services to consume shared services through API Center
  - Used today for **payment checkout** (PayMongo-like flow with success/cancel URLs) and **email delivery** (`emailSend`), with a built-in SMTP fallback via `nodemailer`
  - Auth config: `APICENTER_URL`, `APICENTER_TRIBE_ID`, `APICENTER_TRIBE_SECRET` (see [consumer-runbook.md](consumer-runbook.md))
- **Infrastructure**:
  - Docker + Docker Compose orchestration ([greenovate-be/docker-compose.yml](greenovate-be/docker-compose.yml))
  - Per-service Dockerfiles; gateway is the only externally exposed HTTP port
- **Observability & Testing**:
  - Jest (unit/integration) on both frontend and backend, Playwright for frontend E2E
  - **k6** load tests with **InfluxDB 1.8** as the metrics store and **Grafana 10** for dashboards (both wired into `docker-compose.yml`)
  - Standard NestJS logging plus correlation IDs propagated through the gateway

## 3. High-Level Components

### 3.1. Frontend Client - `nexOOS` (Next.js)

- **Role**: Customer storefront and admin console rendered with the Next.js App Router. Provides:
  - Public routes: [Home](nexOOS/src/components/Home.tsx), [Shop](nexOOS/src/components/Shop.tsx), [CartDrawer](nexOOS/src/components/CartDrawer.tsx), [Checkout](nexOOS/src/components/Checkout.tsx), [Login](nexOOS/src/components/Login.tsx), [Register](nexOOS/src/components/Register.tsx), [Account](nexOOS/src/components/Account.tsx), [OrderStatus](nexOOS/src/components/OrderStatus.tsx)
  - Admin routes under [src/app/admin/](nexOOS/src/app/admin/): `accounts`, `analytics`, `audit-logs`, `branches`, `customers`, `emails`, `orders`, `products`, `profile`, `returns`, `settings`
  - Onboarding and payment success/cancel routes
- **State**: A single React `AppContext` ([AppContext.tsx](nexOOS/src/context/AppContext.tsx)) holds view, user, cart, branches, branch inventory, orders, search, and inactivity auto-logout (15-minute timeout) state.
- **Client → Backend transport**:
  - Browser client calls **Next.js route handlers** under [nexOOS/src/app/api/](nexOOS/src/app/api/) (e.g., `/api/auth/login`, `/api/products`, `/api/orders/place`, `/api/admin/customers`).
  - Each route handler forwards to the gateway via [`proxyToBackend`](nexOOS/src/lib/backend-proxy.ts), which copies `authorization`/`cookie` headers, retries transient connection errors, and rewrites `set-cookie` from downstream responses.
  - The browser can also call the gateway directly using `NEXT_PUBLIC_API_BASE_URL` through [`buildApiUrl` / `fetchJson` / `fetchJsonWithRetry`](nexOOS/src/lib/api.ts).
- **Port**: `3000` (Next dev/start)

### 3.2. API Gateway - `api-gateway`

- **Role**: Single externally exposed HTTP entry point (`/api/*`). Holds **no business logic**; each gateway controller is a thin proxy that calls a single downstream service via [`requestDownstream`](greenovate-be/api-gateway/src/shared/http/request-downstream.ts) (native `fetch`, 5s timeout, JSON body, cookie/header passthrough). Applies `helmet`, CORS with credentials, cookie parsing, and a `CorrelationIdMiddleware` for tracing.
- **Routed controllers** ([api-gateway/src/controllers/](greenovate-be/api-gateway/src/controllers/)):
  `auth-gateway`, `branches-gateway`, `cart-gateway`, `delivery-gateway`, `locations-gateway`, `orders-gateway`, `products-gateway`, `promos-gateway`, `analytics-gateway`, `gateway-health`.
- **Downstream service discovery**: Service URLs are read from env vars (`AUTH_SERVICE_URL`, `CART_SERVICE_URL`, …) with localhost fallbacks (see [service-urls.ts](greenovate-be/api-gateway/src/shared/http/service-urls.ts)).
- **Resilience**: Custom `ServiceUnavailableError` and `GatewayExceptionFilter` translate downstream failures into HTTP 503; per-request timeouts prevent hung connections.
- **Port**: `4000`

### 3.3. Authentication Service - `auth-service`

- **Role**: Source of truth for identity. Handles:
  - Customer + staff login (separate tables) with `bcrypt`-hashed passwords, failed-attempt counters, and 1-hour account lockouts after 5 failures.
  - Customer registration, profile update, password reset (email code), and JWT issuance.
  - Access tokens (short-lived) returned in body; refresh tokens issued as HTTP-only cookies (see `REFRESH_TOKEN_COOKIE_NAME`).
  - Admin endpoints: customers, accounts (staff), audit log create/list, settings, auth/usage stats, search analytics, product-view analytics.
  - Staff onboarding flow: `/staff/request-email`, `/staff/verify-email`.
  - Customer behavior signals consumed by the storefront: `product-view`, `category-interests`, `product-interests`, `browsing-history`.
- **Persistence**: Supabase tables `customers`, `staff`, `refresh_tokens`, `browsing_history`, `category_interests`, `product_interests`, `search_analytics`, admin `settings`, `audit_logs` (migrations in [greenovate-be/supabase/](greenovate-be/supabase/)).
- **Email**: [`MailerService`](greenovate-be/auth-service/src/auth/mailer.service.ts) routes through `ApiCenterService` (TribeClient `emailSend`) when configured, falling back to SMTP via `nodemailer`.
- **Port**: `4101`

### 3.4. Catalog Service - `catalog-service`

- **Role**: Owns the product catalog, product search/suggestions, branch directory, branch-level inventory, and personalized recommendations.
- **Controllers**: `BranchesController`, `ProductsController`, plus an internal-only `CatalogInternalController` for cross-service lookups.
- **Services**: `BranchesService`, `ProductsService`, `RecommendationsService`, `SupabaseService`.
- **Persistence**: `products`, `branches`, `branch_inventory`, plus `branches-migration`, `branches-pos-migration`, and view-count migrations.
- **Port**: `4103`

### 3.5. Cart Service - `cart-service`

- **Role**: Server-side persisted cart for logged-in customers. Endpoints: `GET /cart`, `PUT /cart` (replace), and internal `POST /internal/cart/clear` invoked after successful order placement.
- **Auth**: Validates JWT locally via its own `AppAuthService` (shared `JWT_SECRET`).
- **Cross-service**: Uses an internal `ProductsService` to enrich cart items with current pricing/stock.
- **Persistence**: `cart_items` (see `cart-service-schema.sql`).
- **Port**: `4102`

### 3.6. Order Service - `order-service`

- **Role**: Order lifecycle and the most cross-cutting business component:
  - `POST /orders/place` - validates input, decrements inventory, persists the order, clears the cart (calls cart-service internal endpoint), and triggers payment + receipt email.
  - `GET /orders/my`, `/orders/search`, `/orders/track?receiptNumber=…`, `PATCH .../cancel`.
  - Return requests (`POST /orders/return-request`, `GET /orders/my-return-requests`).
  - Admin: order list/detail, status updates, cancellations with reason codes.
  - **Idempotency**: in-memory cache keyed by the `idempotency-key` header (10-minute TTL) protects against double submission.
- **Payment**: [`ApiCenterService`](greenovate-be/order-service/src/order/api-center.service.ts) calls `paymentCreateCheckoutSession` / `paymentGetCheckoutStatus` through API Center (multi-method: card, gcash, maya, grabpay, qrph).
- **Email**: Order confirmation and status emails via API Center, with SMTP fallback.
- **Persistence**: `orders`, `order_items`, `order_events`, `return_requests`, `transactions` cancel migration.
- **Port**: `4104`

### 3.7. Delivery Service - `delivery-service`

- **Role**: Shipping/fee calculation and Philippine location data (region/province/city/barangay) via `ph-locations`. Exposes `DeliveryController` (fee estimation, delivery options) and `LocationsController` (cascading geo dropdowns).
- **Port**: `4105`

### 3.8. Promo Service - `promo-service`

- **Role**: Promo codes / discounts. Public `PromosController` for validation/apply, plus a `PromoInternalController` for trusted service-to-service usage (called by order-service during checkout).
- **Persistence**: `promos` table.
- **Port**: `4106`

### 3.9. Analytics Service - `analytics-service`

- **Role**: Standalone analytics endpoints for admin dashboards (aggregations over orders/customers/products). Note: the auth-service also exposes admin analytics endpoints for search and product-view metrics it owns directly - they coexist by domain.
- **Port**: `4107`

### 3.10. External Platform - API Center (`@implementsprint/sdk`)

- Not part of this repository; consumed via the SDK from `auth-service` and `order-service`.
- Provides shared services (currently used: `email`, `payment`) and acts as a policy/auth gateway for tribe-to-tribe calls. See [consumer-runbook.md](consumer-runbook.md) and [tribe-sdk-consumption.md](tribe-sdk-consumption.md) for the integration contract.

## 4. Communication Patterns

- **Browser → BFF (Next route handlers) → API Gateway → Service**: Default request path. The Next.js route handlers proxy through [`proxyToBackend`](nexOOS/src/lib/backend-proxy.ts), preserving cookies and authorization headers, and the gateway proxies to the appropriate service via [`requestDownstream`](greenovate-be/api-gateway/src/shared/http/request-downstream.ts).
- **Browser → API Gateway (direct)**: Supported when `NEXT_PUBLIC_API_BASE_URL` is set, used by client components that call `fetchJson` directly.
- **Service → Service (synchronous HTTP over private URLs)**: Examples:
  - `order-service` → `cart-service` (`/internal/cart/clear`) after placement.
  - `order-service` → `promo-service` (`PromoInternalController`) to validate codes.
  - `order-service` → `catalog-service` (`CatalogInternalController`) to verify stock/price.
- **Service → API Center (synchronous, governed)**: `auth-service` and `order-service` call shared services (`email`, `payment`) via `TribeClient`. Authentication is bearer-token via API Center using the per-service tribe secret.
- **Async / eventing**: No in-cluster message broker is wired up in this repository today. The API Center runbook documents a forward path for publishing business events to Kafka → S3 (`kafkaPublish`), but the services here do not currently emit those events. The `order_events` table is used as a local audit log of order state transitions.

## 5. Data & Persistence

- **Primary DB**: Supabase (PostgreSQL). Two projects referenced: a main project and a "second" project (`SECOND_SUPABASE_*`) - both keys are configured per service and selected by domain.
- **Migrations**: SQL files in [greenovate-be/supabase/](greenovate-be/supabase/) are applied via the Supabase SQL editor. Key migrations:
  - `admin-migration.sql`, `branches-migration.sql`, `branches-pos-migration.sql`
  - `cart-service-schema.sql`, `online-orders-migration.sql`, `order-events-migration.sql`
  - `refresh-tokens-migration.sql`, `return-requests-migration.sql`, `cancel-reason-migration.sql`
  - `search-analytics-migration.sql`, `browsing-history-migration.sql`, `browsing-history-view-count-migration.sql`
- **Service DB access**: Each service injects its own `SupabaseService` and uses either the anon key (RLS-bound) or the service role key (server-only, full access) depending on the operation. There is no shared ORM - services use the Supabase JS client directly.

## 6. Security & Session Flow

- **Edge**: API gateway sets `helmet`, restricts methods/headers, and accepts only signed JWTs in `Authorization: Bearer …`. CORS allows credentials so the refresh-token cookie can flow.
- **Tokens**:
  - Access token: short-lived JWT signed with shared `JWT_SECRET`, returned in login response body, attached to subsequent requests via `Authorization` header.
  - Refresh token: HTTP-only cookie issued by `auth-service`, refreshed at `POST /auth/refresh`, revoked at `POST /auth/logout`. Persisted in `refresh_tokens` table.
- **Account protection**:
  - 5 failed logins → 1-hour `account_locked_until` window (applied to both customers and staff).
  - Soft-delete / deactivation: staff with `is_active = false` are blocked at login.
  - Password reset uses an out-of-band emailed code (`request-password-reset` → `verify-password-reset-code` → `update-password`).
- **Admin authorization**: Staff records carry a `role` (e.g., super admin, admin, staff); the JWT payload embeds `isAdmin`, `staffRole`, and `isOnboarded`, which the frontend admin guard ([`admin-guard.ts`](nexOOS/src/lib/admin-guard.ts)) and downstream services use to gate access.
- **Client session security**: `AppContext` enforces a **15-minute inactivity auto-logout** with a 13-minute warning, driven by user-input events.
- **Secrets hygiene**: `.env.example` files only; pre-commit hook (`git config core.hooksPath .githooks`) blocks committing real `.env` files. `JWT_SECRET` must match across `auth-service` and `cart-service` (and the frontend if it verifies locally).

## 7. Service / Port Map

| Component         | Path                                     | Default Port |
|-------------------|------------------------------------------|--------------|
| Frontend (Next)   | [nexOOS/](nexOOS/)                       | 3000         |
| API Gateway       | [greenovate-be/api-gateway/](greenovate-be/api-gateway/)       | 4000         |
| Auth Service      | [greenovate-be/auth-service/](greenovate-be/auth-service/)     | 4101         |
| Cart Service      | [greenovate-be/cart-service/](greenovate-be/cart-service/)     | 4102         |
| Catalog Service   | [greenovate-be/catalog-service/](greenovate-be/catalog-service/) | 4103         |
| Order Service     | [greenovate-be/order-service/](greenovate-be/order-service/)   | 4104         |
| Delivery Service  | [greenovate-be/delivery-service/](greenovate-be/delivery-service/) | 4105         |
| Promo Service     | [greenovate-be/promo-service/](greenovate-be/promo-service/)   | 4106         |
| Analytics Service | [greenovate-be/analytics-service/](greenovate-be/analytics-service/) | 4107         |
| InfluxDB (k6)     | docker-compose                           | 8086         |
| Grafana           | docker-compose                           | 3001 → 3000  |

> Note: `api-gateway/src/shared/http/service-urls.ts` lists slightly different fallback ports for local dev (cart=4103, catalog=4102, etc.). The values above match the canonical `docker-compose.yml` and each service's `main.ts` default. Either set the explicit `*_SERVICE_URL` env vars or align both files before running outside Docker.

## 8. Repository Layout (Top-Level)

```
System4/
├── nexOOS/                       # Next.js frontend (storefront + admin)
│   ├── src/app/                  # App Router pages + /api route handlers (BFF proxy)
│   ├── src/components/           # Storefront components + admin/UndoToast
│   ├── src/context/AppContext.tsx
│   └── src/lib/                  # api, backend-proxy, auth-client, supabase, mailer, etc.
├── greenovate-be/                # NestJS microservices monorepo
│   ├── api-gateway/              # Edge + routing
│   ├── auth-service/             # Identity, admin, settings, behavior signals
│   ├── catalog-service/          # Products, branches, recommendations
│   ├── cart-service/             # Server-side cart
│   ├── order-service/            # Orders, payments, returns
│   ├── delivery-service/         # Shipping fees, PH geo
│   ├── promo-service/            # Promos / discounts
│   ├── analytics-service/        # Admin analytics
│   ├── supabase/                 # SQL migrations
│   ├── grafana/                  # Provisioned dashboards & datasources
│   ├── tests/                    # k6 load tests, etc.
│   └── docker-compose.yml
├── scripts/                      # Workspace dev scripts (dev.mjs)
├── consumer-runbook.md           # API Center consumer guide
├── tribe-sdk-consumption.md      # SDK usage notes
└── README.md                     # Local setup
```

## 9. Build, Run & Test

- **Install**: `npm install` at the root, then per-package (`nexOOS`, `greenovate-be`) — installs happen automatically when starting services.
- **Run everything**: `npm run dev` (root) — uses [scripts/dev.mjs](scripts/dev.mjs) and `concurrently` to start backend services and the frontend in parallel.
- **Run backend only**: `npm run dev:backend` → `greenovate-be` PowerShell script `start-core-services.ps1` boots each NestJS service.
- **Run frontend only**: `npm run dev:frontend`.
- **Quality**: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (Jest with coverage on the frontend; Jest on the backend).
- **E2E**: `npm run test:e2e` in `nexOOS` (Playwright).
- **Load**: k6 scripts in `greenovate-be/tests/`, results pushed to InfluxDB and visualized in Grafana via `docker-compose up`.

## 10. Key Architectural Characteristics

- **Microservices with a thin gateway**: All cross-cutting concerns (routing, CORS, helmet, cookie passthrough, correlation IDs) live in the gateway. Services are otherwise unaware of each other except through explicit `*_SERVICE_URL` env vars.
- **Three-tier auth boundary**: browser holds the access token in memory + a refresh cookie on the gateway domain; services validate the JWT independently using the shared secret.
- **BFF pattern via Next route handlers**: The frontend can hide backend topology and inject auth headers/cookies behind a stable `/api/*` surface owned by the same origin.
- **Pluggable external platform**: Email and payment are abstracted behind `ApiCenterService` so the system can fall back to SMTP when API Center is not configured, and can adopt additional shared services (`geo`, `otp`, `gauth`) without local provider credentials.
- **Idempotency at the order boundary**: Idempotency keys + per-service exception filters keep retries safe under flaky networks.
- **Operational observability via the load-test stack**: InfluxDB + Grafana give a ready-made surface for performance regressions, with k6 as the workload generator.
