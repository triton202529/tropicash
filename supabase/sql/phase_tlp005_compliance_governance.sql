-- TLP-005: Compliance & governance readiness — AML cases, screening, incidents, account action audit.
-- Depends on public.tc_is_admin() and account_security_status.
-- Admin-only RLS; no client write access.

-- ---------------------------------------------------------------------------
-- 1) Sanctions / PEP screening results (provider-agnostic)
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_screening_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  screening_type text not null,
  provider text not null default 'manual',
  status text not null default 'pending_review',
  subject_name text,
  subject_data jsonb not null default '{}'::jsonb,
  match_details jsonb not null default '{}'::jsonb,
  provider_reference text,
  screened_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  override_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_screening_type_ck check (screening_type in ('sanctions', 'pep')),
  constraint compliance_screening_status_ck check (
    status in ('pending_review', 'approved', 'rejected', 'manual_override')
  )
);

create index if not exists compliance_screening_user_idx on public.compliance_screening_results (user_id);
create index if not exists compliance_screening_status_idx on public.compliance_screening_results (status);
create index if not exists compliance_screening_type_idx on public.compliance_screening_results (screening_type);
create index if not exists compliance_screening_screened_at_idx on public.compliance_screening_results (screened_at desc);

comment on table public.compliance_screening_results is
  'Provider-agnostic sanctions/PEP screening queue (TLP-005). Admin review required.';

-- ---------------------------------------------------------------------------
-- 2) AML / suspicious activity cases
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_aml_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  case_type text not null default 'investigation',
  status text not null default 'open',
  priority text not null default 'normal',
  title text not null,
  summary text,
  suspicion_summary text,
  related_transaction_ids jsonb not null default '[]'::jsonb,
  recommended_account_action text,
  sar_filing_reference text,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  escalated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_aml_case_type_ck check (
    case_type in (
      'suspicious_activity',
      'transaction_monitoring',
      'sanctions_escalation',
      'pep_escalation',
      'investigation'
    )
  ),
  constraint compliance_aml_case_status_ck check (
    status in ('open', 'under_review', 'escalated', 'sar_draft', 'sar_filed', 'closed', 'dismissed')
  ),
  constraint compliance_aml_case_priority_ck check (
    priority in ('low', 'normal', 'high', 'critical')
  ),
  constraint compliance_aml_recommended_action_ck check (
    recommended_account_action is null
    or recommended_account_action in ('none', 'watch', 'restrict', 'freeze', 'suspend_transactions')
  )
);

create index if not exists compliance_aml_cases_status_idx on public.compliance_aml_cases (status);
create index if not exists compliance_aml_cases_priority_idx on public.compliance_aml_cases (priority);
create index if not exists compliance_aml_cases_user_idx on public.compliance_aml_cases (user_id);
create index if not exists compliance_aml_cases_updated_idx on public.compliance_aml_cases (updated_at desc);

create table if not exists public.compliance_aml_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.compliance_aml_cases (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  note text not null,
  note_type text not null default 'admin_note',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint compliance_aml_case_notes_type_ck check (
    note_type in ('admin_note', 'status_change', 'escalation', 'sar_note', 'resolution')
  )
);

create index if not exists compliance_aml_case_notes_case_idx on public.compliance_aml_case_notes (case_id);

-- ---------------------------------------------------------------------------
-- 3) Operational compliance incidents
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null,
  classification text,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  description text,
  affected_user_id uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_summary text,
  post_incident_review text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_incidents_severity_ck check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint compliance_incidents_status_ck check (
    status in ('open', 'investigating', 'mitigated', 'resolved', 'closed')
  )
);

create index if not exists compliance_incidents_status_idx on public.compliance_incidents (status);
create index if not exists compliance_incidents_severity_idx on public.compliance_incidents (severity);

create table if not exists public.compliance_incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.compliance_incidents (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  note text not null,
  note_type text not null default 'investigation',
  created_at timestamptz not null default now(),
  constraint compliance_incident_notes_type_ck check (
    note_type in ('investigation', 'status_change', 'resolution', 'post_incident')
  )
);

create index if not exists compliance_incident_notes_incident_idx on public.compliance_incident_notes (incident_id);

-- ---------------------------------------------------------------------------
-- 4) Account control action audit (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_account_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  admin_user_id uuid not null references auth.users (id) on delete set null,
  action_type text not null,
  previous_status text,
  new_status text,
  reason text not null,
  aml_case_id uuid references public.compliance_aml_cases (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint compliance_account_action_type_ck check (
    action_type in (
      'restrict',
      'freeze',
      'unfreeze',
      'suspend_transactions',
      'restore_access',
      'watch'
    )
  )
);

create index if not exists compliance_account_actions_user_idx on public.compliance_account_actions (user_id);
create index if not exists compliance_account_actions_created_idx on public.compliance_account_actions (created_at desc);

-- ---------------------------------------------------------------------------
-- 5) RLS — admin only
-- ---------------------------------------------------------------------------

alter table public.compliance_screening_results enable row level security;
alter table public.compliance_aml_cases enable row level security;
alter table public.compliance_aml_case_notes enable row level security;
alter table public.compliance_incidents enable row level security;
alter table public.compliance_incident_notes enable row level security;
alter table public.compliance_account_actions enable row level security;

drop policy if exists "compliance_screening_admin_all" on public.compliance_screening_results;
create policy "compliance_screening_admin_all"
  on public.compliance_screening_results for all to authenticated
  using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "compliance_aml_cases_admin_all" on public.compliance_aml_cases;
create policy "compliance_aml_cases_admin_all"
  on public.compliance_aml_cases for all to authenticated
  using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "compliance_aml_case_notes_admin_all" on public.compliance_aml_case_notes;
create policy "compliance_aml_case_notes_admin_all"
  on public.compliance_aml_case_notes for all to authenticated
  using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "compliance_incidents_admin_all" on public.compliance_incidents;
create policy "compliance_incidents_admin_all"
  on public.compliance_incidents for all to authenticated
  using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "compliance_incident_notes_admin_all" on public.compliance_incident_notes;
create policy "compliance_incident_notes_admin_all"
  on public.compliance_incident_notes for all to authenticated
  using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "compliance_account_actions_admin_select" on public.compliance_account_actions;
create policy "compliance_account_actions_admin_select"
  on public.compliance_account_actions for select to authenticated
  using (public.tc_is_admin());

drop policy if exists "compliance_account_actions_admin_insert" on public.compliance_account_actions;
create policy "compliance_account_actions_admin_insert"
  on public.compliance_account_actions for insert to authenticated
  with check (public.tc_is_admin());

grant select, insert, update on public.compliance_screening_results to authenticated;
grant select, insert, update on public.compliance_aml_cases to authenticated;
grant select, insert on public.compliance_aml_case_notes to authenticated;
grant select, insert, update on public.compliance_incidents to authenticated;
grant select, insert on public.compliance_incident_notes to authenticated;
grant select, insert on public.compliance_account_actions to authenticated;
