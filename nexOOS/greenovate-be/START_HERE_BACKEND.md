# START_HERE_BACKEND

This backend is no longer a generic starter. It is the active backend for the PharmaQuick System 4 application.

## Current Role

- Serves the `nexOOS` frontend
- Owns the app routes under `/api`
- Connects to two Supabase projects
- Uses template-provided health, security, and APICenter support

## Current Structure

```text
src/
  main.ts
  app.module.ts
  app.controller.ts
  app.service.ts
  common/
  api-center/
  health/
  supabase/
  controllers/
  services/
  utils/
  shared/
  apps/
```

### Main app routes

- `auth`
- `branches`
- `cart`
- `products`
- `promos`
- `orders`
- `delivery`
- `locations`
- `analytics`

### Included app modules under `src/apps`

These were migrated from the previous backend and retained for internal/service-oriented use:

- `api-gateway`
- `auth-service`
- `catalog-service`
- `cart-service`
- `promo-service`
- `order-service`
- `delivery-service`
- `analytics-service`

## Before Pushing

Verify these files are correct for the target repo:

1. `.env.example`
2. `package.json`
3. `Dockerfile`
4. `README.md`
5. `.github/workflows/be-pipeline-caller.yml`
6. `sonar-project.properties`

## Local Readiness Checklist

1. Set `ALLOWED_ORIGINS=http://localhost:3000`
2. Set `PORT=4000`
3. Fill both primary and secondary Supabase values
4. Add `JWT_SECRET`
5. Add SMTP variables if auth email flows are needed
6. Run lint, typecheck, build, and tests

## Current Commands

```bash
npm install
npm run start:dev
npm run build
npm run lint
npm run typecheck
npm run test -- --runInBand
```

## Deployment Notes

- The Docker image now targets port `4000`
- The health endpoint is `/api/health`
- APICenter config is optional for local development but may affect health status
- This folder should be the only backend pushed for the app
