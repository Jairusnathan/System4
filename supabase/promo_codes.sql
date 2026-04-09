create table if not exists public.promo_codes (
  id bigserial primary key,
  code text not null,
  description text null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  min_subtotal numeric(10, 2) not null default 0 check (min_subtotal >= 0),
  max_discount numeric(10, 2) null check (max_discount is null or max_discount >= 0),
  starts_at timestamptz null,
  ends_at timestamptz null,
  usage_limit integer null check (usage_limit is null or usage_limit > 0),
  times_used integer not null default 0 check (times_used >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint promo_codes_dates_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create unique index if not exists promo_codes_code_upper_idx
  on public.promo_codes ((upper(code)));

create or replace function public.set_promo_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.code = upper(trim(new.code));
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists promo_codes_set_updated_at on public.promo_codes;

create trigger promo_codes_set_updated_at
before insert or update on public.promo_codes
for each row
execute function public.set_promo_codes_updated_at();

alter table public.promo_codes disable row level security;

insert into public.promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  min_subtotal,
  max_discount,
  starts_at,
  ends_at,
  usage_limit,
  is_active
)
select *
from (
  values
    ('HAPPY50', 'Get P50 off on orders worth at least P500.', 'fixed', 50.00, 500.00, null, null, null, null, true),
    ('SAVE10', 'Get 10% off up to P200 on orders worth at least P300.', 'percent', 10.00, 300.00, 200.00, null, null, null, true),
    ('WELCOME25', 'Welcome promo for first-time style campaigns.', 'fixed', 25.00, 250.00, null, null, null, 500, true)
) as seed(code, description, discount_type, discount_value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, is_active)
where not exists (
  select 1
  from public.promo_codes existing
  where upper(existing.code) = upper(seed.code)
);
