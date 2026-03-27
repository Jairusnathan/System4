create extension if not exists pgcrypto;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id text not null,
  branch_id uuid null references public.branches(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists cart_items_customer_product_branch_idx
  on public.cart_items(customer_id, product_id, branch_id);

create index if not exists cart_items_customer_id_idx
  on public.cart_items(customer_id, created_at);

create index if not exists cart_items_branch_id_idx
  on public.cart_items(branch_id);

create or replace function public.set_cart_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists cart_items_set_updated_at on public.cart_items;

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row
execute function public.set_cart_items_updated_at();

alter table public.cart_items disable row level security;
