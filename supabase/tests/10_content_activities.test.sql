-- Content engine + activities (migration content_activities, step 7.1).
begin;
select plan(36);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}'),
  ('cccccccc-0000-0000-0000-000000000004', 'author2@example.test', '{"role":"author"}', '{}');

insert into public.places (id, name, slug, kind) values
  ('11111111-0000-0000-0000-000000000001', '[DEMO] Barrio Centro', 'demo-barrio-centro', 'neighborhood');
insert into public.categories (id, scope, name, slug) values
  ('22222222-0000-0000-0000-000000000001', 'activity', '[DEMO] Jornada', 'demo-jornada'),
  ('22222222-0000-0000-0000-000000000002', 'post', '[DEMO] Historias', 'demo-historias');
insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Árboles', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Taller', 'identifiable', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000003', 'ready', 'p/3', 'Juegos', null, 'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.consent_records (id, subject_name, is_minor, signer_type, scope_description,
  granted_on, channel, form_version, document_path) values
  ('c0000000-0000-0000-0000-000000000001', '[DEMO] Adulta', false, 'self', 'Fotos',
   '2026-01-10', 'paper', 'v1', 'a.webp');

-- ---------------------------------------------------------------------------
-- Author: creates, edits and sends their own draft to review; cannot publish
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.activities (slug, title, starts_at)
     values ('demo-jornada-de-siembra', '[DEMO] Jornada de siembra', '2026-09-20 09:00-05') $$,
  'an author creates a draft activity'
);
select set_config('test.a1',
  (select id::text from public.activities where slug = 'demo-jornada-de-siembra'), true);
select is(
  (select status::text || ' by ' || created_by::text from public.activities
   where id = current_setting('test.a1')::uuid),
  'draft by bbbbbbbb-0000-0000-0000-000000000003', 'it starts as a draft owned by the author'
);
select throws_ok(
  $$ insert into public.activities (slug, title, starts_at, status)
     values ('demo-otra', '[DEMO] Otra', now(), 'published') $$,
  '42501', null, 'an author cannot create published content'
);
select lives_ok(
  $$ update public.activities set summary = '[DEMO] Resumen', status = 'review'
     where id = current_setting('test.a1')::uuid $$,
  'an author edits their draft and sends it to review'
);
select throws_ok(
  $$ update public.activities set status = 'published' where id = current_setting('test.a1')::uuid $$,
  '42501', null, 'an author cannot publish'
);
select throws_ok(
  $$ update public.activities set deleted_at = now() where id = current_setting('test.a1')::uuid $$,
  '42501', null, 'an author cannot send content to the trash'
);

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
update public.activities set title = 'cambiado' where id = current_setting('test.a1')::uuid;
select is(
  (select title from public.activities where id = current_setting('test.a1')::uuid),
  '[DEMO] Jornada de siembra', 'another author cannot edit it'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$ insert into public.activities (slug, title, starts_at) values ('demo-x', 'x', now()) $$,
  '42501', null, 'without MFA nobody creates content'
);

-- ---------------------------------------------------------------------------
-- Editor: RN-A-02 and HU-06 before publishing
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.activities set status = 'published' where id = current_setting('test.a1')::uuid $$,
  '23514', null, 'an activity cannot be published without place and category (RN-A-02)'
);
select throws_ok(
  $$ update public.activities set category_id = '22222222-0000-0000-0000-000000000002'
     where id = current_setting('test.a1')::uuid $$,
  '23514', null, 'a post category cannot be used for an activity'
);
select lives_ok(
  $$ update public.activities
     set place_id = '11111111-0000-0000-0000-000000000001',
         category_id = '22222222-0000-0000-0000-000000000001',
         cover_media_id = 'd0000000-0000-0000-0000-000000000001'
     where id = current_setting('test.a1')::uuid $$,
  'an editor completes the activity'
);
select lives_ok(
  $$ insert into public.activity_media (activity_id, media_id, position) values
       (current_setting('test.a1')::uuid, 'd0000000-0000-0000-0000-000000000002', 1) $$,
  'a photo with people can be added to a draft'
);
select throws_ok(
  $$ update public.activities set status = 'published' where id = current_setting('test.a1')::uuid $$,
  '23514', 'media_not_publishable',
  'publishing is blocked while a photo lacks its authorization (HU-06)'
);
insert into public.media_consents (media_id, consent_record_id) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ update public.activities set status = 'published' where id = current_setting('test.a1')::uuid $$,
  'with the authorization linked, the editor publishes'
);
select ok(
  (select published_at is not null and published_at <= now() from public.activities
   where id = current_setting('test.a1')::uuid),
  'publishing without a date publishes now'
);
select throws_ok(
  $$ update public.activities set slug = 'demo-otro-slug' where id = current_setting('test.a1')::uuid $$,
  '23514', null, 'the slug is frozen once published'
);
select throws_ok(
  $$ insert into public.activity_media (activity_id, media_id, position) values
       (current_setting('test.a1')::uuid, 'd0000000-0000-0000-0000-000000000003', 2) $$,
  '23514', 'media_not_publishable',
  'an unclassified photo cannot be added to a published activity'
);
select throws_ok(
  $$ update public.activities set status = 'review' where id = current_setting('test.a1')::uuid $$,
  '23514', null, 'published cannot jump back to review'
);

