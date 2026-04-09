create table if not exists public.delivery_rates (
  id bigserial primary key,
  province text not null,
  city text null,
  barangay text null,
  fee numeric(10, 2) not null check (fee >= 0),
  eta_min_minutes integer not null check (eta_min_minutes > 0),
  eta_max_minutes integer not null check (eta_max_minutes >= eta_min_minutes),
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists delivery_rates_location_idx
  on public.delivery_rates(province, city, barangay);

create unique index if not exists delivery_rates_single_default_idx
  on public.delivery_rates(is_default)
  where is_default = true;

create or replace function public.set_delivery_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists delivery_rates_set_updated_at on public.delivery_rates;

create trigger delivery_rates_set_updated_at
before update on public.delivery_rates
for each row
execute function public.set_delivery_rates_updated_at();

alter table public.delivery_rates disable row level security;

insert into public.delivery_rates (province, city, fee, eta_min_minutes, eta_max_minutes, is_active, is_default)
select *
from (
  values
    ('Metro Manila', 'Manila', 50.00, 35, 50, true, false),
    ('Metro Manila', 'Quezon City', 60.00, 40, 55, true, false),
    ('Metro Manila', 'Makati', 70.00, 45, 60, true, false),
    ('Metro Manila', 'Pasig', 65.00, 40, 55, true, false),
    ('Metro Manila', 'Taguig', 75.00, 45, 65, true, false),
    ('Cavite', null, 90.00, 60, 90, true, false),
    ('Laguna', null, 100.00, 70, 100, true, false),
    ('Bulacan', null, 95.00, 65, 95, true, false),
    ('Rizal', null, 85.00, 55, 85, true, false),
    ('Metro Manila', null, 55.00, 40, 60, true, true)
) as seed(province, city, fee, eta_min_minutes, eta_max_minutes, is_active, is_default)
where not exists (
  select 1
  from public.delivery_rates existing
  where existing.province = seed.province
    and coalesce(existing.city, '') = coalesce(seed.city, '')
);
