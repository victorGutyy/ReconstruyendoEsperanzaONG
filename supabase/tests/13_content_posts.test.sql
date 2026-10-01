-- Stories on the shared content engine (migration content_posts, step 7.6a).
begin;
select plan(18);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.categories (id, scope, name, slug) values
  ('22222222-0000-0000-0000-000000000001', 'post', '[DEMO] Historias', 'demo-historias'),
  ('22222222-0000-0000-0000-000000000002', 'activity', '[DEMO] Jornada', 'demo-jornada');
insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Huerta', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Niños', null, 'bbbbbbbb-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- Author: writes a draft and sends it to review; cannot publish
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.posts (slug, title) values ('demo-la-huerta', '[DEMO] La huerta') $$,
  'an author writes a draft story'
);
select is(
  (select status::text || ' by ' || created_by::text from public.posts where slug = 'demo-la-huerta'),
  'draft by bbbbbbbb-0000-0000-0000-000000000003', 'it starts as a draft owned by the author'
);
select throws_ok(
  $$ update public.posts set status = 'published' where slug = 'demo-la-huerta' $$,
  '42501', null, 'an author cannot publish'
);
select throws_ok(
  $$ update public.posts set category_id = '22222222-0000-0000-0000-000000000002'
     where slug = 'demo-la-huerta' $$,
  '23514', null, 'an activity category cannot be used for a story'
);
select lives_ok(
  $$ update public.posts set status = 'review', cover_media_id = 'd0000000-0000-0000-0000-000000000002'
     where slug = 'demo-la-huerta' $$,
  'an author sends it to review with a cover'
);

-- ---------------------------------------------------------------------------
-- Editor: same rules as activities
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.posts set status = 'draft' where slug = 'demo-la-huerta' $$,
  '23514', 'review_note_required', 'returning a story needs a note too'
);
select throws_ok(
  $$ update public.posts set status = 'published' where slug = 'demo-la-huerta' $$,
  '23514', null, 'a story without category and excerpt cannot be published'
);
update public.posts
set category_id = '22222222-0000-0000-0000-000000000001', excerpt = '[DEMO] Sembramos juntos'
where slug = 'demo-la-huerta';
select throws_ok(
  $$ update public.posts set status = 'published' where slug = 'demo-la-huerta' $$,
  '23514', 'media_not_publishable', 'a cover that is not publishable blocks publishing'
);
update public.posts set cover_media_id = 'd0000000-0000-0000-0000-000000000001'
where slug = 'demo-la-huerta';
select lives_ok(
  $$ update public.posts set status = 'published' where slug = 'demo-la-huerta' $$,
  'an editor publishes a complete story'
);
select ok(
  (select published_at <= now() from public.posts where slug = 'demo-la-huerta'),
  'publishing sets the date'
);
select throws_ok(
  $$ update public.posts set slug = 'demo-otra' where slug = 'demo-la-huerta' $$,
  '23514', null, 'the slug is frozen once published'
);
insert into public.posts (slug, title) values ('demo-borrador', '[DEMO] Borrador');

-- ---------------------------------------------------------------------------
-- Author after publication; visitors
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is_empty(
  $$ update public.posts set title = '[DEMO] Cambio' where slug = 'demo-la-huerta' returning id $$,
  'an author cannot edit a published story'
);

set local role anon;
select is(
  (select array_agg(slug order by slug) from public.posts),
  array['demo-la-huerta'], 'visitors only see the published story'
);
reset role;

-- ---------------------------------------------------------------------------
-- Public photos follow published content of any type
-- ---------------------------------------------------------------------------
select is(
  (select entity_type || ':' || usage from public.content_media_usages
   where media_id = 'd0000000-0000-0000-0000-000000000001'),
  'post:cover', 'the cover of a story counts as a use of the photo'
);
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  true, 'the cover of a published story must be public'
);
select is(
  (select action from public.audit_logs
   where table_name = 'posts' order by id desc limit 1),
  'insert', 'changes to stories are audited'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.posts set status = 'archived' where slug = 'demo-la-huerta';
reset role;
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  false, 'archiving the story takes its cover out'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'posts' and action = 'publish'),
  1, 'the publication is recorded as such'
);

select * from finish();
rollback;
