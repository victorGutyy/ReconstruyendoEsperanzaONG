-- Contact messages (migration contact_messages, step 8.7).
begin;
select plan(11);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

-- What the server inserts after Turnstile and the rate limit
insert into public.contact_messages
  (id, full_name, email, message, privacy_policy_version, consent_accepted_at, ip_hash) values
  ('c0000000-0000-0000-0000-000000000001', '[DEMO] Vecina', 'vecina@example.test',
   '[DEMO] Quiero ayudar los sábados.', '1.0', now(), 'abc123');

select throws_ok(
  $$ insert into public.contact_messages (full_name, message, privacy_policy_version, consent_accepted_at)
     values ('[DEMO] Sin datos', '[DEMO] Hola', '1.0', now()) $$,
  '23514', null, 'a message needs an e-mail or a phone to answer it'
);

set local role anon;
select throws_ok(
  $$ insert into public.contact_messages (full_name, email, message, privacy_policy_version, consent_accepted_at)
     values ('[DEMO] Bot', 'bot@example.test', 'spam', '1.0', now()) $$,
  '42501', null, 'visitors cannot write messages through the API (Turnstile is skipped there)'
);
select throws_ok(
  $$ select count(*) from public.contact_messages $$,
  '42501', null, 'visitors cannot even query the messages'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.contact_messages where id = 'c0000000-0000-0000-0000-000000000001'), 0, 'an author reads no messages');
select throws_ok(
  $$ insert into public.contact_messages (full_name, email, message, privacy_policy_version, consent_accepted_at)
     values ('[DEMO] Autor', 'a@example.test', 'hola', '1.0', now()) $$,
  '42501', null, 'members cannot write messages either'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.contact_messages where id = 'c0000000-0000-0000-0000-000000000001'), 0, 'not even an editor without MFA');

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.contact_messages where id = 'c0000000-0000-0000-0000-000000000001'), 1, 'an editor with MFA reads them');
update public.contact_messages set status = 'handled' where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select handled_by::text || ' ' || (handled_at is not null)::text from public.contact_messages
   where id = 'c0000000-0000-0000-0000-000000000001'),
  'eeeeeeee-0000-0000-0000-000000000002 true',
  'handling it records who and when'
);
select throws_ok(
  $$ update public.contact_messages set message = 'cambiado' where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the message itself never changes'
);
update public.contact_messages set deleted_at = now() where id = 'c0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ update public.contact_messages set deleted_at = null where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'an editor cannot take it out of the trash'
);
reset role;

select is(
  (select count(*)::int from public.audit_logs
   where table_name = 'contact_messages' and record_id = 'c0000000-0000-0000-0000-000000000001'),
  3, 'arrival, handling and trash are audited'
);

select * from finish();
rollback;
