-- Trash (migration trash, step 7.7): send, restore, purge safely.
begin;
select plan(16);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Huerta', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Semillas', 'none', 'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.projects (id, slug, title, created_by) values
  ('c1000000-0000-0000-0000-000000000001', 'demo-huertas', '[DEMO] Huertas',
   'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.activities (id, slug, title, starts_at, project_id, cover_media_id) values
  ('a0000000-0000-0000-0000-000000000001', 'demo-siembra', '[DEMO] Siembra', now(),
   'c1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');
insert into public.activity_media (activity_id, media_id) values
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002');
insert into public.galleries (id, slug, title, activity_id) values
  ('f0000000-0000-0000-0000-000000000001', 'demo-galeria', '[DEMO] Galería',
   'a0000000-0000-0000-0000-000000000001');

select is(
  (select array_agg(c.conrelid::regclass::text || '.' || a.attname
                    order by c.conrelid::regclass::text, a.attname::text)
   from pg_constraint c
   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
   where c.contype = 'f' and c.confdeltype = 'n'
     and c.confrelid in ('public.activities'::regclass, 'public.projects'::regclass)),
  array['activities.project_id', 'consent_records.activity_id', 'galleries.activity_id',
        'galleries.project_id', 'testimonials.activity_id', 'testimonials.project_id',
        'videos.activity_id', 'videos.project_id'],
  'what belongs to an activity or a project is unlinked when it is purged'
);

-- ---------------------------------------------------------------------------
-- Author and editor: send to the trash, never restore or purge
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.projects set deleted_at = now() where slug = 'demo-huertas' $$,
  '42501', null, 'an author cannot send content to the trash'
);
select lives_ok(
  $$ update public.media set deleted_at = now()
     where id = 'd0000000-0000-0000-0000-000000000002' $$,
  'the uploader sends their photo to the trash'
);
select throws_ok(
  $$ update public.media set deleted_at = null
     where id = 'd0000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'the uploader cannot take it out of the trash'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ update public.projects set deleted_at = now() where slug = 'demo-huertas' $$,
  'an editor sends a project to the trash'
);
select throws_ok(
  $$ update public.media set deleted_at = null
     where id = 'd0000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'an editor cannot restore a photo'
);
delete from public.projects;
select is(
  (select count(*)::int from public.projects where slug = 'demo-huertas'),
  1, 'an editor cannot purge the trash'
);
update public.activities set deleted_at = now() where slug = 'demo-siembra';

-- ---------------------------------------------------------------------------
-- Admin: restore and purge
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ update public.media set deleted_at = null
     where id = 'd0000000-0000-0000-0000-000000000002' $$,
  'an admin restores a photo'
);
delete from public.media where id = 'd0000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.media where id = 'd0000000-0000-0000-0000-000000000002'),
  1, 'a photo outside the trash is not purged'
);
update public.media set deleted_at = now() where id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ delete from public.media where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23503', null, 'a photo still used as a cover (even by trashed content) is not purged'
);

select lives_ok(
  $$ delete from public.projects where slug = 'demo-huertas' $$,
  'an admin purges a project from the trash'
);
select is(
  (select project_id from public.activities where slug = 'demo-siembra'),
  null, 'its activity stays, without project'
);
select lives_ok(
  $$ delete from public.activities where slug = 'demo-siembra' $$,
  'an admin purges an activity from the trash'
);
select is(
  (select activity_id from public.galleries where slug = 'demo-galeria'),
  null, 'its gallery stays, without activity'
);
select is(
  (select count(*)::int from public.activity_media
   where media_id = 'd0000000-0000-0000-0000-000000000002'),
  0, 'its photo links go with it; the photos stay in the library'
);

reset role;
select is(
  (select array_agg(table_name || ':' || action order by table_name)
   from public.audit_logs
   where action = 'delete'
     and record_id in ('a0000000-0000-0000-0000-000000000001',
                       'c1000000-0000-0000-0000-000000000001')),
  array['activities:delete', 'projects:delete'], 'every purge stays in the audit log'
);

select * from finish();
rollback;
