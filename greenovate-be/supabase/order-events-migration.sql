-- Run this in your main Supabase SQL editor
create table if not exists order_events (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,
  order_id      text not null,
  receipt_number text,
  user_id       text not null,
  payload       jsonb not null default '{}',
  processed     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_oe_event_type  on order_events (event_type);
create index if not exists idx_oe_order_id    on order_events (order_id);
create index if not exists idx_oe_processed   on order_events (processed) where processed = false;
