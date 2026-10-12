-- Retention (step 9.3, docs/09 §3): contact messages live 12 months, the
-- audit log 2 years. Run once a day by /api/cron/cleanup.
--
-- 1. The audit log keeps who did what to a message, never what the person
--    wrote or how to reach them: otherwise deleting the message would leave
--    its personal data forever in an append-only table.
-- 2. public.run_retention() deletes what is past its term. The audit log stays
--    append-only: only that function may delete from it, and only rows older
--    than 2 years.

-- ---------------------------------------------------------------------------
-- 1. Audit without the personal data of contact messages
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
  -- Who wrote and what they wrote (docs/09): kept only in the message itself
  v_personal text[] := case tg_table_name
    when 'contact_messages' then array['full_name', 'email', 'phone', 'message', 'ip_hash']
    else '{}'::text[]
  end;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - 'search_vector' - v_personal;
    v_action := 'insert';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old) - 'search_vector' - v_personal;
    v_action := 'delete';
  else
    v_old := to_jsonb(old) - 'search_vector' - v_personal;
    v_new := to_jsonb(new) - 'search_vector' - v_personal;

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
-- 2. The audit log stays append-only, with one way out after 2 years
-- ---------------------------------------------------------------------------
alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (action in (
  'insert', 'update', 'delete',
  'soft_delete', 'restore', 'publish', 'unpublish',
  'role_change', 'status_change',
  'retention_purge'
));

comment on table public.audit_logs is
  'Append-only audit trail written by private.audit_row_change(). Never updated; '
  'deleted only by public.run_retention() after 2 years (docs/09).';

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only public.run_retention() (it runs as the owner and raises the flag for
  -- its own transaction) and only for entries past the 2-year term
  if tg_op = 'DELETE'
     and current_setting('app.retention_purge', true) = 'on'
     and current_user = 'postgres'
     and old.occurred_at < now() - interval '2 years' then
    return old;
  end if;
  raise exception 'audit_logs is append-only: entries cannot be changed or deleted'
    using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The daily purge
-- ---------------------------------------------------------------------------
create or replace function public.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages integer;
  v_audit integer;
begin
  -- 12 months after it was handled; one never handled, 12 months after it
  -- arrived. Also in the trash.
  delete from public.contact_messages
  where coalesce(handled_at, created_at) < now() - interval '12 months';
  get diagnostics v_messages = row_count;

  perform set_config('app.retention_purge', 'on', true);
  delete from public.audit_logs where occurred_at < now() - interval '2 years';
  get diagnostics v_audit = row_count;
  perform set_config('app.retention_purge', 'off', true);

  -- A trace of each purge: counts only
  if v_messages > 0 then
    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (null, 'retention_purge', 'contact_messages', 'retention',
            jsonb_build_object('deleted', v_messages, 'older_than', '12 months'));
  end if;
  if v_audit > 0 then
    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (null, 'retention_purge', 'audit_logs', 'retention',
            jsonb_build_object('deleted', v_audit, 'older_than', '2 years'));
  end if;

  return jsonb_build_object('messages', v_messages, 'audit', v_audit);
end;
$$;

comment on function public.run_retention() is
  'Daily retention (docs/09 §3): contact messages after 12 months, audit entries after 2 years.';

-- Only the server's daily job
revoke execute on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;
