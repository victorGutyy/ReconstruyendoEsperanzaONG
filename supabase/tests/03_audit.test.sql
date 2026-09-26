-- Audit log (docs/06 §7, docs/05 §11, HU-10).
begin;
select plan(14);

-- Users, as Supabase Auth would create them (system actor)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}'),
  ('cccccccc-0000-0000-0000-000000000005', 'author2@example.test', '{"role":"author"}', '{}');

select is(
  (select count(*)::int from public.audit_logs
   where table_name = 'profiles' and action = 'insert'
     and record_id = 'bbbbbbbb-0000-0000-0000-000000000003' and actor_id is null),
  1, 'creating a profile through an invitation is logged as a system insert'
);

-- Bookkeeping-only update: no entry
update public.profiles set updated_at = now() - interval '1 day'
where id = 'bbbbbbbb-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.audit_logs where record_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  1, 'changing only updated_at does not create an entry'
);

-- Admin with MFA changes the author's role, then deactivates them
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

update public.profiles set role_id = (select id from public.roles where key = 'editor')
where id = 'bbbbbbbb-0000-0000-0000-000000000003';
update public.profiles set is_active = false
where id = 'bbbbbbbb-0000-0000-0000-000000000003';

select is(
  (select action || ' by ' || actor_id::text || ' ' || changed_fields::text
   from public.audit_logs
   where record_id = 'bbbbbbbb-0000-0000-0000-000000000003' and action = 'role_change'),
  'role_change by aaaaaaaa-0000-0000-0000-000000000001 {role_id}',
  'a role change records the action, the actor and the changed field'
);
select is(
  (select (old_data ->> 'is_active') || ' -> ' || (new_data ->> 'is_active')
   from public.audit_logs
   where record_id = 'bbbbbbbb-0000-0000-0000-000000000003' and action = 'status_change'),
  'true -> false', 'a deactivation is a status_change with before and after values'
);

-- Admin with MFA can read the log
select ok(
  (select count(*) from public.audit_logs) >= 3,
  'with MFA, an admin (audit.read) can read the audit log'
);

-- Nobody writes to the log through the API
select throws_ok(
  $$ insert into public.audit_logs (action, table_name, record_id) values ('update', 'x', '1') $$,
  '42501', null, 'the API cannot insert audit entries'
);
select throws_ok(
  $$ update public.audit_logs set action = 'update' $$,
  '42501', null, 'the API cannot edit audit entries'
);
select throws_ok(
  $$ delete from public.audit_logs $$,
  '42501', null, 'the API cannot delete audit entries'
);

-- Admin without MFA
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.audit_logs), 0, 'without MFA, even an admin cannot read the log');

-- Author (even with MFA) has no audit.read
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.audit_logs), 0, 'an author cannot read the audit log');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok('select * from public.audit_logs', '42501', null, 'anon cannot read the audit log');
reset role;

-- Append-only even for the database owner
select throws_ok(
  $$ update public.audit_logs set action = 'update' $$,
  '42501', null, 'not even the database owner can edit audit entries'
);
select throws_ok(
  $$ delete from public.audit_logs $$,
  '42501', null, 'not even the database owner can delete audit entries'
);
select throws_ok(
  $$ truncate public.audit_logs $$,
  '42501', null, 'not even the database owner can truncate the audit log'
);

select * from finish();
rollback;
