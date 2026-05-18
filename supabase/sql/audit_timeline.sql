-- Unified audit timeline (Phase 1). Append-only operational history for admins and narrow self-reads.
-- Inserts: service role (API / server helpers) bypass RLS; authenticated admins may insert with actor_user_id = auth.uid().
-- Realtime: to stream changes to clients, add this table to the `supabase_realtime` publication when ready, e.g.
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_timeline;
-- (Skip or ignore errors if the table is already a member — see supabase/sql/notifications_table.sql for the same pattern.)

create table if not exists public.audit_timeline (
  id uuid primary key default gen_random_uuid(),
  -- Allowed entity_type values (app-enforced; documented for operators):
  -- user, withdrawal, transaction, triton_transfer, fraud_case, treasury, admin_action, notification, developer_app
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  severity text not null default 'info',
  actor_user_id uuid null references auth.users (id) on delete set null,
  target_user_id uuid null references auth.users (id) on delete set null,
  title text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_timeline_severity_check check (
    severity in ('info', 'success', 'warning', 'critical')
  )
);

create index if not exists audit_timeline_entity_created_idx
  on public.audit_timeline (entity_type, entity_id, created_at desc);

create index if not exists audit_timeline_created_idx
  on public.audit_timeline (created_at desc);

create index if not exists audit_timeline_severity_idx
  on public.audit_timeline (severity);

comment on table public.audit_timeline is
  'Cross-cutting audit feed (withdrawals, triton, fraud, treasury, admin actions). RLS: admins read all; users read rows about them; inserts via service role or authenticated admins matching actor_user_id.';

alter table public.audit_timeline enable row level security;

-- Admins see everything; non-admin authenticated users see only their own scope.
create policy "audit_timeline_select"
  on public.audit_timeline
  for select
  to authenticated
  using (
    public.tc_is_admin()
    or target_user_id = auth.uid()
    or (entity_type = 'user' and entity_id = auth.uid()::text)
    or actor_user_id = auth.uid()
  );

grant select on public.audit_timeline to authenticated;
