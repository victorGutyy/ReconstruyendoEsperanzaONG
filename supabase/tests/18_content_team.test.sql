-- Team members (migration content_team, step 7.6d).
begin;
select plan(13);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.consent_records (id, subject_name, is_minor, minor_opinion, signer_type,
  signer_name, scope_description, granted_on, channel, form_version, document_path) values
  ('c0000000-0000-0000-0000-000000000001', '[DEMO] Ana', false, null, 'self', null,
   'Perfil del equipo', '2026-01-10', 'paper', 'v1', 'a.webp'),
  ('c0000000-0000-0000-0000-000000000002', '[DEMO] Niño', true, 'agrees', 'legal_guardian',
   '[DEMO] Madre', 'Perfil', '2026-01-10', 'paper', 'v1', 'b.webp');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ insert into public.team_members (full_name, role_title) values ('[DEMO] Ana', 'Coordinadora') $$,
  '42501', null, 'an author cannot add team profiles'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ insert into public.team_members (full_name, role_title, position)
     values ('[DEMO] Ana Pérez', 'Coordinadora', 1) $$,
  'a draft profile may still lack the authorization'
);
select is(
  (select consent_withdrawn from public.team_members where full_name = '[DEMO] Ana Pérez'),
  true, 'without authorization it counts as not usable'
);
select throws_ok(
  $$ update public.team_members set status = 'published' where full_name = '[DEMO] Ana Pérez' $$,
  '23514', 'consent_not_valid', 'it cannot be published without an authorization'
);
select throws_ok(
  $$ update public.team_members set consent_record_id = 'c0000000-0000-0000-0000-000000000002'
     where full_name = '[DEMO] Ana Pérez' $$,
  '23514', 'consent_is_minor', 'minors are not allowed'
);
select throws_ok(
  $$ update public.team_members set bio = repeat('a', 601) where full_name = '[DEMO] Ana Pérez' $$,
  '23514', null, 'the bio is short plain text'
);
update public.team_members set consent_record_id = 'c0000000-0000-0000-0000-000000000001'
where full_name = '[DEMO] Ana Pérez';
select lives_ok(
  $$ update public.team_members set status = 'published' where full_name = '[DEMO] Ana Pérez' $$,
  'with a usable authorization the profile is published'
);
select throws_ok(
  $$ update public.team_members set consent_record_id = null where full_name = '[DEMO] Ana Pérez' $$,
  '23514', null, 'a published profile cannot drop its authorization'
);

set local role anon;
select is(
  (select array_agg(full_name) from public.team_members),
  array['[DEMO] Ana Pérez'], 'visitors see the published profile'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.consent_records set revoked_at = now(), revocation_note = '[DEMO] Se retiró'
where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select consent_withdrawn from public.team_members where full_name = '[DEMO] Ana Pérez'),
  true, 'revoking the authorization is copied to the profile'
);
set local role anon;
select is_empty($$ select 1 from public.team_members $$, 'visitors no longer see it');
reset role;

select is(
  (select private.content_is_published('team_member', id) from public.team_members
   where full_name = '[DEMO] Ana Pérez'),
  false, 'its photo would leave the site too'
);
select ok(
  (select count(*) from public.audit_logs where table_name = 'team_members') >= 3,
  'team profiles are audited'
);

select * from finish();
rollback;
