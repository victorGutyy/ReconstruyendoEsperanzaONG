-- Taxonomy: places, categories and tags (migration taxonomy, step 6.1, docs/06 §4 and §10).
begin;
select plan(24);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

-- Rows loaded directly (like the organization would from the panel)
insert into public.places (id, name, slug, kind) values
  ('11111111-0000-0000-0000-000000000001', '[DEMO] Barrio Centro', 'demo-barrio-centro', 'neighborhood');
insert into public.places (name, slug, kind, deleted_at) values
  ('[DEMO] Vereda borrada', 'demo-vereda-borrada', 'vereda', now());

-- ---------------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------------
set local role anon;
select is(
  (select array_agg(slug order by slug) from public.places),
  array['demo-barrio-centro'], 'visitors read places that are not in the trash'
);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('x', 'x', 'other') $$,
  '42501', null, 'visitors cannot add places'
);
reset role;

-- ---------------------------------------------------------------------------
-- Author (even with MFA) and editor without MFA cannot write
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('x', 'x', 'other') $$,
  '42501', null, 'an author cannot add places'
);
select is(
  (select count(*)::int from public.places), 1, 'an author does not see the trash'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('x', 'x', 'other') $$,
  '42501', null, 'an editor without MFA cannot add places'
);

-- ---------------------------------------------------------------------------
-- Editor with MFA manages the taxonomy
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.places (name, slug, kind)
     values ('[DEMO] Vereda La Ñ', 'demo-vereda-la-n', 'vereda') $$,
  'an editor with MFA adds a place'
);
-- The API cannot choose ids: remember the generated one
select set_config('test.place_id',
  (select id::text from public.places where slug = 'demo-vereda-la-n'), true);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('Otro', 'demo-vereda-la-n', 'vereda') $$,
  '23505', null, 'slugs are unique'
);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('Mal', 'Mal Slug', 'vereda') $$,
  '23514', null, 'a slug must be lowercase letters, numbers and hyphens'
);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('Casa', 'casa', 'address') $$,
  '23514', null, 'only general kinds of places are accepted'
);
select throws_ok(
  $$ insert into public.places (name, slug, kind) values ('   ', 'vacio', 'other') $$,
  '23514', null, 'a place needs a name'
);
select throws_ok(
  $$ update public.places set slug = 'otro-slug' where id = current_setting('test.place_id')::uuid $$,
  '42501', null, 'the slug cannot change after creation'
);

select lives_ok(
  $$ update public.places set name = '[DEMO] Vereda La Ñ (alta)', is_active = false
     where id = current_setting('test.place_id')::uuid $$,
  'an editor renames and deactivates a place'
);
select is(
  (select slug from public.places where id = current_setting('test.place_id')::uuid),
  'demo-vereda-la-n', 'renaming keeps the slug'
);

-- Trash: the editor still sees it (to restore it); the slug becomes free
select lives_ok(
  $$ update public.places set deleted_at = now() where id = current_setting('test.place_id')::uuid $$,
  'an editor sends a place to the trash'
);
select is(
  (select count(*)::int from public.places where deleted_at is not null), 2,
  'an editor with MFA sees the trash'
);
select lives_ok(
  $$ insert into public.places (name, slug, kind) values ('[DEMO] Vereda nueva', 'demo-vereda-la-n', 'vereda') $$,
  'a slug in the trash can be reused'
);

-- Only trash.purge deletes for real: for the editor the delete touches no row
delete from public.places where id = current_setting('test.place_id')::uuid;
select is(
  (select count(*)::int from public.places where id = current_setting('test.place_id')::uuid), 1,
  'an editor cannot delete a place for real'
);

-- Categories: same slug allowed in different scopes, not in the same one
select lives_ok(
  $$ insert into public.categories (scope, name, slug, position) values
       ('activity', '[DEMO] Salud', 'demo-salud', 1),
       ('post', '[DEMO] Salud', 'demo-salud', 1) $$,
  'the same slug can exist in activities and posts'
);
select throws_ok(
  $$ insert into public.categories (scope, name, slug) values ('activity', 'Otra', 'demo-salud') $$,
  '23505', null, 'a slug is unique within its scope'
);
select throws_ok(
  $$ insert into public.categories (scope, name, slug) values ('page', 'X', 'x') $$,
  '23514', null, 'categories only exist for activities and posts'
);

-- Tags
select lives_ok(
  $$ insert into public.tags (name, slug) values ('[DEMO] Niñez', 'demo-ninez') $$,
  'an editor adds a tag'
);

-- Admin (trash.purge) deletes for real
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
delete from public.places where id = current_setting('test.place_id')::uuid;
select is(
  (select count(*)::int from public.places where id = current_setting('test.place_id')::uuid), 0,
  'an admin (trash.purge) deletes a place for real'
);
reset role;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(action order by id) from public.audit_logs
   where table_name = 'places' and record_id = current_setting('test.place_id')),
  array['insert', 'status_change', 'soft_delete', 'delete'],
  'creating, deactivating, trashing and deleting a place are audited'
);
select is(
  (select count(distinct actor_id)::int from public.audit_logs
   where table_name = 'places' and record_id = current_setting('test.place_id')
     and actor_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  1, 'the audit log names the editor as the actor'
);

select * from finish();
rollback;
