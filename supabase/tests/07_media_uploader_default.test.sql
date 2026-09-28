-- media.uploaded_by defaults to the signed-in user (migration media_uploader_default, step 6.3).
begin;
select plan(2);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'author@example.test', '{"role":"author"}', '{}');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

-- What the app sends: no columns at all
select lives_ok(
  $$ insert into public.media default values $$,
  'an author adds a photo row without naming any column'
);
select is(
  (select count(*)::int from public.media
   where uploaded_by = 'bbbbbbbb-0000-0000-0000-000000000003'),
  1, 'the photo belongs to the signed-in user'
);
reset role;

select * from finish();
rollback;
