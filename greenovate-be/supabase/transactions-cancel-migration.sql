-- Run this in your order-service Supabase SQL Editor.
-- Ensures the transactions table can store a 'cancelled' status.

-- If a CHECK constraint exists on status, drop and recreate it to include 'cancelled'
alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('paid', 'pending', 'cancelled', 'refunded', 'failed'));
