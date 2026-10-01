-- Public photos: bucket and rule (migration media_public, step 7.5a).
begin;
select plan(11);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}');

insert into public.places (id, name, slug, kind) values
  ('11111111-0000-0000-0000-000000000001', '[DEMO] Barrio Centro', 'demo-barrio-centro', 'neighborhood');
insert into public.categories (id, scope, name, slug) values
  ('22222222-0000-0000-0000-000000000001', 'activity', '[DEMO] Jornada', 'demo-jornada');
insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  -- No people: publishable as is
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Árboles', 'none', 'eeeeeeee-0000-0000-0000-000000000002'),
  -- An adult who signed
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Taller', 'identifiable', 'eeeeeeee-0000-0000-0000-000000000002'),
  -- Not used anywhere
  ('d0000000-0000-0000-0000-000000000003', 'ready', 'p/3', 'Suelta', 'none', 'eeeeeeee-0000-0000-0000-000000000002');
insert into public.consent_records (id, subject_name, is_minor, signer_type, scope_description,
  granted_on, channel, form_version, document_path) values
  ('c0000000-0000-0000-0000-000000000001', '[DEMO] Adulta', false, 'self', 'Fotos',
   '2026-01-10', 'paper', 'v1', 'a.webp');
insert into public.media_consents (media_id, consent_record_id) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');

insert into public.activities (id, slug, title, starts_at, place_id, category_id, cover_media_id) values
  ('a0000000-0000-0000-0000-000000000001', 'demo-siembra', '[DEMO] Siembra', '2026-09-20 09:00-05',
   '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001');
insert into public.activity_media (activity_id, media_id, position) values
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 2);

create function pg_temp.should(p_id uuid) returns boolean language sql as $$
  select should_be_public from public.media_public_targets(array[p_id])
$$;

select is(
  (select public::text || ' · ' || array_to_string(allowed_mime_types, ',') from storage.buckets
   where id = 'media-public'),
  'true · image/webp', 'the public bucket exists and only takes WebP'
);
select is(pg_temp.should('d0000000-0000-0000-0000-000000000001'), false,
  'a photo in a draft is not public');

update public.activities set status = 'published' where id = 'a0000000-0000-0000-0000-000000000001';
select is(pg_temp.should('d0000000-0000-0000-0000-000000000001'), true,
  'a photo in a published activity is public');
select is(pg_temp.should('d0000000-0000-0000-0000-000000000002'), true,
  'a photo with its authorization is public');
select is(pg_temp.should('d0000000-0000-0000-0000-000000000003'), false,
  'a photo not used anywhere is not public');

update public.consent_records set revoked_at = now(), revocation_note = '[DEMO] Ya no'
where id = 'c0000000-0000-0000-0000-000000000001';
select is(pg_temp.should('d0000000-0000-0000-0000-000000000002'), false,
  'revoking the authorization makes the photo private again');

update public.media set public_key = 'k1' where id = 'd0000000-0000-0000-0000-000000000003';
select is(
  (select array_agg(media_id::text || ':' || should_be_public::text order by media_id)
   from public.media_public_targets()),
  array[
    'd0000000-0000-0000-0000-000000000001:true',
    'd0000000-0000-0000-0000-000000000002:false',
    'd0000000-0000-0000-0000-000000000003:false'
  ],
  'without ids it checks every photo in use or still public (daily sync)'
);

update public.activities set status = 'archived' where id = 'a0000000-0000-0000-0000-000000000001';
select is(pg_temp.should('d0000000-0000-0000-0000-000000000001'), false,
  'archiving takes the photos out');

-- Only the server calls it
set local role service_role;
select lives_ok(
  $$ select * from public.media_public_targets(array['d0000000-0000-0000-0000-000000000001'::uuid]) $$,
  'the server (secret key) can ask'
);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ select * from public.media_public_targets() $$,
  '42501', null, 'a signed-in member cannot call it'
);
set local role anon;
select throws_ok(
  $$ select * from public.media_public_targets() $$,
  '42501', null, 'a visitor cannot call it'
);
reset role;

select * from finish();
rollback;
