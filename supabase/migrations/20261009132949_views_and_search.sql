-- Memoria and search (step 8.6, docs/06 §8, RF-A-08, RF-A-12, HU-01).

-- ---------------------------------------------------------------------------
-- 1. Spanish without accents: "jornada de salud" finds "Jornada de Salúd"
-- ---------------------------------------------------------------------------
create text search configuration public.es_unaccent (copy = pg_catalog.spanish);
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, spanish_stem;

comment on text search configuration public.es_unaccent is
  'Spanish stemming without accents (search, step 8.6).';

-- ---------------------------------------------------------------------------
-- 2. What each content says, weighted: title (A) > summary (B) > text (C)
-- ---------------------------------------------------------------------------
alter table public.activities add column search_vector tsvector generated always as (
  setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(title, '')), 'A')
  || setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(summary, '')), 'B')
  || setweight(to_tsvector('public.es_unaccent'::regconfig,
                           coalesce(body_text, '') || ' ' || coalesce(results, '')), 'C')
) stored;

alter table public.posts add column search_vector tsvector generated always as (
  setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(title, '')), 'A')
  || setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(excerpt, '')), 'B')
  || setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(body_text, '')), 'C')
) stored;

alter table public.projects add column search_vector tsvector generated always as (
  setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(title, '')), 'A')
  || setweight(to_tsvector('public.es_unaccent'::regconfig,
                           coalesce(summary, '') || ' ' || coalesce(objective, '')), 'B')
  || setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(body_text, '')), 'C')
) stored;

create index activities_search_idx on public.activities using gin (search_vector);
create index posts_search_idx on public.posts using gin (search_vector);
create index projects_search_idx on public.projects using gin (search_vector);

-- The search vector is derived from the text: never worth an audit entry
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[] := '{}';
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - 'search_vector';
    v_action := 'insert';
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old) - 'search_vector';
    v_action := 'delete';
  else
    v_old := to_jsonb(old) - 'search_vector';
    v_new := to_jsonb(new) - 'search_vector';

    -- Bookkeeping columns alone are noise, not a change worth auditing
    select coalesce(array_agg(n.key order by n.key), '{}')
    into v_changed
    from jsonb_each(v_new) as n
    where n.key not in ('updated_at', 'updated_by')
      and n.value is distinct from (v_old -> n.key);

    if cardinality(v_changed) = 0 then
      return null;
    end if;

    v_action := case
      when 'deleted_at' = any (v_changed) and v_old ->> 'deleted_at' is null then 'soft_delete'
      when 'deleted_at' = any (v_changed) and v_new ->> 'deleted_at' is null then 'restore'
      when 'status' = any (v_changed) and v_new ->> 'status' = 'published' then 'publish'
      when 'status' = any (v_changed) and v_old ->> 'status' = 'published' then 'unpublish'
      when 'role_id' = any (v_changed) then 'role_change'
      when 'is_active' = any (v_changed) then 'status_change'
      else 'update'
    end;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, changed_fields)
  values (
    auth.uid(),
    v_action,
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    v_old,
    v_new,
    v_changed
  );

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Memoria: everything done, by year (docs/06 §8). Runs with the caller's
--    RLS and says "published and its date arrived" itself, so a member of
--    the panel reading it sees exactly what visitors see.
-- ---------------------------------------------------------------------------
create view public.public_timeline with (security_invoker = true) as
  select 'activity'::text as entity_type, a.id, a.title, a.slug, a.summary, a.cover_media_id,
         a.starts_at as event_at,
         extract(year from a.starts_at at time zone 'America/Bogota')::int as year,
         pl.name as place_name
  from public.activities a
  left join public.places pl on pl.id = a.place_id
  where a.status = 'published' and a.published_at <= now() and a.deleted_at is null
    -- Memoria is what was done: upcoming activities stay in /actividades
    and a.starts_at <= now()
  union all
  select 'post', p.id, p.title, p.slug, p.excerpt, p.cover_media_id,
         p.published_at,
         extract(year from p.published_at at time zone 'America/Bogota')::int,
         null
  from public.posts p
  where p.status = 'published' and p.published_at <= now() and p.deleted_at is null
  union all
  select 'project', pr.id, pr.title, pr.slug, pr.summary, pr.cover_media_id,
         coalesce(pr.start_date::timestamp at time zone 'America/Bogota', pr.published_at),
         coalesce(extract(year from pr.start_date)::int,
                  extract(year from pr.published_at at time zone 'America/Bogota')::int),
         null
  from public.projects pr
  where pr.status = 'published' and pr.published_at <= now() and pr.deleted_at is null;

comment on view public.public_timeline is
  'Memoria (RF-A-08): published activities already done, stories and projects, by year.';

grant select on public.public_timeline to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Search (RF-A-12): published content by relevance. Runs with the
--    caller's RLS; the query is plain text for websearch_to_tsquery, never SQL.
-- ---------------------------------------------------------------------------
create or replace function public.search_content(
  p_query text,
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  entity_type text,
  id uuid,
  title text,
  slug text,
  summary text,
  event_at timestamptz,
  rank real,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('public.es_unaccent'::regconfig, left(btrim(p_query), 100)) as query
  ),
  hits as (
    select 'activity'::text as entity_type, a.id, a.title, a.slug, a.summary,
           a.starts_at as event_at, ts_rank(a.search_vector, q.query) as rank
    from public.activities a, q
    where a.search_vector @@ q.query
      and a.status = 'published' and a.published_at <= now() and a.deleted_at is null
    union all
    select 'post', p.id, p.title, p.slug, p.excerpt, p.published_at,
           ts_rank(p.search_vector, q.query)
    from public.posts p, q
    where p.search_vector @@ q.query
      and p.status = 'published' and p.published_at <= now() and p.deleted_at is null
    union all
    select 'project', pr.id, pr.title, pr.slug, pr.summary, pr.published_at,
           ts_rank(pr.search_vector, q.query)
    from public.projects pr, q
    where pr.search_vector @@ q.query
      and pr.status = 'published' and pr.published_at <= now() and pr.deleted_at is null
  )
  select h.entity_type, h.id, h.title, h.slug, h.summary, h.event_at, h.rank,
         count(*) over () as total
  from hits h
  where char_length(btrim(p_query)) between 2 and 100
  order by h.rank desc, h.event_at desc
  limit least(greatest(p_limit, 1), 20)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_content(text, int, int) is
  'Search of published content (RF-A-12), by relevance. Caller''s RLS applies.';

revoke execute on function public.search_content(text, int, int) from public;
grant execute on function public.search_content(text, int, int) to anon, authenticated;
