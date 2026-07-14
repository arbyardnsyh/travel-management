-- =========================================================================
-- Travel Management — Activity Logs (Enhancement Batch)
-- Audit trail for admin CRUD actions, written automatically by
-- `src/lib/activity-log.ts#logActivity()` from every `src/services/*`
-- create/update/delete function. Append-only: no update/delete policies are
-- defined below, so once written a log entry cannot be altered from the app.
-- =========================================================================

create table if not exists public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.users (id) on delete set null,
  actor_name   text,                 -- denormalized snapshot, survives actor deletion
  action       text not null,        -- create | update | soft_delete | restore | delete | status_change | login | logout
  entity       text not null,        -- table/module name, e.g. 'destinations'
  entity_id    uuid,                 -- row affected, when applicable
  description  text,                 -- short human-readable summary
  metadata     jsonb,                -- extra structured context (diffs, old/new values, etc.)
  created_at   timestamptz not null default now()
);

create index if not exists idx_activity_logs_entity on public.activity_logs (entity, entity_id);
create index if not exists idx_activity_logs_actor on public.activity_logs (actor_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;

-- Only staff (admin/editor) can write logs — matches who is allowed to
-- perform the CRUD actions being logged in the first place.
create policy "activity_logs_staff_insert" on public.activity_logs
  for insert with check (public.is_staff());

-- Only staff can read the audit trail (e.g. a future /admin/activity-log page).
create policy "activity_logs_staff_select" on public.activity_logs
  for select using (public.is_staff());

-- Intentionally no update/delete policy: logs are immutable once written.

-- =========================================================================
-- END OF 0005_activity_logs.sql
-- =========================================================================
