# START_HERE_BACKEND

This backend is the active service-oriented backend for the PharmaQuick System 4 application.

## Current Role

- Serves the `nexOOS` frontend through `api-gateway`
- Splits runtime config per service under `apps/<service>/.env`
- Connects to two Supabase projects
- Keeps the template-provided health, security, and APICenter support where still useful

## Current Structure

```text
apps/
  api-gateway/
  auth-service/
  cart-service/
  catalog-service/
  delivery-service/
  order-service/
  promo-service/
  analytics-service/

src/
  apps/
  common/
  controllers/
  services/
  shared/
  supabase/
```

## Environment Layout

- Each service reads only from its own `apps/<service>/.env`
- The root `.env` is no longer used for local service startup
- Shared values must be duplicated into each service that needs them

## Before Pushing

Verify these files are correct for the target repo:

1. `apps/*/.env.example`
2. `package.json`
3. `Dockerfile`
4. `README.md`
5. `.github/workflows/be-pipeline-caller.yml`
6. `sonar-project.properties`

## Local Readiness Checklist

1. Set `apps/api-gateway/.env` with the gateway port and downstream service URLs
2. Fill the Supabase values inside each service env that needs them
3. Copy `JWT_SECRET` into each dependent service
4. Add SMTP variables to `apps/auth-service/.env` if auth email flows are needed
5. Run lint, typecheck, build, and tests

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

- The Docker image now boots the API gateway on port `4000`
- The health endpoint is `/api/health`
- Downstream services still need to run separately
- This folder should be the only backend pushed for the app
