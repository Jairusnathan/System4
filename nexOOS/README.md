# nexOOS Frontend

This folder now contains the `System 4` frontend adapted to the main group repo structure.

## What is included

- Next.js frontend app
- Frontend-side API routes under `src/app/api`
- Dockerfile compatible with this folder structure

## What is not included

- Backend source code
- Root-level shared `.env` assumptions from the original `System4` workspace

## Environment variables

Create `.env.local` in this folder and provide the values your deployment uses.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
BACKEND_PROXY_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SECOND_SUPABASE_URL=
NEXT_PUBLIC_SECOND_SUPABASE_ANON_KEY=
SECOND_SUPABASE_URL=
SECOND_SUPABASE_ANON_KEY=
SECOND_SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAIL_USER=
MAIL_PASS=
GOOGLE_GENAI_API_KEY=
```

## Local commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```
