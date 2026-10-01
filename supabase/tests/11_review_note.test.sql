-- Review note when returning an activity to draft (migration activity_review_note, step 7.4b).
begin;
select plan(16);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.places (id, name, slug, kind) values
  ('11111111-0000-0000-0000-000000000001', '[DEMO] Barrio Centro', 'demo-barrio-centro', 'neighborhood');
insert into public.categories (id, scope, name, slug) values
  ('22222222-0000-0000-0000-000000000001', 'activity', '[DEMO] Jornada', 'demo-jornada');

-- ---------------------------------------------------------------------------
-- Author: creates and submits; never writes the note
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.activities (slug, title, starts_at, review_note)
     values ('demo-con-nota', '[DEMO] Con nota', now(), 'Hola') $$,
  '42501', null, 'a new activity cannot come with a review note'
);
insert into public.activities (slug, title, starts_at, place_id, category_id, status)
values ('demo-siembra', '[DEMO] Siembra', '2026-09-20 09:00-05',
        '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'review');

-- ---------------------------------------------------------------------------
-- Editor: returns with a required note
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.activities set status = 'draft' where slug = 'demo-siembra' $$,
  '23514', 'review_note_required', 'an editor cannot return an activity without a note'
);
select throws_ok(
  $$ update public.activities set status = 'draft', review_note = '   ' where slug = 'demo-siembra' $$,
  '23514', 'review_note_required', 'a blank note does not count'
);
select lives_ok(
  $$ update public.activities set status = 'draft', review_note = '  Falta la foto de portada. '
     where slug = 'demo-siembra' $$,
  'an editor returns it with a note'
);
select is(
  (select review_note || ' · ' || review_note_by::text || ' · ' || (review_note_at is not null)::text
   from public.activities where slug = 'demo-siembra'),
  'Falta la foto de portada. · eeeeeeee-0000-0000-0000-000000000002 · true',
  'the note is trimmed and stamped with who and when'
);
select throws_ok(
  $$ update public.activities set review_note_by = null where slug = 'demo-siembra' $$,
  '42501', null, 'who wrote the note is not writable from the API'
);

-- ---------------------------------------------------------------------------
-- Author: reads the note, fixes, resubmits
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.activities set review_note = 'Ya quedó' where slug = 'demo-siembra' $$,
  '42501', 'review_note_read_only', 'an author cannot change the note'
);
select throws_ok(
  $$ update public.activities set review_note = null where slug = 'demo-siembra' $$,
  '42501', 'review_note_read_only', 'an author cannot erase the note'
);
update public.activities set summary = '[DEMO] Con portada' where slug = 'demo-siembra';
select is(
  (select review_note from public.activities where slug = 'demo-siembra'),
  'Falta la foto de portada.', 'the note stays while the author edits'
);
update public.activities set status = 'review' where slug = 'demo-siembra';
select is(
  (select row(review_note, review_note_by, review_note_at)::text
   from public.activities where slug = 'demo-siembra'),
  '(,,)', 'resubmitting clears the note'
);
select lives_ok(
  $$ update public.activities set status = 'draft' where slug = 'demo-siembra' $$,
  'an author takes back their own submission without a note'
);

-- ---------------------------------------------------------------------------
-- Editor: publishes, retires with an optional note, archives, reopens
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

update public.activities set status = 'published' where slug = 'demo-siembra';
select lives_ok(
  $$ update public.activities set status = 'draft', review_note = 'Corregir la fecha.'
     where slug = 'demo-siembra' $$,
  'an editor retires a published activity with a note'
);
update public.activities set status = 'published' where slug = 'demo-siembra';
select is(
  (select review_note from public.activities where slug = 'demo-siembra'),
  null, 'publishing again clears the note'
);
select lives_ok(
  $$ update public.activities set status = 'archived' where slug = 'demo-siembra' $$,
  'an editor archives'
);

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is_empty(
  $$ update public.activities set status = 'draft' where slug = 'demo-siembra' returning id $$,
  'an author cannot reopen an archived activity'
);

reset role;

-- Server scripts with the secret key (no session) change states too
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$ update public.activities set status = 'draft' where slug = 'demo-siembra' $$,
  'the server can change the state without a session'
);
reset role;

select * from finish();
rollback;
