-- Phase 11A: KYC foundation (identity verification profiles).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql (or equivalent).
-- Idempotent: safe to re-run.
--
-- Document storage (manual setup — no bucket created here):
--   Use a private Supabase Storage bucket named "kyc-documents".
--   Store object paths in document_*_url columns; serve only via short-lived signed URLs.
--   Never use public URLs for ID documents or selfies.

create table if not exists public.kyc_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_legal_name text,
  date_of_birth date,
  country text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  document_type text,
  document_number_last4 text,
  document_front_url text,
  document_back_url text,
  selfie_url text,
  status text not null default 'not_started',
  review_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyc_profiles_user_id_unique unique (user_id),
  constraint kyc_profiles_status_ck check (
    lower(btrim(status)) in (
      'not_started',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'needs_more_info'
    )
  )
);

create index if not exists kyc_profiles_status_idx on public.kyc_profiles (lower(status));
create index if not exists kyc_profiles_created_at_idx on public.kyc_profiles (created_at desc);
create index if not exists kyc_profiles_user_id_idx on public.kyc_profiles (user_id);

comment on table public.kyc_profiles is
  'Per-user KYC / identity verification profile (RLS: own row + admin review).';
comment on column public.kyc_profiles.document_front_url is
  'Storage path in private bucket kyc-documents — signed URL access only.';
comment on column public.kyc_profiles.document_back_url is
  'Storage path in private bucket kyc-documents — signed URL access only.';
comment on column public.kyc_profiles.selfie_url is
  'Storage path in private bucket kyc-documents — signed URL access only.';

-- Minimal updated_at trigger (no project-wide helper exists yet).
create or replace function public.kyc_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kyc_profiles_set_updated_at_trg on public.kyc_profiles;
create trigger kyc_profiles_set_updated_at_trg
  before update on public.kyc_profiles
  for each row
  execute function public.kyc_profiles_set_updated_at();

alter table public.kyc_profiles enable row level security;

drop policy if exists "kyc_profiles_select_own" on public.kyc_profiles;
create policy "kyc_profiles_select_own"
  on public.kyc_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "kyc_profiles_insert_own" on public.kyc_profiles;
create policy "kyc_profiles_insert_own"
  on public.kyc_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "kyc_profiles_update_own" on public.kyc_profiles;
create policy "kyc_profiles_update_own"
  on public.kyc_profiles
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and lower(btrim(status)) <> 'approved'
  )
  with check (
    auth.uid() = user_id
    and lower(btrim(status)) <> 'approved'
  );

drop policy if exists "kyc_profiles_select_admin" on public.kyc_profiles;
create policy "kyc_profiles_select_admin"
  on public.kyc_profiles
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "kyc_profiles_update_admin" on public.kyc_profiles;
create policy "kyc_profiles_update_admin"
  on public.kyc_profiles
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert, update on public.kyc_profiles to authenticated;
