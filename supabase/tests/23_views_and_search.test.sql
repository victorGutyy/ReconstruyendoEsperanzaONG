-- Memoria and search (migration views_and_search, step 8.6).
begin;
select plan(10);

insert into public.categories (id, scope, name, slug) values
  ('ca000000-0000-0000-0000-000000000001', 'activity', '[DEMO] Salud', 'demo-salud-t'),
  ('ca000000-0000-0000-0000-000000000002', 'post', '[DEMO] Voces', 'demo-voces-t');
insert into public.places (id, name, slug, kind) values
  ('9a000000-0000-0000-0000-000000000001', '[DEMO] La Huerta', 'demo-la-huerta-t', 'vereda');

insert into public.activities (id, slug, title, summary, starts_at, status, published_at, place_id, category_id) values
  ('a0000000-0000-0000-0000-000000000001', 'demo-jornada-t', '[DEMO] Jornada de Salúd',
   '[DEMO] Atención básica', '2025-12-31T23:30:00-05:00', 'published', now() - interval '1 day',
   '9a000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'demo-futura-t', '[DEMO] Brigada futura de salud',
   null, now() + interval '10 days', 'published', now() - interval '1 day',
   '9a000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001');
insert into public.activities (id, slug, title, starts_at) values
  ('a0000000-0000-0000-0000-000000000003', 'demo-borrador-t', '[DEMO] Borrador de salud', now());
insert into public.posts (id, slug, title, excerpt, category_id, status, published_at) values
  ('b0000000-0000-0000-0000-000000000001', 'demo-historia-t', '[DEMO] Historia del agua',
   '[DEMO] La jornada de salud en la vereda', 'ca000000-0000-0000-0000-000000000002',
   'published', now() - interval '2 days');
insert into public.projects (id, slug, title, summary, start_date, status, published_at) values
  ('c1000000-0000-0000-0000-000000000001', 'demo-huertas-t', '[DEMO] Huertas', '[DEMO] Huertas',
   '2024-03-01', 'published', now() - interval '3 days');
insert into public.projects (id, slug, title, summary, status, published_at) values
  ('c1000000-0000-0000-0000-000000000002', 'demo-archivado-t', '[DEMO] Archivado', '[DEMO] Viejo',
   'archived', now() - interval '3 days');

set local role anon;

select is(
  (select array_agg(slug order by slug) from public.public_timeline where slug like '%-t'),
  array['demo-historia-t', 'demo-huertas-t', 'demo-jornada-t'],
  'Memoria shows done activities, stories and projects; no drafts, archived or upcoming'
);
select is(
  (select year from public.public_timeline where slug = 'demo-jornada-t'), 2025,
  'the year is the one in Colombia (31 Dec, 11:30 p.m.)'
);
select is(
  (select year from public.public_timeline where slug = 'demo-huertas-t'), 2024,
  'a project is placed by its start date'
);
select is(
  (select place_name from public.public_timeline where slug = 'demo-jornada-t'), '[DEMO] La Huerta',
  'an activity carries its general place'
);

select is(
  (select array_agg(slug order by slug) from public.search_content('jornada de salud')
   where slug like '%-t'),
  array['demo-historia-t', 'demo-jornada-t'],
  'search ignores accents and capitals and needs every word; drafts never match'
);
select is(
  (select slug from public.search_content('jornada de salud') where slug like '%-t'
   order by rank desc limit 1),
  'demo-jornada-t', 'a word in the title weighs more than in the summary'
);
select is(
  (select count(*)::int from public.search_content('a')), 0,
  'a one-letter search returns nothing'
);
select lives_ok(
  $$ select * from public.search_content('salud" OR 1=1; drop table posts; --') $$,
  'any text is a search, never SQL'
);
select is(
  (select count(*)::int from public.search_content('salud', 500, 0)) <= 20, true,
  'a page has at most 20 results'
);
reset role;

update public.posts set title = '[DEMO] Historia del río' where slug = 'demo-historia-t';
select ok(
  not exists (
    select 1 from public.audit_logs
    where table_name = 'posts' and 'search_vector' = any (changed_fields)
  ),
  'the derived search vector never appears in the audit log'
);

select * from finish();
rollback;
