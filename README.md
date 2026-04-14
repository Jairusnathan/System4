<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run the frontend and microservices backend

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9736117b-8e38-4e67-b7fd-41f53d7dcbab

## Architecture

- Frontend: Next.js in [`src/frontend`](./src/frontend)
- API gateway: NestJS gateway in [`src/backend/src/apps/api-gateway`](./src/backend/src/apps/api-gateway)
- Domain services: NestJS services in [`src/backend/src/apps`](./src/backend/src/apps)
- Data: Supabase plus the optional second Supabase connection for product/order data

### Service boundaries

- `auth-service` owns customer authentication, profile, password reset, and customer address persistence
- `catalog-service` owns products, branches, inventory lookups, and stock mutations
- `cart-service` owns `cart_items` and fetches catalog data through the catalog service
- `promo-service` owns promo validation and promo usage tracking
- `order-service` owns checkout orchestration, receipts, transactions, and order search
- `delivery-service` owns delivery estimates and Philippine location lookup endpoints
- `analytics-service` owns search analytics ingestion

The public frontend API still stays at `http://localhost:4000/api/*`, but that port now acts as a gateway instead of a monolith.

### Health endpoints

- Gateway: `GET http://localhost:4000/api/health`
- Auth service: `GET http://localhost:4101/health`
- Catalog service: `GET http://localhost:4102/health`
- Cart service: `GET http://localhost:4103/health`
- Promo service: `GET http://localhost:4104/health`
- Order service: `GET http://localhost:4105/health`
- Delivery service: `GET http://localhost:4106/health`
- Analytics service: `GET http://localhost:4107/health`

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure `.env` using `.env.example`.
3. Run the frontend and backend together:
   `npm run dev`

### Run Individual Services

- `npm run dev:backend` starts the full backend microservice set
- `npm run dev:microservices` is an alias for the same backend microservice set
- In `src/backend`, you can run `npm run dev:gateway`, `npm run dev:auth`, `npm run dev:catalog`, `npm run dev:cart`, `npm run dev:promo`, `npm run dev:orders`, `npm run dev:delivery`, or `npm run dev:analytics`

Forgot-password email delivery requires valid SMTP credentials. If you use Gmail, create an App Password and use that as `SMTP_PASS`.

The frontend expects the API gateway at `NEXT_PUBLIC_API_BASE_URL`, which defaults to `http://localhost:4000` in the example env file.
The legacy Next.js route handlers now act only as compatibility proxies to the gateway, so business logic lives in backend services instead of being duplicated in the frontend.

## Helpful scripts

- `npm run dev` starts both apps together from the project root
- `npm run dev:frontend` starts only the Next.js app
- `npm run dev:backend` starts the API gateway plus all backend services
- `npm run docker:up` builds and runs the full stack with Docker Compose
- `npm run docker:down` stops the Compose stack

## Docker Compose

Use Docker Compose when you want each service to run as its own container:

1. Create `.env` from `.env.example`
2. Run `npm run docker:up`
3. Open `http://localhost:3000`

Compose publishes:

- Frontend on `3000`
- API gateway on `4000`
- Internal services on `4101` to `4107`

## Account Creation Note

When creating an account, users must enter a valid email address because the app sends a verification code by email before registration is completed.

## Supabase SQL Files

Run these SQL files in your Supabase SQL editor when you want the related backend tables:

- `supabase/customer_addresses.sql` for saved customer addresses
- `supabase/cart_items.sql` for user-synced cart items
- `supabase/delivery_rates.sql` for city/province-based delivery fee and ETA estimates
- `supabase/promo_codes.sql` for checkout promo codes and discount validation
