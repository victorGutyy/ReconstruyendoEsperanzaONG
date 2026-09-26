-- E-mail copy in profiles (migration profiles_email, step 5.6).
begin;
select plan(6);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('dddddddd-0000-0000-0000-000000000006', 'invited@example.test', '{"provider":"email"}', '{}');

select is(
  (select email from public.profiles where id = 'dddddddd-0000-0000-0000-000000000006'),
  'invited@example.test', 'the profile stores the e-mail on creation'
);

-- The invitation flow: name and inviter arrive in app_metadata, without a role
update auth.users
set raw_app_meta_data = '{"provider":"email","full_name":"[DEMO] Invitada","invited_by":"aaaaaaaa-0000-0000-0000-000000000001"}'
where id = 'dddddddd-0000-0000-0000-000000000006';

select is(
  (select full_name || ' / ' || invited_by::text from public.profiles
   where id = 'dddddddd-0000-0000-0000-000000000006'),
  '[DEMO] Invitada / aaaaaaaa-0000-0000-0000-000000000001',
  'name and inviter from app_metadata are applied while the profile has no role'
);
select is(
  (select role_id from public.profiles where id = 'dddddddd-0000-0000-0000-000000000006'),
  null, 'without a role in app_metadata the profile keeps no role'
);

-- E-mail changes in Supabase Auth are mirrored
update auth.users set email = 'renamed@example.test'
where id = 'dddddddd-0000-0000-0000-000000000006';
select is(
  (select email from public.profiles where id = 'dddddddd-0000-0000-0000-000000000006'),
  'renamed@example.test', 'an e-mail change in auth.users is copied to the profile'
);

-- The e-mail is not writable through the API
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ update public.profiles set email = 'x@example.test' where id = 'dddddddd-0000-0000-0000-000000000006' $$,
  '42501', null, 'the e-mail cannot be changed through the API'
);
select is(
  (select email from public.profiles where id = 'dddddddd-0000-0000-0000-000000000006'),
  'renamed@example.test', 'a manager with MFA can read the e-mail'
);
reset role;

select * from finish();
rollback;
