-- Run this in your main Supabase SQL Editor.

create table if not exists public.search_analytics (
  id          bigint generated always as identity primary key,
  query       text not null,
  source      text not null default 'shop',
  searched_at timestamptz not null default now()
);

create index if not exists search_analytics_query_idx on public.search_analytics (query);
create index if not exists search_analytics_searched_at_idx on public.search_analytics (searched_at desc);
