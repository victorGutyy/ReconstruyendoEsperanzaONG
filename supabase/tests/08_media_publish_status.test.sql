-- Photo publish status for every member (migration media_publish_status, step 6.4).
begin;
select plan(7);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

insert into public.media (id, processing_status, private_path, alt_text, people_in_photo, uploaded_by) values
  ('d0000000-0000-0000-0000-000000000001', 'ready', 'p/1', 'Árboles', 'none', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'ready', 'p/2', 'Taller', 'identifiable', 'bbbbbbbb-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select is(
  (select array_agg(media_id::text || ':' || array_to_string(issues, ',') order by media_id)
   from public.media_publish_status(array[
     'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002']::uuid[])),
  array['d0000000-0000-0000-0000-000000000001:', 'd0000000-0000-0000-0000-000000000002:missing_consent'],
  'an author learns what each photo needs, even about authorizations'
);
select is(
  (select count(*)::int from public.consent_records), 0,
  'the author still cannot read the authorizations themselves'
);
select is(
  (select count(*)::int from public.media_publish_status(
     array(select gen_random_uuid() from generate_series(1, 501)))),
  0, 'more than 500 photos at once returns nothing'
);

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}', true);
select is(
  (select count(*)::int from public.media_publish_status(
     array['d0000000-0000-0000-0000-000000000001']::uuid[])),
  0, 'without MFA it returns nothing'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from public.media_publish_status(array['d0000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', null, 'visitors cannot call it'
);
reset role;

select is(
  (select pg_get_function_result('public.media_publish_status(uuid[])'::regprocedure)),
  'TABLE(media_id uuid, issues text[])', 'it returns only ids and issue codes'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.media_publish_status(uuid[])'::regprocedure),
  'the exposed function runs with the caller''s rights (RLS applies)'
);

select * from finish();
rollback;
