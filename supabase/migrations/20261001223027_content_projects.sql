-- Projects (RF-A-05, docs/06 §5) on the shared content engine (step 7.6b),
-- and the project an activity belongs to.
--
-- Same states, review note, permissions and audit as activities and stories.
-- project_status (planned, active…) is the project's own life, not its
-- publication state. Photos: only the cover.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 160),
  cover_media_id uuid references public.media (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  summary text check (char_length(summary) <= 300),
  objective text check (char_length(objective) <= 1000),
  -- Tiptap JSON (never HTML, docs/05 §6) and its plain text for search
  body jsonb,
  body_text text,
  project_status text not null default 'planned'
    check (project_status in ('planned', 'active', 'paused', 'completed')),
  start_date date,
  end_date date,
  review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  review_note_by uuid references public.profiles (id),
  review_note_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint projects_dates_in_order check (end_date is null or start_date is null
                                            or end_date >= start_date),
  constraint projects_published_has_date check (status <> 'published' or published_at is not null),
  -- A published project has a summary for its card (decision 7.6b)
  constraint projects_published_complete check (
    status <> 'published' or btrim(coalesce(summary, '')) <> ''
  )
);

comment on table public.projects is
  'Projects (RF-A-05). Published = status published and published_at <= now().';

create unique index projects_slug_key on public.projects (slug) where deleted_at is null;
create index projects_public_idx on public.projects (status, published_at);
create index projects_cover_idx on public.projects (cover_media_id);
create index projects_created_by_idx on public.projects (created_by);
create index projects_updated_by_idx on public.projects (updated_by);
create index projects_review_note_by_idx on public.projects (review_note_by);

-- ---------------------------------------------------------------------------
-- 2. Rules: publish date, frozen slug, publishable cover
-- ---------------------------------------------------------------------------
create or replace function private.check_project()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  -- Public URLs do not change once the project was published or scheduled
  if tg_op = 'UPDATE' and old.published_at is not null and new.slug is distinct from old.slug then
    raise exception 'The slug cannot change after publication' using errcode = '23514';
  end if;

  if new.status = 'published' and new.cover_media_id is not null
     and (tg_op = 'INSERT' or old.status <> 'published'
          or new.cover_media_id is distinct from old.cover_media_id) then
    perform private.assert_media_publishable(new.cover_media_id);
  end if;

  return new;
end;
$$;

-- Same chain as the other content tables (triggers fire in name order)
create trigger check_project before insert or update on public.projects
  for each row execute function private.check_project();
create trigger guard_content_changes before insert or update on public.projects
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.projects
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.projects
  for each row execute function private.track_review_note();
create trigger audit_row_change after insert or update or delete on public.projects
  for each row execute function private.audit_row_change();

revoke execute on function private.check_project() from public, anon;
grant execute on function private.check_project() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security and explicit grants (same as the other content)
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

create policy "Visitors read published projects"
  on public.projects for select to anon
  using (status = 'published' and published_at <= now() and deleted_at is null);
create policy "Members with MFA read every project; others only published ones"
  on public.projects for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read')))
    or (status = 'published' and published_at <= now() and deleted_at is null)
  );
create policy "With MFA, content creators add projects"
  on public.projects for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('content.create')));
create policy "With MFA, editors edit any project; authors their drafts"
  on public.projects for update to authenticated
  using (
    (select private.is_aal2())
    and (
      (select private.has_permission('content.update_any'))
      or ((select private.has_permission('content.update_own'))
          and created_by = (select auth.uid())
          and status in ('draft', 'review'))
    )
  )
  with check (
    (select private.is_aal2())
    and (
      (select private.has_permission('content.update_any'))
      or ((select private.has_permission('content.update_own'))
          and created_by = (select auth.uid())
          and status in ('draft', 'review'))
    )
  );
create policy "With MFA, trash purgers delete projects in the trash"
  on public.projects for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

grant select on public.projects to anon, authenticated;
grant insert (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              summary, objective, body, body_text, project_status, start_date, end_date)
  on public.projects to authenticated;
grant update (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              summary, objective, body, body_text, project_status, start_date, end_date,
              review_note, deleted_at)
  on public.projects to authenticated;
grant delete on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The project of an activity (optional). It may still be a draft: the
--    public site only links to it once it is published (decision 7.6b).
-- ---------------------------------------------------------------------------
alter table public.activities add column project_id uuid references public.projects (id);
create index activities_project_idx on public.activities (project_id);
grant insert (project_id), update (project_id) on public.activities to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Where photos are used, and whether that content is published
-- ---------------------------------------------------------------------------
create or replace view public.content_media_usages with (security_invoker = true) as
  select a.cover_media_id as media_id, 'activity'::text as entity_type, a.id as entity_id,
         'cover'::text as usage
  from public.activities a
  where a.cover_media_id is not null
  union all
  select am.media_id, 'activity'::text, am.activity_id, 'gallery'::text
  from public.activity_media am
  union all
  select p.cover_media_id, 'post'::text, p.id, 'cover'::text
  from public.posts p
  where p.cover_media_id is not null
  union all
  select pr.cover_media_id, 'project'::text, pr.id, 'cover'::text
  from public.projects pr
  where pr.cover_media_id is not null;

create or replace function private.content_is_published(p_type text, p_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case p_type
    when 'activity' then exists (
      select 1 from public.activities a
      where a.id = p_id and a.status = 'published' and a.deleted_at is null)
    when 'post' then exists (
      select 1 from public.posts p
      where p.id = p_id and p.status = 'published' and p.deleted_at is null)
    when 'project' then exists (
      select 1 from public.projects pr
      where pr.id = p_id and pr.status = 'published' and pr.deleted_at is null)
    else false
  end;
$$;
