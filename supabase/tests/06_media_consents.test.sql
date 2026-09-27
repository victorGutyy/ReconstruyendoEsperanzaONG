-- Media, image authorizations and publishability (migration media_and_consents, step 6.2).
begin;
select plan(35);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}'),
  ('cccccccc-0000-0000-0000-000000000004', 'author2@example.test', '{"role":"author"}', '{}');

-- ---------------------------------------------------------------------------
-- media: authors upload and describe their own photos
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$ insert into public.media (alt_text) values (null) $$,
  'an author with MFA adds a photo'
);
select set_config('test.media_id',
  (select id::text from public.media where uploaded_by = 'bbbbbbbb-0000-0000-0000-000000000003'), true);

select is(
  (select processing_status || ' by ' || uploaded_by::text from public.media
   where id = current_setting('test.media_id')::uuid),
  'processing by bbbbbbbb-0000-0000-0000-000000000003',
  'a new photo starts processing and belongs to whoever uploaded it'
);
select throws_ok(
  $$ insert into public.media (alt_text, uploaded_by)
     values ('x', 'cccccccc-0000-0000-0000-000000000004') $$,
  '42501', null, 'the uploader cannot be chosen'
);
select lives_ok(
  $$ update public.media set alt_text = 'Personas sembrando árboles', people_in_photo = 'none'
     where id = current_setting('test.media_id')::uuid $$,
  'the uploader describes their photo'
);
select throws_ok(
  $$ update public.media set public_key = 'media/x' where id = current_setting('test.media_id')::uuid $$,
  '42501', null, 'nobody can make a photo public from the API'
);
select throws_ok(
  $$ update public.media set processing_status = 'ready' where id = current_setting('test.media_id')::uuid $$,
  '42501', null, 'the processing status is written only by the server'
);

-- Another author cannot edit it (RLS hides it from the update: 0 rows)
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
update public.media set caption = 'cambiado' where id = current_setting('test.media_id')::uuid;
select is(
  (select caption from public.media where id = current_setting('test.media_id')::uuid),
  null, 'another author cannot edit the photo'
);
select is(
  (select count(*)::int from public.consent_records), 0, 'an author cannot read authorizations'
);

-- An editor (media.update) can edit any photo
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.media set credit = '[DEMO] Equipo' where id = current_setting('test.media_id')::uuid;
select is(
  (select credit from public.media where id = current_setting('test.media_id')::uuid),
  '[DEMO] Equipo', 'an editor edits any photo'
);

-- Without MFA nobody reads or writes photos
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.media), 0, 'without MFA photos are not visible');
select throws_ok(
  $$ insert into public.media (alt_text) values (null) $$,
  '42501', null, 'without MFA photos cannot be added'
);
reset role;

-- Visitors only see public photos
set local role anon;
select is((select count(*)::int from public.media), 0, 'visitors do not see private photos');
reset role;

-- ---------------------------------------------------------------------------
-- consent_records: consent.manage only, minors need a legal guardian
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ insert into public.consent_records (subject_name, is_minor, signer_type, scope_description,
       granted_on, channel, form_version, document_path)
     values ('[DEMO] Ana', false, 'self', 'Fotos de la jornada', current_date, 'paper', 'v1', 'x.webp') $$,
  '42501', null, 'an author cannot register authorizations'
);

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ insert into public.consent_records (subject_name, is_minor, signer_type, scope_description,
       granted_on, channel, form_version, document_path)
     values ('[DEMO] Niño', true, 'self', 'Fotos', current_date, 'paper', 'v1', 'x.webp') $$,
  '23514', null, 'a minor must be authorized by a legal guardian'
);
select throws_ok(
  $$ insert into public.consent_records (subject_name, is_minor, signer_type, scope_description,
       granted_on, channel, form_version, document_path)
     values ('[DEMO] Niño', true, 'legal_guardian', 'Fotos', current_date, 'paper', 'v1', 'x.webp') $$,
  '23514', null, 'a legal guardian must be named'
);
select lives_ok(
  $$ insert into public.consent_records (subject_name, is_minor, signer_type, signer_name,
       scope_description, granted_on, channel, form_version, document_path)
     values ('[DEMO] Ana', false, 'self', null, 'Fotos de la jornada', current_date, 'paper', 'v1',
             'a.webp'),
            ('[DEMO] Niño', true, 'legal_guardian', '[DEMO] Madre', 'Fotos de la jornada',
             current_date, 'paper', 'v1', 'b.webp') $$,
  'an editor registers an adult and a minor authorization'
);
select set_config('request.jwt.claims', '', true);
reset role;

