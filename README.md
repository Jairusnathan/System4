<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9736117b-8e38-4e67-b7fd-41f53d7dcbab

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure Supabase and JWT values in `.env`:
   `NEXT_PUBLIC_SUPABASE_URL=...`
   `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   `JWT_SECRET=...`
   `SMTP_HOST=...`
   `SMTP_PORT=...`
   `SMTP_USER=...`
   `SMTP_PASS=...`
   `SMTP_FROM=...`
3. Run the app:
   `npm run dev`

Forgot-password email delivery requires valid SMTP credentials. If you use Gmail, create an App Password and use that as `SMTP_PASS`.

## Account Creation Note

When creating an account, users must enter a valid email address because the app sends a verification code by email before registration is completed.

## Supabase SQL Files

Run these SQL files in your Supabase SQL editor when you want the related backend tables:

- `supabase/customer_addresses.sql` for saved customer addresses
- `supabase/cart_items.sql` for user-synced cart items
- `supabase/delivery_rates.sql` for city/province-based delivery fee and ETA estimates
- `supabase/promo_codes.sql` for checkout promo codes and discount validation
