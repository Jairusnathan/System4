-- Run this in your order-service Supabase SQL Editor.

alter table public.online_orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;
