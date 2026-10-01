-- Galleries on the shared content engine (migration content_galleries, step 7.6c).
begin;
select plan(16);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Huerta', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Niños', null, 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000003', 'ready', 'p/3', 'Semillas', 'none', 'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.activities (id, slug, title, starts_at) values
  ('a0000000-0000-0000-0000-000000000001', 'demo-siembra', '[DEMO] Siembra', now());
insert into public.projects (id, slug, title) values
  ('c1000000-0000-0000-0000-000000000001', 'demo-huertas', '[DEMO] Huertas');
-- Fixed ids for the test (the API cannot choose ids)
insert into public.galleries (id, slug, title, activity_id, created_by) values
  ('f0000000-0000-0000-0000-000000000001', 'demo-galeria', '[DEMO] Galería',
   'a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('f0000000-0000-0000-0000-000000000002', 'demo-vacia', '[DEMO] Vacía',
   null, 'eeeeeeee-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Author: builds a draft gallery with its photos; cannot publish
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.galleries (slug, title, activity_id, project_id)
     values ('demo-doble', '[DEMO] Doble', 'a0000000-0000-0000-0000-000000000001',
             'c1000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'a gallery belongs to an activity or a project, not both'
);
select lives_ok(
  $$ insert into public.galleries (slug, title, project_id)
     values ('demo-otra', '[DEMO] Otra', 'c1000000-0000-0000-0000-000000000001') $$,
  'an author creates a draft gallery of a project'
);
select lives_ok(
  $$ insert into public.gallery_items (gallery_id, media_id, position) values
       ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1),
       ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 2) $$,
  'the author adds photos, even one that still needs something'
);
select throws_ok(
  $$ insert into public.gallery_items (gallery_id, media_id, position) values
       ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 3) $$,
  '23505', null, 'the same photo cannot be twice in a gallery'
);
select throws_ok(
  $$ update public.galleries set status = 'published'
     where id = 'f0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'an author cannot publish'
);
update public.galleries set status = 'review' where id = 'f0000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Editor: no empty galleries, every photo publishable
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.galleries set status = 'published'
     where id = 'f0000000-0000-0000-0000-000000000002' $$,
  '23514', 'gallery_empty', 'an empty gallery cannot be published'
);
select throws_ok(
  $$ update public.galleries set status = 'published'
     where id = 'f0000000-0000-0000-0000-000000000001' $$,
  '23514', 'media_not_publishable', 'a photo that is not publishable blocks publishing'
);
delete from public.gallery_items where media_id = 'd0000000-0000-0000-0000-000000000002';
select lives_ok(
  $$ update public.galleries set status = 'published'
     where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'with publishable photos the editor publishes it'
);
select throws_ok(
  $$ insert into public.gallery_items (gallery_id, media_id, position) values
       ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 3) $$,
  '23514', 'media_not_publishable', 'a published gallery only takes publishable photos'
);
select lives_ok(
  $$ insert into public.gallery_items (gallery_id, media_id, position) values
       ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 3) $$,
  'a publishable photo can join a published gallery'
);

-- The author no longer edits the published gallery
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is_empty(
  $$ delete from public.gallery_items
     where gallery_id = 'f0000000-0000-0000-0000-000000000001' returning id $$,
  'an author cannot remove photos from a published gallery'
);

-- ---------------------------------------------------------------------------
-- Visitors and public photos
-- ---------------------------------------------------------------------------
set local role anon;
select is(
  (select array_agg(slug order by slug) from public.galleries),
  array['demo-galeria'], 'visitors only see the published gallery'
);
select is(
  (select count(*)::int from public.gallery_items), 2,
  'and only the photos of published galleries'
);
reset role;

select is(
  (select array_agg(should_be_public order by media_id) from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid,
           'd0000000-0000-0000-0000-000000000003'::uuid])),
  array[true, false, true], 'the photos of a published gallery are public, removed ones are not'
);
select is(
  (select count(*)::int from public.content_media_usages where entity_type = 'gallery'), 2,
  'gallery photos count as uses'
);
select ok(
  (select count(*) from public.audit_logs where table_name = 'gallery_items') >= 4,
  'adding and removing gallery photos is audited'
);

select * from finish();
rollback;
