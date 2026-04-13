<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run the frontend and NestJS backend

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9736117b-8e38-4e67-b7fd-41f53d7dcbab

## Architecture

- Frontend: Next.js in [`src/frontend`](./src/frontend)
- Backend: NestJS in [`src/backend`](./src/backend)
- Data: Supabase plus the optional second Supabase connection for product/order data

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure `.env` using `.env.example`.
3. Run the frontend and backend together:
   `npm run dev`

Forgot-password email delivery requires valid SMTP credentials. If you use Gmail, create an App Password and use that as `SMTP_PASS`.

The frontend expects the backend at `NEXT_PUBLIC_API_BASE_URL`, which defaults to `http://localhost:4000` in the example env file.

## Helpful scripts

- `npm run dev` starts both apps together from the project root
- `npm run dev:frontend` starts only the Next.js app
- `npm run dev:backend` starts only the NestJS app

## Account Creation Note

When creating an account, users must enter a valid email address because the app sends a verification code by email before registration is completed.

## Supabase SQL Files

Run these SQL files in your Supabase SQL editor when you want the related backend tables:

- `supabase/customer_addresses.sql` for saved customer addresses
- `supabase/cart_items.sql` for user-synced cart items
- `supabase/delivery_rates.sql` for city/province-based delivery fee and ETA estimates
- `supabase/promo_codes.sql` for checkout promo codes and discount validation
