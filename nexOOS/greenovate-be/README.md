# PharmaQuick Backend

NestJS backend for the `nexOOS` PharmaQuick frontend. This folder is the active backend for the System 4 app and replaces the old `backend/` directory.

## What Is Here

- Main HTTP API under `/api`
- Authentication, cart, orders, products, promos, branches, delivery, locations, analytics
- Supabase integration for the primary and secondary databases
- APICenter SDK and health checks preserved from the `greenovate-be` template
- Docker, linting, tests, and CI-facing config for repo pushes

## Runtime Shape

- Default local backend URL: `http://localhost:4000`
- API prefix: `/api`
- Health endpoint: `GET /api/health`
- Swagger docs when enabled: `/api/docs`

## Local Setup

1. Copy `.env.example` to `.env`
2. Fill in the required Supabase values
3. Set `ALLOWED_ORIGINS=http://localhost:3000` for local frontend access
4. Install and run

```bash
npm install
npm run start:dev
```

For the frontend, run `nexOOS` separately on port `3000`.

## Important Environment Variables

Required for the current app:

- `PORT=4000`
- `ALLOWED_ORIGINS=http://localhost:3000`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` if server-side privileged access is needed
- `SECOND_SUPABASE_URL`
- `SECOND_SUPABASE_ANON_KEY`
- `SECOND_SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

Optional but used by features:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `API_CENTER_BASE_URL`
- `API_CENTER_TRIBE_ID`
- `API_CENTER_TRIBE_SECRET`
- `API_CENTER_API_KEY`

Notes:

- The migrated backend supports fallback reads from `NEXT_PUBLIC_*` Supabase variables for local compatibility, but backend-specific names are preferred.
- Missing APICenter config does not stop the app from starting locally, but it can degrade `/api/health`.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run test -- --runInBand
```

## Docker

```bash
docker build -t pharmaquick-backend .
docker run --rm -p 4000:4000 --env-file .env pharmaquick-backend
```

The container health check targets `http://127.0.0.1:4000/api/health`.

## Project Notes

- Root template hardening from `greenovate-be` was preserved where useful.
- Business logic was migrated from the old System 4 backend into this structure.
- This folder should be treated as the source of truth for backend changes going forward.
