-- Minor's opinion and validity end date (migration consent_details, step 6.5).
begin;
select plan(10);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}');

-- Records as the database owner (the API path is covered in 06)
select throws_ok(
  $$ insert into public.consent_records (subject_name, is_minor, signer_type, signer_name,
       scope_description, granted_on, channel, form_version, document_path)
     values ('[DEMO] Niña', true, 'legal_guardian', '[DEMO] Padre', 'Fotos', current_date,
             'paper', 'v1', 'x.webp') $$,
  '23514', null, 'the opinion of a minor must be recorded'
);
select throws_ok(
  $$ insert into public.consent_records (subject_name, is_minor, minor_opinion, signer_type,
       scope_description, granted_on, channel, form_version, document_path)
     values ('[DEMO] Adulto', false, 'agrees', 'self', 'Fotos', current_date, 'paper', 'v1',
             'x.webp') $$,
  '23514', null, 'an adult has no minor opinion'
);
select throws_ok(
  $$ insert into public.consent_records (subject_name, is_minor, signer_type, scope_description,
       granted_on, valid_until, channel, form_version, document_path)
     values ('[DEMO] Adulto', false, 'self', 'Fotos', '2026-09-01', '2026-08-01', 'paper', 'v1',
             'x.webp') $$,
  '23514', null, 'an authorization cannot end before it was signed'
);

insert into public.consent_records (id, subject_name, is_minor, minor_opinion, signer_type,
  signer_name, scope_description, granted_on, valid_until, channel, form_version, document_path)
values
  ('c0000000-0000-0000-0000-000000000001', '[DEMO] Niña que acepta', true, 'agrees',
   'legal_guardian', '[DEMO] Madre', 'Fotos', '2026-01-10', null, 'paper', 'v1', 'a.webp'),
  ('c0000000-0000-0000-0000-000000000002', '[DEMO] Niño que no quiere', true, 'disagrees',
   'legal_guardian', '[DEMO] Padre', 'Fotos', '2026-01-10', null, 'paper', 'v1', 'b.webp'),
  ('c0000000-0000-0000-0000-000000000003', '[DEMO] Adulta vencida', false, null,
   'self', null, 'Fotos', '2025-01-10', '2025-12-31', 'paper', 'v1', 'c.webp'),
  ('c0000000-0000-0000-0000-000000000004', '[DEMO] Adulto vigente', false, null,
   'self', null, 'Fotos', '2026-01-10', '2099-12-31', 'digital', 'v1', 'd.webp'),
  ('c0000000-0000-0000-0000-000000000005', '[DEMO] Bebé', true, 'not_applicable',
   'legal_guardian', '[DEMO] Madre', 'Fotos', '2026-01-10', null, 'paper', 'v1', 'e.webp');

insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Juegos', 'minors', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Juegos', 'minors', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000003', 'ready', 'p/3', 'Taller', 'identifiable', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000004', 'ready', 'p/4', 'Taller', 'identifiable', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000005', 'ready', 'p/5', 'Bebés', 'minors', 'bbbbbbbb-0000-0000-0000-000000000003');

insert into public.media_consents (media_id, consent_record_id) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005');

select ok(private.media_is_publishable('d0000000-0000-0000-0000-000000000001'),
  'a minor who agrees, with the guardian signature, can appear');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000002'),
  array['missing_guardian_consent'],
  'if the minor does not want to appear, the guardian signature is not enough');
select is(private.media_publish_issues('d0000000-0000-0000-0000-000000000003'),
  array['missing_consent'], 'an expired authorization no longer counts');
select ok(private.media_is_publishable('d0000000-0000-0000-0000-000000000004'),
  'an authorization valid until a future date counts');
select ok(private.media_is_publishable('d0000000-0000-0000-0000-000000000005'),
  'for very young children the opinion does not apply');

-- The API can write the new fields (editor with consent.manage)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ update public.consent_records set valid_until = '2027-01-01'
     where id = 'c0000000-0000-0000-0000-000000000004' $$,
  'an editor records the end date written on the form'
);
select lives_ok(
  $$ update public.consent_records set minor_opinion = 'disagrees'
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'an editor records that a minor changed their mind'
);
reset role;

select * from finish();
rollback;
