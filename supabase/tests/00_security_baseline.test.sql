-- Security baseline for the whole `public` schema (docs/05 §5.2).
-- These checks run for every migration from now on: a new table or function
-- that breaks them fails CI.
begin;
select plan(7);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in public has row level security enabled'
);

-- Every function in public is closed to the API unless it is listed here on
-- purpose (each migration must `revoke execute ... from public, anon, authenticated`).
-- Functions that belong to extensions are excluded.
select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'execute')
      and p.oid::regprocedure::text not in (
        -- allow-list: add a function here only with a comment explaining why anon needs it
        -- Public search (step 8.6): security invoker, so the visitor's RLS still
        -- decides; it only reads published content and its input is plain text
        'search_content(text,integer,integer)'
      )
  $$,
  'no function in public is executable by anon unless allow-listed'
);

-- Default privileges: tables created by future migrations are not exposed
-- until a migration grants access explicitly (docs/04 §8.1).
create table public.__probe_default_privileges (id int primary key);
create function public.__probe_default_function() returns int language sql as 'select 1';

select ok(
  not has_table_privilege('anon', 'public.__probe_default_privileges', 'select'),
  'new tables are not readable by anon by default'
);

select ok(
  not has_table_privilege('authenticated', 'public.__probe_default_privileges', 'select'),
  'new tables are not readable by authenticated by default'
);

-- New functions get no explicit grant for the API roles (only the global PUBLIC
-- default remains, which each migration revokes per function).
select is_empty(
  $$
    select a.grantee::regrole::text
    from pg_proc p,
         lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.__probe_default_function()'::regprocedure
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
  $$,
  'new functions get no explicit EXECUTE grant for anon or authenticated'
);

-- The server key works on every table (staging exposes nothing by default:
-- without these, server writes fail there while the local stack passes)
select is_empty(
  $$
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not (has_table_privilege('service_role', c.oid, 'select')
               and has_table_privilege('service_role', c.oid, 'insert'))
  $$,
  'the server role reads and writes every table'
);
select ok(
  not has_table_privilege('service_role', 'public.audit_logs', 'update')
  and not has_table_privilege('service_role', 'public.audit_logs', 'delete')
  and not has_table_privilege('service_role', 'public.page_versions', 'update'),
  'append-only records stay append-only for the server too'
);

select * from finish();
rollback;
