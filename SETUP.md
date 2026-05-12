# Local Setup Guide

## 1. Copy environment files

Run these commands from the project root to create your local `.env` files from the examples:

```bash
# Backend (monolith / shared)
cp greenovate-be/.env.example          greenovate-be/.env

# Per-service env files
cp greenovate-be/apps/api-gateway/.env.example     greenovate-be/apps/api-gateway/.env
cp greenovate-be/apps/auth-service/.env.example    greenovate-be/apps/auth-service/.env
cp greenovate-be/apps/order-service/.env.example   greenovate-be/apps/order-service/.env
cp greenovate-be/apps/cart-service/.env.example    greenovate-be/apps/cart-service/.env
cp greenovate-be/apps/catalog-service/.env.example greenovate-be/apps/catalog-service/.env

# Frontend
cp nexOOS/.env.example nexOOS/.env.local
```

## 2. Fill in real values

Open each `.env` file and replace the placeholder values:

| Placeholder | Where to get it |
|---|---|
| `https://your-project-id.supabase.co` | Supabase → Project Settings → API → Project URL |
| `your-anon-key-here` | Supabase → Project Settings → API → anon public |
| `your-service-role-key-here` | Supabase → Project Settings → API → service_role **secret** |
| `replace-with-a-long-random-secret` | Run: `openssl rand -hex 64` |
| `your-app-password-here` | Gmail → Google Account → Security → App Passwords |

> **Important:** `JWT_SECRET` must be the **same value** in `greenovate-be/.env`,
> `apps/auth-service/.env`, and `apps/cart-service/.env`.

## 3. Install the pre-commit hook (one-time)

This blocks you from accidentally committing real `.env` files:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

## 4. Run SQL migrations (first time only)

Open your Supabase SQL editor and run:

```
greenovate-be/supabase/branches-migration.sql         → main Supabase
greenovate-be/supabase/refresh-tokens-migration.sql   → main Supabase
greenovate-be/supabase/order-events-migration.sql     → main Supabase
```

## 5. Start the project

```bash
npm run dev          # starts both frontend and backend
npm run dev:backend  # backend only (port 4000)
npm run dev:frontend # frontend only (port 3000)
```

## Security rules

- **Never commit `.env` files** — the pre-commit hook and CI will block it
- `.env.example` files are safe to commit — they contain only placeholders
- If you accidentally commit credentials: rotate them immediately in Supabase/Gmail, then remove from git history
