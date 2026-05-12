# PharmaQuick Backend

NestJS backend for the `nexOOS` PharmaQuick frontend.

## Runtime Shape

- `apps/api-gateway/.env` is the public API entrypoint config for `http://localhost:4000/api`
- Each backend service now owns its own `.env` file under `apps/<service>/`
- The old root `.env` is no longer part of the runtime config path

## Local Setup

1. Create or update these files from their matching `.env.example` templates:
   - `apps/api-gateway/.env`
   - `apps/auth-service/.env`
   - `apps/catalog-service/.env`
   - `apps/cart-service/.env`
   - `apps/promo-service/.env`
   - `apps/order-service/.env`
   - `apps/delivery-service/.env`
   - `apps/analytics-service/.env`
2. Install dependencies
3. Build and start the core services

```bash
npm install
npm run start:dev
```

For the frontend, run `nexOOS` separately on port `3000`.

## Notes

- The gateway routes requests to downstream services using the URLs in `apps/api-gateway/.env`.
- Shared secrets like `JWT_SECRET` still need to be copied into each service that uses them.
- `NEXT_PUBLIC_*` Supabase variables are still accepted inside service env files for local compatibility, but service-specific names are preferred.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run test -- --runInBand
```

## Docker

The included Dockerfile now boots the API gateway service. Downstream services still need to run separately with their own configuration.
