-- Videos on the shared content engine (migration content_videos, step 7.6c).
begin;
select plan(13);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Huerta', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Niños', null, 'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.activities (id, slug, title, starts_at) values
  ('a0000000-0000-0000-0000-000000000001', 'demo-siembra', '[DEMO] Siembra', now());
insert into public.projects (id, slug, title) values
  ('c1000000-0000-0000-0000-000000000001', 'demo-huertas', '[DEMO] Huertas');

-- ---------------------------------------------------------------------------
-- Author: registers a video by provider and id only
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.videos (title, provider, provider_video_id, activity_id, cover_media_id)
     values ('[DEMO] Siembra en video', 'youtube', 'dQw4w9WgXcQ',
             'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002') $$,
  'an author registers a video of an activity'
);
select throws_ok(
  $$ insert into public.videos (title, provider, provider_video_id)
     values ('[DEMO] Otro', 'dailymotion', 'x8abc') $$,
  '23514', null, 'only the four providers are accepted'
);
select throws_ok(
  $$ insert into public.videos (title, provider, provider_video_id)
     values ('[DEMO] Iframe', 'youtube', '<iframe src="x">') $$,
  '23514', null, 'the id cannot carry HTML'
);
select throws_ok(
  $$ insert into public.videos (title, provider, provider_video_id)
     values ('[DEMO] Repetido', 'youtube', 'dQw4w9WgXcQ') $$,
  '23505', null, 'the same video is registered once'
);
select throws_ok(
  $$ insert into public.videos (title, provider, provider_video_id, activity_id, project_id)
     values ('[DEMO] Doble', 'vimeo', '76979871', 'a0000000-0000-0000-0000-000000000001',
             'c1000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'a video belongs to an activity or a project, not both'
);
select throws_ok(
  $$ update public.videos set status = 'published' where provider_video_id = 'dQw4w9WgXcQ' $$,
  '42501', null, 'an author cannot publish (the permission is checked first)'
);
update public.videos set status = 'review' where provider_video_id = 'dQw4w9WgXcQ';

-- ---------------------------------------------------------------------------
-- Editor: the cover must be publishable
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.videos set status = 'published' where provider_video_id = 'dQw4w9WgXcQ' $$,
  '23514', 'media_not_publishable', 'a cover that is not publishable blocks publishing'
);
update public.videos set cover_media_id = 'd0000000-0000-0000-0000-000000000001'
where provider_video_id = 'dQw4w9WgXcQ';
select lives_ok(
  $$ update public.videos set status = 'published' where provider_video_id = 'dQw4w9WgXcQ' $$,
  'an editor publishes the video'
);
insert into public.videos (title, provider, provider_video_id)
values ('[DEMO] Borrador', 'tiktok', '7212345678901234567');

set local role anon;
select is(
  (select array_agg(provider || ':' || provider_video_id order by provider) from public.videos),
  array['youtube:dQw4w9WgXcQ'], 'visitors only see the published video'
);
reset role;

-- ---------------------------------------------------------------------------
-- Public cover, trash, audit
-- ---------------------------------------------------------------------------
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  true, 'the cover of a published video must be public'
);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.videos set deleted_at = now() where provider_video_id = 'dQw4w9WgXcQ';
select lives_ok(
  $$ insert into public.videos (title, provider, provider_video_id)
     values ('[DEMO] De nuevo', 'youtube', 'dQw4w9WgXcQ') $$,
  'a video in the trash can be registered again'
);
reset role;
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  false, 'a video in the trash takes its cover out'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'videos' and action = 'publish'),
  1, 'the publication is audited'
);

select * from finish();
rollback;
