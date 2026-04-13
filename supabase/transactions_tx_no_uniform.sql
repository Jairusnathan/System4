-- DB2 fix for transactions.tx_no consistency
-- 1) Normalizes existing tx_no values to 8-digit numbers
-- 2) Enforces sequence-based defaults for future inserts

begin;

create sequence if not exists public.transactions_tx_no_seq
  as bigint
  start with 10000000
  increment by 1
  minvalue 10000000;

-- Normalize historical values to a consistent 8-digit pattern.
with ordered as (
  select
    id,
    row_number() over (order by created_at asc nulls last, id asc) as rn
  from public.transactions
)
update public.transactions t
set tx_no = 10000000 + o.rn - 1
from ordered o
where t.id = o.id;

-- Move sequence after current max tx_no.
select setval(
  'public.transactions_tx_no_seq',
  greatest((select coalesce(max(tx_no), 9999999) from public.transactions), 9999999),
  true
);

-- Ensure new rows always get tx_no from sequence.
alter table public.transactions
  alter column tx_no set default nextval('public.transactions_tx_no_seq');

commit;
