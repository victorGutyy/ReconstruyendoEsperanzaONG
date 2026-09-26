-- Migration 3 — audit log (docs/06-modelo-datos.md §7, docs/05 §11)
-- Who changed what and when. Append-only: nobody can edit or delete entries.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- No foreign key on purpose: the log must not depend on any other table.
  -- Null = the system (e.g. Supabase Auth processing an invitation).
  actor_id uuid,
  action text not null check (action in (
    'insert', 'update', 'delete',
    'soft_delete', 'restore', 'publish', 'unpublish',
    'role_change', 'status_change'
  )),
  table_name text not null,
  record_id text not null,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] not null default '{}'
);

comment on table public.audit_logs is
  'Append-only audit trail written by private.audit_row_change(). Never updated or deleted.';

create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 2. Generic trigger: one line per table attaches it
-- ---------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[] := '{}';
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'insert';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_action := 'delete';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);

    -- Bookkeeping columns alone are noise, not a change worth auditing
    select coalesce(array_agg(n.key order by n.key), '{}')
    into v_changed
    from jsonb_each(v_new) as n
    where n.key not in ('updated_at', 'updated_by')
      and n.value is distinct from (v_old -> n.key);

    if cardinality(v_changed) = 0 then
      return null;
    end if;

    v_action := case
      when 'deleted_at' = any (v_changed) and v_old ->> 'deleted_at' is null then 'soft_delete'
      when 'deleted_at' = any (v_changed) and v_new ->> 'deleted_at' is null then 'restore'
      when 'status' = any (v_changed) and v_new ->> 'status' = 'published' then 'publish'
      when 'status' = any (v_changed) and v_old ->> 'status' = 'published' then 'unpublish'
      when 'role_id' = any (v_changed) then 'role_change'
      when 'is_active' = any (v_changed) then 'status_change'
      else 'update'
    end;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, changed_fields)
  values (
    auth.uid(),
    v_action,
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    v_old,
    v_new,
    v_changed
  );

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Append-only, even for the database owner
-- ---------------------------------------------------------------------------
create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only: entries cannot be changed or deleted'
    using errcode = '42501';
end;
$$;

create trigger prevent_update_delete before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();
create trigger prevent_truncate before truncate on public.audit_logs
  for each statement execute function private.prevent_audit_mutation();

revoke execute on function private.audit_row_change() from public, anon, authenticated;
revoke execute on function private.prevent_audit_mutation() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row level security: read-only for audit.read + MFA
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy "With MFA, audit readers can read the audit log"
  on public.audit_logs for select to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('audit.read')));

grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Audited tables
-- ---------------------------------------------------------------------------
create trigger audit_row_change after insert or update or delete on public.profiles
  for each row execute function private.audit_row_change();