select set_config('test.adult_consent',
  (select id::text from public.consent_records where subject_name = '[DEMO] Ana'), true);
select set_config('test.minor_consent',
  (select id::text from public.consent_records where subject_name = '[DEMO] Niño'), true);
select is(
  (select created_by::text from public.consent_records where subject_name = '[DEMO] Ana'),
  'eeeeeeee-0000-0000-0000-000000000002', 'the authorization records who registered it'
);

-- ---------------------------------------------------------------------------
-- Publishability (as the server would read it)
-- ---------------------------------------------------------------------------
-- Photos in different states, created as the server would (postgres)
insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Árboles', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', null, 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000003', 'ready', 'p/3', 'Taller', null, 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000004', 'ready', 'p/4', 'Taller', 'identifiable', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000005', 'ready', 'p/5', 'Taller', 'minors', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000006', 'processing', null, 'Taller', 'none', 'bbbbbbbb-0000-0000-0000-000000000003');

select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000001'), '{}'::text[],
  'a described photo without people is publishable');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000002'),
  array['missing_alt_text'], 'a photo without description is not publishable');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000003'),
  array['people_unclassified'], 'an unclassified photo is not publishable');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000004'),
  array['missing_consent'], 'a photo with people needs an authorization');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000006'),
  array['not_processed'], 'a photo still processing is not publishable');
select ok(not private.media_is_publishable('d0000000-0000-0000-0000-00000000ffff'),
  'an unknown photo is not publishable');

-- Linking authorizations (editor with consent.manage)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ insert into public.media_consents (media_id, consent_record_id) values
       ('d0000000-0000-0000-0000-000000000004', current_setting('test.adult_consent')::uuid),
       ('d0000000-0000-0000-0000-000000000005', current_setting('test.adult_consent')::uuid) $$,
  'an editor links an authorization to photos'
);
select throws_ok(
  $$ insert into public.media_consents (media_id, consent_record_id) values
       ('d0000000-0000-0000-0000-000000000004', current_setting('test.adult_consent')::uuid) $$,
  '23505', null, 'the same link cannot be added twice'
);
reset role;

select ok(private.media_is_publishable('d0000000-0000-0000-0000-000000000004'),
  'with an authorization the photo with people is publishable');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000005'),
  array['missing_guardian_consent'], 'an adult authorization does not cover minors');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
insert into public.media_consents (media_id, consent_record_id) values
  ('d0000000-0000-0000-0000-000000000005', current_setting('test.minor_consent')::uuid);
reset role;
select ok(private.media_is_publishable('d0000000-0000-0000-0000-000000000005'),
  'with the legal guardian authorization the photo with minors is publishable');

-- Revocation: the photo stops being publishable, and it cannot be undone
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ update public.consent_records set revoked_at = now(), revocation_note = 'La persona lo pidió'
     where id = current_setting('test.adult_consent')::uuid $$,
  'an editor revokes an authorization'
);
select throws_ok(
  $$ update public.consent_records set revoked_at = null
     where id = current_setting('test.adult_consent')::uuid $$,
  '42501', null, 'a revocation cannot be undone'
);
select throws_ok(
  $$ update public.consent_records set document_path = 'otro.webp'
     where id = current_setting('test.adult_consent')::uuid $$,
  '42501', null, 'the signed form cannot be replaced from the API'
);
reset role;

select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000004'),
  array['missing_consent'], 'after a revocation the photo is no longer publishable');

-- ---------------------------------------------------------------------------
-- Storage: only the server (secret key) reaches the private buckets
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(id || ':' || public::text order by id) from storage.buckets
   where id in ('media-incoming', 'media-private', 'consent-documents')),
  array['consent-documents:false', 'media-incoming:false', 'media-private:false'],
  'the three buckets exist and are private'
);

insert into storage.objects (bucket_id, name) values ('consent-documents', 'demo/form.webp');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'consent-documents'), 0,
  'not even an admin session reads the signed forms directly'
);
reset role;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(distinct table_name order by table_name) from public.audit_logs
   where table_name in ('media', 'consent_records', 'media_consents')),
  array['consent_records', 'media', 'media_consents'],
  'photos, authorizations and links are audited'
);

select * from finish();
rollback;
