-- Run this SQL in the order-service Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.online_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  receipt_id bigint references public.receipts(receipt_id) on delete set null,
  receipt_number text,
  transaction_id uuid references public.transactions(id) on delete set null,
  order_number text,
  tx_no text,
  branch_id bigint,
  shipping_address text not null,
  payment_method text not null,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  fulfillment_status text not null default 'Processing'
    check (fulfillment_status in ('Processing', 'In Transit', 'Delivered', 'Cancelled')),
  delivery_method text
    check (delivery_method in ('claim_at_branch', 'same_day', 'scheduled')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  promo_code text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.online_order_items (
  id uuid primary key default gen_random_uuid(),
  online_order_id uuid not null references public.online_orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  category text,
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists online_orders_receipt_number_uidx
  on public.online_orders (receipt_number)
  where receipt_number is not null;

create unique index if not exists online_orders_transaction_id_uidx
  on public.online_orders (transaction_id)
  where transaction_id is not null;

create index if not exists online_orders_customer_id_idx
  on public.online_orders (customer_id);

create index if not exists online_orders_customer_created_at_idx
  on public.online_orders (customer_id, created_at desc);

create index if not exists online_orders_fulfillment_status_idx
  on public.online_orders (fulfillment_status);

create index if not exists online_orders_payment_status_idx
  on public.online_orders (payment_status);

create index if not exists online_orders_branch_id_idx
  on public.online_orders (branch_id)
  where branch_id is not null;

create index if not exists online_order_items_online_order_id_idx
  on public.online_order_items (online_order_id);

create index if not exists online_order_items_product_id_idx
  on public.online_order_items (product_id);

drop trigger if exists trg_online_orders_set_updated_at on public.online_orders;
create trigger trg_online_orders_set_updated_at
before update on public.online_orders
for each row
execute function public.set_updated_at();
