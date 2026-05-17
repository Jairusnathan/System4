-- Run this in your main Supabase SQL Editor.

create table if not exists public.browsing_history (
  id          bigint generated always as identity primary key,
  customer_id text not null,
  product_id  text not null,
  category    text not null,
  viewed_at   timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index if not exists browsing_history_customer_id_idx on public.browsing_history (customer_id, viewed_at desc);
