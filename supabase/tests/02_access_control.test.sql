-- Access control: roles, permissions, profiles and RLS (docs/06 §3 and §10).
begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.roles), 3, 'there are 3 roles');
select is((select count(*)::int from public.permissions), 17, 'there are 17 permissions');

select is(
  (select count(*)::int from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.key = 'admin'),
  17, 'admin has all 17 permissions'
);
select is(
  (select count(*)::int from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.key = 'editor'),
  12, 'editor has 12 permissions'
);
select is(
  (select count(*)::int from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.key = 'author'),
  4, 'author has 4 permissions'
);

-- ---------------------------------------------------------------------------
-- Invitation trigger (as postgres, like Supabase Auth would insert)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test',
   '{"role":"admin","full_name":"[DEMO] Admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test',
   '{"role":"editor","invited_by":"aaaaaaaa-0000-0000-0000-000000000001"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test',
   '{"role":"author"}', '{}'),
  ('ffffffff-0000-0000-0000-000000000004', 'forged@example.test',
   '{}', '{"role":"admin"}');

select is(
  (select r.key from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'editor', 'the invite trigger creates the profile with the role from app_metadata'
);
select is(
  (select invited_by from public.profiles where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'the inviter is recorded'
);
select is(
  (select full_name from public.profiles where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'editor', 'without full_name the profile uses the e-mail local part'
);
select is(
  (select role_id from public.profiles where id = 'ffffffff-0000-0000-0000-000000000004'),
  null, 'a role placed in user_metadata (editable by the user) is ignored'
);

-- Real Supabase Auth flow: the user is inserted first, app_metadata arrives later
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000005', 'two-step@example.test', '{"provider":"email"}', '{}');
update auth.users
set raw_app_meta_data = '{"provider":"email","role":"author","full_name":"[DEMO] Dos pasos"}'
where id = 'cccccccc-0000-0000-0000-000000000005';

select is(
  (select r.key || ' / ' || p.full_name from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = 'cccccccc-0000-0000-0000-000000000005'),
  'author / [DEMO] Dos pasos', 'role and name arriving in a later app_metadata update are applied'
);

-- Once a role exists, app_metadata can no longer change it (bypass protection)
update auth.users
set raw_app_meta_data = '{"provider":"email","role":"admin"}'
where id = 'cccccccc-0000-0000-0000-000000000005';

select is(
  (select r.key from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = 'cccccccc-0000-0000-0000-000000000005'),
  'author', 'a later app_metadata change cannot override an assigned role'
);
select is((select count(*)::int from public.profiles), 5, 'one profile per auth user');

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.roles', '42501', null, 'anon cannot read roles');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok($$ select private.has_permission('users.manage') $$, '42501', null,
  'anon cannot call the private helpers');
reset role;

-- ---------------------------------------------------------------------------
-- Author
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select is((select count(*)::int from public.profiles), 1, 'an author only sees their own profile');
select ok(private.has_permission('content.create'), 'an author can create content');
select ok(not private.has_permission('content.publish'), 'an author cannot publish');
select throws_ok(
  $$ update public.profiles set role_id = (select id from public.roles where key = 'admin')
     where id = 'bbbbbbbb-0000-0000-0000-000000000003' $$,
  '42501', null, 'an author cannot change their own role'
);

update public.profiles set full_name = '[DEMO] Autor'
where id = 'bbbbbbbb-0000-0000-0000-000000000003';
select is(
  (select full_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  '[DEMO] Autor', 'with MFA, a user can change their own name'
);

-- Tries to promote someone else: RLS hides the row, nothing changes
update public.profiles set role_id = (select id from public.roles where key = 'admin')
where id = 'eeeeeeee-0000-0000-0000-000000000002';
reset role;
select is(
  (select r.key from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'editor', 'an author cannot change another user''s role'
);

-- ---------------------------------------------------------------------------
-- Admin without MFA (aal1)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.profiles), 1,
  'without MFA, even an admin only sees their own profile');

-- ---------------------------------------------------------------------------
-- Admin with MFA (aal2)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.profiles), 5, 'with MFA, an admin sees every profile');

select lives_ok(
  $$ update public.profiles set role_id = (select id from public.roles where key = 'author')
     where id = 'eeeeeeee-0000-0000-0000-000000000002' $$,
  'with MFA, an admin can change another user''s role'
);
select is(
  (select r.key from public.profiles p join public.roles r on r.id = p.role_id
   where p.id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'author', 'the role change is saved'
);
select throws_ok(
  $$ update public.profiles set is_active = false where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501', null, 'an admin cannot deactivate themselves'
);
select throws_ok(
  $$ insert into public.profiles (id, full_name) values ('ffffffff-0000-0000-0000-000000000009', 'x') $$,
  '42501', null, 'profiles cannot be inserted through the API'
);
select throws_ok(
  $$ delete from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000003' $$,
  '42501', null, 'profiles cannot be deleted (deactivate instead)'
);

update public.profiles set is_active = false where id = 'bbbbbbbb-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- Deactivated user
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select ok(not private.has_permission('content.create'), 'a deactivated user has no permissions');
select ok(not private.has_permission('content.read'), 'a deactivated user cannot even read content');
reset role;

select * from finish();
rollback;
