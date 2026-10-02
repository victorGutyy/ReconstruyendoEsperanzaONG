-- Testimonials (migration content_testimonials, step 7.6d).
begin;
select plan(18);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.consent_records (id, subject_name, is_minor, minor_opinion, signer_type,
  signer_name, scope_description, granted_on, channel, form_version, document_path) values
  ('c0000000-0000-0000-0000-000000000001', '[DEMO] María', false, null, 'self', null,
   'Testimonio', '2026-01-10', 'paper', 'v1', 'a.webp'),
  ('c0000000-0000-0000-0000-000000000002', '[DEMO] Niño', true, 'agrees', 'legal_guardian',
   '[DEMO] Madre', 'Testimonio', '2026-01-10', 'paper', 'v1', 'b.webp'),
  ('c0000000-0000-0000-0000-000000000003', '[DEMO] Pedro', false, null, 'self', null,
   'Testimonio', '2026-01-10', 'paper', 'v1', 'c.webp');
insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'María', 'identifiable', 'eeeeeeee-0000-0000-0000-000000000002');
insert into public.media_consents (media_id, consent_record_id) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Authors do not handle testimonials (they cannot see authorizations)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ insert into public.testimonials (quote, author_display_name, consent_record_id)
     values ('[DEMO] Gracias', 'María', 'c0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'an author cannot write a testimonial'
);

-- ---------------------------------------------------------------------------
-- Editor (manages authorizations)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.testimonials (quote, author_display_name)
     values ('[DEMO] Sin autorización', 'Nadie') $$,
  '23514', 'consent_not_found', 'a testimonial cannot exist without an authorization'
);
select throws_ok(
  $$ insert into public.testimonials (quote, author_display_name, consent_record_id)
     values ('[DEMO] Hola', 'Niño', 'c0000000-0000-0000-0000-000000000002') $$,
  '23514', 'consent_is_minor', 'testimonials of minors are not allowed'
);
select lives_ok(
  $$ insert into public.testimonials (quote, author_display_name, author_context,
       consent_record_id, cover_media_id)
     values ('[DEMO] El taller me cambió la vida.', 'María', '[DEMO] Participante del taller',
             'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001') $$,
  'an editor writes a testimonial with an adult''s authorization'
);
select throws_ok(
  $$ update public.testimonials set consent_withdrawn = true $$,
  '42501', null, 'the copied authorization facts are not writable from the API'
);
select lives_ok(
  $$ update public.testimonials set status = 'published' where author_display_name = 'María' $$,
  'with a usable authorization it is published'
);
insert into public.testimonials (quote, author_display_name, consent_record_id, status)
values ('[DEMO] Me gustó.', 'Pedro', 'c0000000-0000-0000-0000-000000000003', 'published');

-- The author does not read drafts, but sees what visitors see
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
reset role;
insert into public.testimonials (quote, author_display_name, consent_record_id)
values ('[DEMO] Borrador', 'Borrador', 'c0000000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is(
  (select array_agg(author_display_name order by author_display_name) from public.testimonials),
  array['María', 'Pedro'], 'an author sees only the public testimonials'
);

set local role anon;
select is(
  (select array_agg(author_display_name order by author_display_name) from public.testimonials),
  array['María', 'Pedro'], 'visitors see the published testimonials'
);
reset role;
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  true, 'the person''s photo is public'
);

-- ---------------------------------------------------------------------------
-- Revoking or expiring the authorization hides it at once
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.consent_records set revoked_at = now(), revocation_note = '[DEMO] Lo pidió'
where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select consent_withdrawn from public.testimonials where author_display_name = 'María'),
  true, 'revoking the authorization is copied to the testimonial'
);
select is(
  (select status::text from public.testimonials where author_display_name = 'María'),
  'published', 'the testimonial stays published in the panel (to be flagged)'
);

set local role anon;
select is(
  (select array_agg(author_display_name) from public.testimonials),
  array['Pedro'], 'visitors no longer see it'
);
reset role;
select is(
  (select should_be_public from public.media_public_targets(
     array['d0000000-0000-0000-0000-000000000001'::uuid])),
  false, 'and the photo leaves the site'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
update public.consent_records set valid_until = '2026-01-31'
where id = 'c0000000-0000-0000-0000-000000000003';
select is(
  (select consent_valid_until from public.testimonials where author_display_name = 'Pedro'),
  '2026-01-31'::date, 'the end date is copied too'
);
set local role anon;
select is_empty(
  $$ select 1 from public.testimonials $$,
  'an expired authorization hides the testimonial as well'
);

-- Publishing with an unusable authorization is refused
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$ update public.testimonials set status = 'published' where author_display_name = 'Borrador' $$,
  '23514', 'consent_not_valid', 'a testimonial with an expired authorization cannot be published'
);
select throws_ok(
  $$ update public.testimonials set consent_record_id = 'c0000000-0000-0000-0000-000000000002'
     where author_display_name = 'Borrador' $$,
  '23514', 'consent_is_minor', 'nor can it be moved to a minor''s authorization'
);
reset role;
select ok(
  (select count(*) from public.audit_logs where table_name = 'testimonials') >= 3,
  'testimonials are audited'
);

select * from finish();
rollback;
