-- Run this in your main Supabase SQL Editor.

-- Add view_count column to existing browsing_history table
alter table public.browsing_history
  add column if not exists view_count integer not null default 1;

-- Atomic upsert function: inserts on first view, increments count on repeat views
create or replace function public.increment_product_view(
  p_customer_id text,
  p_product_id  text,
  p_category    text
) returns void language plpgsql as $$
begin
  insert into public.browsing_history (customer_id, product_id, category, view_count, viewed_at)
  values (p_customer_id, p_product_id, p_category, 1, now())
  on conflict (customer_id, product_id)
  do update set
    view_count = browsing_history.view_count + 1,
    viewed_at  = now();
end;
$$;