-- The view of photo usages
select is(
  (select array_agg(usage || ':' || media_id::text order by usage) from public.content_media_usages
   where entity_id = current_setting('test.a1')::uuid),
  array['cover:d0000000-0000-0000-0000-000000000001', 'gallery:d0000000-0000-0000-0000-000000000002'],
  'the usages view lists the cover and the photos of the activity'
);

-- An authorization can name its activity
select lives_ok(
  $$ update public.consent_records set activity_id = current_setting('test.a1')::uuid
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'an authorization records the activity it was signed for'
);

-- The author cannot edit their activity once published
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
update public.activities set title = 'cambiado' where id = current_setting('test.a1')::uuid;
select is(
  (select title from public.activities where id = current_setting('test.a1')::uuid),
  '[DEMO] Jornada de siembra', 'an author cannot edit their activity once published'
);

-- ---------------------------------------------------------------------------
-- Editor: schedule, archive, reopen, trash
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.activities (slug, title, starts_at, status, published_at, place_id, category_id)
     values ('demo-programada', '[DEMO] Programada', '2026-12-01 08:00-05', 'published',
             now() + interval '10 days',
             '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001') $$,
  'an editor schedules an activity (published with a future date)'
);
select lives_ok(
  $$ insert into public.activities (slug, title, starts_at) values ('demo-borrador', '[DEMO] Borrador', now()) $$,
  'an editor creates a draft'
);
select lives_ok(
  $$ insert into public.activities (slug, title, starts_at, status, place_id, category_id)
     values ('demo-a-la-papelera', '[DEMO] A la papelera', now(), 'published',
             '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001') $$,
  'an editor publishes directly'
);
select lives_ok(
  $$ update public.activities set deleted_at = now() where slug = 'demo-a-la-papelera' $$,
  'an editor sends it to the trash'
);
select throws_ok(
  $$ update public.activities set deleted_at = null where slug = 'demo-a-la-papelera' $$,
  '42501', null, 'an editor cannot restore from the trash'
);
delete from public.activities where slug = 'demo-a-la-papelera';
select is(
  (select count(*)::int from public.activities where slug = 'demo-a-la-papelera'), 1,
  'an editor cannot delete for real'
);

select lives_ok(
  $$ update public.activities set status = 'archived' where slug = 'demo-programada' $$,
  'an editor archives'
);
select throws_ok(
  $$ update public.activities set status = 'published' where slug = 'demo-programada' $$,
  '23514', null, 'archived cannot go straight back to published'
);
select lives_ok(
  $$ update public.activities set status = 'draft' where slug = 'demo-programada' $$,
  'an editor reopens an archived activity as a draft'
);
update public.activities set status = 'published' where slug = 'demo-programada';
reset role;

-- ---------------------------------------------------------------------------
-- Visitors: only published activities whose date arrived, not in the trash
-- ---------------------------------------------------------------------------
set local role anon;
select is(
  (select array_agg(slug order by slug) from public.activities),
  array['demo-jornada-de-siembra'],
  'visitors do not see drafts, scheduled, archived or trashed activities'
);
select is(
  (select count(*)::int from public.activity_media), 1,
  'visitors see the photos of published activities only'
);
reset role;

-- ---------------------------------------------------------------------------
-- Admin: restore and delete for real
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ update public.activities set deleted_at = null where slug = 'demo-a-la-papelera' $$,
  'an admin restores from the trash'
);
update public.activities set deleted_at = now() where slug = 'demo-a-la-papelera';
delete from public.activities where slug = 'demo-a-la-papelera';
select is(
  (select count(*)::int from public.activities where slug = 'demo-a-la-papelera'), 0,
  'an admin deletes for real from the trash'
);
reset role;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
select is(
  (select actor_id::text from public.audit_logs
   where table_name = 'activities' and record_id = current_setting('test.a1') and action = 'insert'),
  'bbbbbbbb-0000-0000-0000-000000000003', 'creating an activity is audited with its author'
);
select is(
  (select actor_id::text from public.audit_logs
   where table_name = 'activities' and record_id = current_setting('test.a1') and action = 'publish'),
  'eeeeeeee-0000-0000-0000-000000000002', 'publishing is audited with the editor as actor'
);

select * from finish();
rollback;
