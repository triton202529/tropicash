-- Phase 11E: KYC limit policies (architecture only — seeded as advisory).
-- Depends on: phase_11a_kyc_foundation.sql, public.tc_is_admin().
-- Idempotent: safe to re-run.
--
-- Wallet enforcement is NOT active until Phase 11F wiring.
-- Policies define limits and enforcement_mode for evaluateKycTransactionLimit().

create table if not exists public.kyc_limit_policies (
  id uuid primary key default gen_random_uuid(),
  kyc_status text not null,
  funding_daily_limit numeric not null,
  send_daily_limit numeric not null,
  withdrawal_daily_limit numeric not null,
  enforcement_mode text not null default 'advisory',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyc_limit_policies_kyc_status_unique unique (kyc_status),
  constraint kyc_limit_policies_enforcement_mode_ck check (
    lower(btrim(enforcement_mode)) in ('advisory', 'soft_block', 'hard_block')
  ),
  constraint kyc_limit_policies_funding_nonneg_ck check (funding_daily_limit >= 0),
  constraint kyc_limit_policies_send_nonneg_ck check (send_daily_limit >= 0),
  constraint kyc_limit_policies_withdrawal_nonneg_ck check (withdrawal_daily_limit >= 0)
);

create index if not exists kyc_limit_policies_active_idx
  on public.kyc_limit_policies (is_active, kyc_status);

comment on table public.kyc_limit_policies is
  'KYC-based daily transaction limits by verification status. Phase 11E: advisory only until Phase 11F.';

create or replace function public.kyc_limit_policies_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kyc_limit_policies_set_updated_at_trg on public.kyc_limit_policies;
create trigger kyc_limit_policies_set_updated_at_trg
  before update on public.kyc_limit_policies
  for each row
  execute function public.kyc_limit_policies_set_updated_at();

alter table public.kyc_limit_policies enable row level security;

drop policy if exists "kyc_limit_policies_select_active" on public.kyc_limit_policies;
create policy "kyc_limit_policies_select_active"
  on public.kyc_limit_policies
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "kyc_limit_policies_select_admin" on public.kyc_limit_policies;
create policy "kyc_limit_policies_select_admin"
  on public.kyc_limit_policies
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "kyc_limit_policies_update_admin" on public.kyc_limit_policies;
create policy "kyc_limit_policies_update_admin"
  on public.kyc_limit_policies
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select on public.kyc_limit_policies to authenticated;
grant update on public.kyc_limit_policies to authenticated;

insert into public.kyc_limit_policies (
  kyc_status,
  funding_daily_limit,
  send_daily_limit,
  withdrawal_daily_limit,
  enforcement_mode,
  is_active
)
values
  ('approved', 10000, 5000, 5000, 'advisory', true),
  ('submitted', 500, 200, 200, 'advisory', true),
  ('under_review', 500, 200, 200, 'advisory', true),
  ('rejected', 100, 50, 50, 'advisory', true),
  ('needs_more_info', 100, 50, 50, 'advisory', true),
  ('not_started', 250, 100, 100, 'advisory', true),
  ('missing', 250, 100, 100, 'advisory', true)
on conflict (kyc_status) do update set
  funding_daily_limit = excluded.funding_daily_limit,
  send_daily_limit = excluded.send_daily_limit,
  withdrawal_daily_limit = excluded.withdrawal_daily_limit,
  enforcement_mode = excluded.enforcement_mode,
  is_active = excluded.is_active,
  updated_at = now();
