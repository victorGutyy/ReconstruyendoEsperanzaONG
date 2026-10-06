-- Institutional and legal pages (migration content_pages, step 7.6e).
begin;
select plan(17);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"role":"admin"}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'editor@example.test', '{"role":"editor"}', '{}');

select is(
  (select array_agg(key || ':' || status::text order by key) from public.pages),
  array['about:draft', 'privacy-notice:draft', 'privacy-policy:draft', 'support:draft'],
  'the four pages exist as drafts'
);
select ok(
  (select bool_and(body_text like '[PENDIENTE:%') from public.pages),
  'they start with pending markers, never invented text'
);

-- ---------------------------------------------------------------------------
-- Editor: institutional pages only
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.pages (key, title) values ('about', 'Otra') $$,
  '42501', null, 'pages cannot be created from the API'
);
select throws_ok(
  $$ delete from public.pages where key = 'support' $$,
  '42501', null, 'nor deleted'
);
select is_empty(
  $$ update public.pages set title = 'Cambio' where key = 'privacy-policy' returning id $$,
  'an editor cannot touch a legal page'
);
select throws_ok(
  $$ update public.pages set status = 'published' where key = 'about' $$,
  '23514', 'page_pending_text', 'a page that still says [PENDIENTE is not published'
);
select lives_ok(
  $$ update public.pages set body_text = '[DEMO] Somos una organización de Calarcá.', body = null,
       status = 'published' where key = 'about' $$,
  'with its real text the editor publishes an institutional page'
);

-- ---------------------------------------------------------------------------
-- Administrator: legal pages, each publication kept with its version
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

update public.pages set body_text = '[DEMO] Tratamos tus datos así.', body = null
where key = 'privacy-policy';
select throws_ok(
  $$ update public.pages set status = 'published' where key = 'privacy-policy' $$,
  '23514', null, 'a legal page needs a version to be published'
);
select lives_ok(
  $$ update public.pages set version = '1.0', status = 'published' where key = 'privacy-policy' $$,
  'the Administrator publishes version 1.0'
);
select is(
  (select version || ' · ' || body_text from public.page_versions
   where key = 'privacy-policy'),
  '1.0 · [DEMO] Tratamos tus datos así.', 'its exact text is kept with the version'
);
select throws_ok(
  $$ update public.pages set body_text = '[DEMO] Cambio sin versión nueva.'
     where key = 'privacy-policy' $$,
  '23514', 'legal_version_used', 'changing the published text needs a new version'
);
select lives_ok(
  $$ update public.pages set body_text = '[DEMO] Texto revisado.', version = '1.1'
     where key = 'privacy-policy' $$,
  'with a new version the change is published'
);
select is(
  (select array_agg(version order by published_at, version) from public.page_versions
   where key = 'privacy-policy'),
  array['1.0', '1.1'], 'both versions stay in the history'
);
select throws_ok(
  $$ update public.page_versions set body_text = 'otra cosa' $$,
  '42501', null, 'the history cannot be changed'
);
select throws_ok(
  $$ delete from public.page_versions $$,
  '42501', null, 'nor deleted'
);

set local role anon;
select is(
  (select array_agg(key order by key) from public.pages),
  array['about', 'privacy-policy'], 'visitors only see published pages'
);
select throws_ok(
  $$ select 1 from public.page_versions $$,
  '42501', null, 'visitors do not read the history'
);
reset role;

select * from finish();
rollback;
