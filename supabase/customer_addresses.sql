create extension if not exists pgcrypto;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  full_name text not null,
  phone_number text not null,
  province text not null default '',
  city text not null default '',
  postal_code text not null default '',
  street_address text not null,
  label text not null default 'Home' check (label in ('Home', 'Work')),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_addresses_customer_id_idx
  on public.customer_addresses(customer_id, sort_order, created_at);

create unique index if not exists customer_addresses_default_idx
  on public.customer_addresses(customer_id)
  where is_default = true;

create or replace function public.set_customer_addresses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;

create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row
execute function public.set_customer_addresses_updated_at();

alter table public.customer_addresses disable row level security;
