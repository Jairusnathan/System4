-- Run this in your main Supabase SQL editor
create table if not exists refresh_token_families (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  token_hash  text not null unique,
  family_id   uuid not null,
  revoked     boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rtf_token_hash  on refresh_token_families (token_hash);
create index if not exists idx_rtf_family_id   on refresh_token_families (family_id);
create index if not exists idx_rtf_user_id     on refresh_token_families (user_id);

-- Auto-delete expired tokens daily (optional, keeps the table tidy)
create index if not exists idx_rtf_expires_at  on refresh_token_families (expires_at);
