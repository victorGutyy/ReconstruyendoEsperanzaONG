-- Tags of stories (migration post_tags, step 8.3).
begin;
select plan(8);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.categories (id, scope, name, slug) values
  ('ca000000-0000-0000-0000-000000000001', 'post', '[DEMO] Voces', 'demo-voces');
insert into public.tags (id, name, slug) values
  ('7a000000-0000-0000-0000-000000000001', '[DEMO] Agua', 'demo-agua'),
  ('7a000000-0000-0000-0000-000000000002', '[DEMO] Niñez', 'demo-ninez');
insert into public.posts (id, slug, title, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'demo-borrador', '[DEMO] Borrador',
   'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.posts (id, slug, title, excerpt, category_id, status, published_at, created_by) values
  ('b0000000-0000-0000-0000-000000000002', 'demo-publicada', '[DEMO] Publicada', '[DEMO] Extracto',
   'ca000000-0000-0000-0000-000000000001', 'published', now() - interval '1 day',
   'bbbbbbbb-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.post_tags (post_id, tag_id)
     values ('b0000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000001') $$,
  'an author tags their draft'
);
select throws_ok(
  $$ insert into public.post_tags (post_id, tag_id)
     values ('b0000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'an author cannot tag a published story'
);
select throws_ok(
  $$ insert into public.post_tags (post_id, tag_id)
     values ('b0000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000001') $$,
  '23505', null, 'a tag is only once per story'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ insert into public.post_tags (post_id, tag_id)
     values ('b0000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000002') $$,
  'an editor tags a published story'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
delete from public.post_tags;
reset role;
select is((select count(*)::int from public.post_tags), 2, 'without MFA nothing is removed');

set local role anon;
select is(
  (select array_agg(t.name order by t.name)
   from public.post_tags pt join public.tags t on t.id = pt.tag_id),
  array['[DEMO] Niñez'], 'visitors only see the tags of published stories'
);
select throws_ok(
  $$ insert into public.post_tags (post_id, tag_id)
     values ('b0000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'visitors cannot tag'
);
reset role;

select is(
  (select count(*)::int from public.audit_logs where table_name = 'post_tags' and action = 'insert'),
  2, 'every tag change is audited'
);

select * from finish();
rollback;
