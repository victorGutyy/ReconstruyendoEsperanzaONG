-- Projects on the shared content engine (migration content_projects, step 7.6b).
begin;
select plan(15);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Huerta', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Niños', null, 'bbbbbbbb-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- Author: writes a draft project, links an activity to it
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.projects (slug, title) values ('demo-huertas', '[DEMO] Huertas') $$,
  'an author writes a draft project'
);
select is(
  (select project_status || ' · ' || status::text from public.projects where slug = 'demo-huertas'),
  'planned · draft', 'a new project is planned and a draft'
);
select throws_ok(
  $$ update public.projects set start_date = '2026-05-01', end_date = '2026-04-01'
     where slug = 'demo-huertas' $$,
  '23514', null, 'the end cannot come before the start'
);
select throws_ok(
  $$ update public.projects set project_status = 'finished' where slug = 'demo-huertas' $$,
  '23514', null, 'only the four project states exist'
);
select throws_ok(
  $$ update public.projects set status = 'published' where slug = 'demo-huertas' $$,
  '42501', null, 'an author cannot publish'
);
select lives_ok(
  $$ insert into public.activities (slug, title, starts_at, project_id)
     values ('demo-siembra', '[DEMO] Siembra', now(),
             (select id from public.projects where slug = 'demo-huertas')) $$,
  'an activity can belong to a project that is still a draft'
);
update public.projects
set status = 'review', cover_media_id = 'd0000000-0000-0000-0000-000000000002'
where slug = 'demo-huertas';

-- ---------------------------------------------------------------------------
-- Editor: same rules as the other content
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.projects set status = 'published' where slug = 'demo-huertas' $$,
  '23514', null, 'a project without summary cannot be published'
);
update public.projects set summary = '[DEMO] Huertas en tres veredas' where slug = 'demo-huertas';
select throws_ok(
  $$ update public.projects set status = 'published' where slug = 'demo-huertas' $$,
  '23514', 'media_not_publishable', 'a cover that is not publishable blocks publishing'
);
update public.projects set cover_media_id = 'd0000000-0000-0000-0000-000000000001'
where slug = 'demo-huertas';
select lives_ok(
  $$ update public.projects set status = 'published', project_status = 'active'
     where slug = 'demo-huertas' $$,
  'an editor publishes a complete project'
);
select throws_ok(
  $$ update public.projects set slug = 'demo-otro' where slug = 'demo-huertas' $$,
  '23514', null, 'the slug is frozen once published'
);
insert into public.projects (slug, title) values ('demo-borrador', '[DEMO] Borrador');

set local role anon;
select is(
  (select array_agg(slug order by slug) from public.projects),
  array['demo-huertas'], 'visitors only see the published project'
);
reset role;

-- ---------------------------------------------------------------------------
-- Public photos, activities of a project, audit
-- ---------------------------------------------------------------------------
select is(
  (select entity_type || ':' || usage from public.content_media_usages
   where media_id = 'd0000000-0000-0000-0000-000000000001'),
  'project:cover', 'the cover of a project counts as a use of the photo'
);
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  true, 'the cover of a published project must be public'
);
select is(
  (select count(*)::int from public.activities a
   join public.projects p on p.id = a.project_id where p.slug = 'demo-huertas'),
  1, 'the project knows its activities'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'projects' and action = 'publish'),
  1, 'the publication is audited'
);

select * from finish();
rollback;
