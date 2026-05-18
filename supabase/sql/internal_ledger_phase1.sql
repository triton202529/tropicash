-- Internal ledger / journal engine (Phase 1, observation mode).
-- No automatic journal posts from wallet or payment flows in this phase.
-- Admin access uses public.tc_is_admin() — align with lib/adminAccess.js + withdrawal_requests.sql.
-- Normal authenticated users have no policies on these tables (RLS denies).

-- ---------------------------------------------------------------------------
-- public.ledger_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  account_type text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_accounts_account_type_ck check (
    account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')
  ),
  constraint ledger_accounts_status_ck check (status in ('active', 'inactive'))
);

create unique index if not exists ledger_accounts_code_key on public.ledger_accounts (code);
create index if not exists ledger_accounts_account_type_idx on public.ledger_accounts (account_type);
create index if not exists ledger_accounts_status_idx on public.ledger_accounts (status);

comment on table public.ledger_accounts is
  'Chart of accounts for the internal ledger (Phase 1). RLS: admin only.';

-- ---------------------------------------------------------------------------
-- public.journal_entries
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null,
  source_type text not null,
  source_id text,
  description text,
  status text not null default 'posted',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint journal_entries_status_ck check (status in ('draft', 'posted', 'void'))
);

comment on column public.journal_entries.source_type is
  'Origin of the entry. Future values include: funding, withdrawal, send_money, triton_transfer, fraud_hold, manual_adjustment, fee, treasury_snapshot.';

create index if not exists journal_entries_created_at_idx on public.journal_entries (created_at desc);
create index if not exists journal_entries_source_type_source_id_idx on public.journal_entries (source_type, source_id);
create index if not exists journal_entries_status_idx on public.journal_entries (status);

comment on table public.journal_entries is
  'Journal entry headers (Phase 1). RLS: admin select/insert.';

-- ---------------------------------------------------------------------------
-- public.journal_lines
-- ---------------------------------------------------------------------------
create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.ledger_accounts (id),
  debit numeric not null default 0,
  credit numeric not null default 0,
  currency text not null default 'USD',
  user_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint journal_lines_amounts_nonneg_ck check (debit >= 0 and credit >= 0),
  constraint journal_lines_one_side_positive_ck check (
    (debit > 0)::int + (credit > 0)::int <= 1
  ),
  constraint journal_lines_nonzero_side_ck check (debit > 0 or credit > 0)
);

create index if not exists journal_lines_journal_entry_id_idx on public.journal_lines (journal_entry_id);
create index if not exists journal_lines_account_id_idx on public.journal_lines (account_id);
create index if not exists journal_lines_created_at_idx on public.journal_lines (created_at desc);

comment on table public.journal_lines is
  'Journal line items (Phase 1). RLS: admin select/insert.';

-- ---------------------------------------------------------------------------
-- Seed accounts (idempotent)
-- ---------------------------------------------------------------------------
insert into public.ledger_accounts (code, name, account_type)
values
  ('treasury_cash', 'Treasury cash', 'asset'),
  ('user_wallet_liability', 'User wallet liability', 'liability'),
  ('pending_withdrawals', 'Pending withdrawals', 'liability'),
  ('triton_pending_settlement', 'Triton pending settlement', 'liability'),
  ('fees_revenue', 'Fees revenue', 'revenue'),
  ('fraud_holds', 'Fraud holds', 'liability'),
  ('system_adjustments', 'System adjustments', 'equity')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- RLS (admin only for authenticated; no anon policies)
-- ---------------------------------------------------------------------------
alter table public.ledger_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists ledger_accounts_select_admin on public.ledger_accounts;
drop policy if exists ledger_accounts_insert_admin on public.ledger_accounts;

create policy ledger_accounts_select_admin
  on public.ledger_accounts
  for select
  to authenticated
  using (public.tc_is_admin());

create policy ledger_accounts_insert_admin
  on public.ledger_accounts
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists journal_entries_select_admin on public.journal_entries;
drop policy if exists journal_entries_insert_admin on public.journal_entries;

create policy journal_entries_select_admin
  on public.journal_entries
  for select
  to authenticated
  using (public.tc_is_admin());

create policy journal_entries_insert_admin
  on public.journal_entries
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists journal_lines_select_admin on public.journal_lines;
drop policy if exists journal_lines_insert_admin on public.journal_lines;

create policy journal_lines_select_admin
  on public.journal_lines
  for select
  to authenticated
  using (public.tc_is_admin());

create policy journal_lines_insert_admin
  on public.journal_lines
  for insert
  to authenticated
  with check (public.tc_is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert on table public.ledger_accounts to authenticated;
grant select, insert on table public.journal_entries to authenticated;
grant select, insert on table public.journal_lines to authenticated;

grant select, insert, update, delete on table public.ledger_accounts to service_role;
grant select, insert, update, delete on table public.journal_entries to service_role;
grant select, insert, update, delete on table public.journal_lines to service_role;
