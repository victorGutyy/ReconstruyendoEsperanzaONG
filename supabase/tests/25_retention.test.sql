-- Retention (migration retention, step 9.3, docs/09 §3).
begin;
select plan(12);

-- What the server inserts after Turnstile and the rate limit
insert into public.contact_messages
  (id, full_name, email, phone, message, privacy_policy_version, consent_accepted_at, ip_hash) values
  ('c9000000-0000-0000-0000-000000000001', '[DEMO] Vecina', 'vecina@example.test', '+573001234567',
   '[DEMO] Quiero ayudar.', '1.0', now(), 'abc123');

-- 1. The audit log never keeps what the person wrote or how to reach them
select is(
  (select new_data ?| array['full_name', 'email', 'phone', 'message', 'ip_hash']
   from public.audit_logs
   where table_name = 'contact_messages' and record_id = 'c9000000-0000-0000-0000-000000000001'
     and action = 'insert'),
  false,
  'a new message is audited without its personal data'
);
select is(
  (select new_data ->> 'status' from public.audit_logs
   where table_name = 'contact_messages' and record_id = 'c9000000-0000-0000-0000-000000000001'
     and action = 'insert'),
  'new',
  'but the audit still shows its state'
);
update public.contact_messages set status = 'handled'
where id = 'c9000000-0000-0000-0000-000000000001';
select is(
  (select bool_or(coalesce(old_data, '{}') ?| array['full_name', 'email', 'message']
                  or coalesce(new_data, '{}') ?| array['full_name', 'email', 'message'])
   from public.audit_logs
   where table_name = 'contact_messages' and record_id = 'c9000000-0000-0000-0000-000000000001'),
  false,
  'changing its state keeps the personal data out of the audit too'
);
insert into public.categories (id, scope, name, slug) values
  ('c9000000-0000-0000-0000-00000000000c', 'activity', '[DEMO] Retención', 'demo-retencion');
select is(
  (select new_data ->> 'name' from public.audit_logs
   where table_name = 'categories' and record_id = 'c9000000-0000-0000-0000-00000000000c'),
  '[DEMO] Retención',
  'other tables are audited in full as before'
);

-- 2. Messages: 12 months after handled, or after arriving if never handled
insert into public.contact_messages
  (id, full_name, email, message, privacy_policy_version, consent_accepted_at, status, handled_at, created_at, deleted_at) values
  ('c9000000-0000-0000-0000-000000000002', '[DEMO] Viejo atendido', 'a@example.test', '[DEMO] a', '1.0',
   now() - interval '3 years', 'handled', now() - interval '13 months', now() - interval '3 years', null),
  ('c9000000-0000-0000-0000-000000000003', '[DEMO] Viejo sin atender', 'b@example.test', '[DEMO] b', '1.0',
   now() - interval '13 months', 'new', null, now() - interval '13 months', null),
  ('c9000000-0000-0000-0000-000000000004', '[DEMO] Atendido hace poco', 'c@example.test', '[DEMO] c', '1.0',
   now() - interval '3 years', 'handled', now() - interval '2 months', now() - interval '3 years', null),
  ('c9000000-0000-0000-0000-000000000005', '[DEMO] Viejo en la papelera', 'd@example.test', '[DEMO] d', '1.0',
   now() - interval '14 months', 'archived', null, now() - interval '14 months', now());

-- 3. Audit entries: one past 2 years, one not yet
insert into public.audit_logs (occurred_at, action, table_name, record_id) values
  (now() - interval '25 months', 'update', 'retention_test', 'old'),
  (now() - interval '23 months', 'update', 'retention_test', 'recent');

select throws_ok(
  $$ delete from public.audit_logs where table_name = 'retention_test' and record_id = 'old' $$,
  '42501', null, 'nobody deletes from the audit log by hand, not even the owner'
);
select set_config('app.retention_purge', 'on', true);
select throws_ok(
  $$ delete from public.audit_logs where table_name = 'retention_test' and record_id = 'recent' $$,
  '42501', null, 'not even with the purge flag, for an entry younger than 2 years'
);
select set_config('app.retention_purge', 'off', true);

set local role authenticated;
select throws_ok($$ select public.run_retention() $$, '42501', null, 'panel members cannot run the purge');
reset role;
set local role anon;
select throws_ok($$ select public.run_retention() $$, '42501', null, 'visitors cannot run the purge');
reset role;

select ok((public.run_retention() ->> 'messages')::int >= 3, 'the purge reports what it deleted');

select results_eq(
  $$ select id::text from public.contact_messages
     where id::text like 'c9000000-%' order by id $$,
  $$ values ('c9000000-0000-0000-0000-000000000001'), ('c9000000-0000-0000-0000-000000000004') $$,
  'old messages are gone (handled, never handled, in the trash); recent ones stay'
);
select results_eq(
  $$ select record_id from public.audit_logs where table_name = 'retention_test' $$,
  $$ values ('recent') $$,
  'audit entries past 2 years are gone; younger ones stay'
);
select ok(
  exists (select 1 from public.audit_logs
          where action = 'retention_purge' and table_name = 'contact_messages'
            and (new_data ->> 'deleted')::int >= 3),
  'each purge leaves a trace with the count only'
);

select * from finish();
rollback;
