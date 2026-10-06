-- Site settings (migration site_settings, step 8.1).
begin;
select plan(11);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}');

select is((select count(*)::int from public.site_settings), 1, 'there is exactly one settings row');
select throws_ok(
  $$ insert into public.site_settings (id, organization_name) values (false, 'Otra') $$,
  '23514', null, 'a second row cannot exist'
);

set local role anon;
select is(
  (select organization_name from public.site_settings), 'Reconstruyendo Esperanza',
  'visitors read the settings'
);
select throws_ok(
  $$ update public.site_settings set tagline = 'x' $$,
  '42501', null, 'visitors cannot change them'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.site_settings set whatsapp_number = '+573001112233';
select is(
  (select whatsapp_number from public.site_settings), null, 'an editor cannot change them'
);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
update public.site_settings set whatsapp_number = '+573001112233';
select is(
  (select whatsapp_number from public.site_settings), null, 'not even an admin without MFA'
);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ update public.site_settings
     set whatsapp_number = '+573001112233',
         social_links = '{"facebook": "https://www.facebook.com/demo"}' $$,
  'the admin with MFA edits them'
);
select is(
  (select updated_by from public.site_settings), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'the change records who made it'
);
select throws_ok(
  $$ update public.site_settings set whatsapp_number = '3001112233' $$,
  '23514', null, 'WhatsApp is stored as +57 and ten digits'
);
select throws_ok(
  $$ update public.site_settings set social_links = '{"facebook": "http://evil.example"}' $$,
  '23514', null, 'networks only take https links of known networks'
);
reset role;

select is(
  (select count(*)::int from public.audit_logs
   where table_name = 'site_settings' and action = 'update'
     and 'whatsapp_number' = any (changed_fields)),
  1, 'the change is audited'
);

select * from finish();
rollback;
