-- Videos (RF-A-07, docs/06 §5) on the shared content engine (step 7.6c).
--
-- Only the provider and the video id are stored: never HTML, an iframe or the
-- pasted URL (docs/05 §6). The server extracts the id from an allow-listed
-- link. Videos have no page of their own (no slug, decision 7.6c): they show
-- in a "Videos" section and inside their activity or project. The optional
-- cover is a photo from the library (third-party thumbnails would tell those
-- companies who visits the site).

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  cover_media_id uuid references public.media (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (char_length(description) <= 1000),
  provider text not null check (provider in ('youtube', 'vimeo', 'facebook', 'tiktok')),
  provider_video_id text not null check (provider_video_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  activity_id uuid references public.activities (id),
  project_id uuid references public.projects (id),
  review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  review_note_by uuid references public.profiles (id),
  review_note_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint videos_one_owner check (activity_id is null or project_id is null),
  constraint videos_published_has_date check (status <> 'published' or published_at is not null)
);

comment on table public.videos is
  'Embedded videos (RF-A-07): provider + id only, never HTML. Published = status published and published_at <= now().';

-- The same video is registered once (among rows not in the trash)
create unique index videos_provider_video_key on public.videos (provider, provider_video_id)
  where deleted_at is null;
create index videos_public_idx on public.videos (status, published_at);
create index videos_cover_idx on public.videos (cover_media_id);
create index videos_activity_idx on public.videos (activity_id);
create index videos_project_idx on public.videos (project_id);
create index videos_created_by_idx on public.videos (created_by);
create index videos_updated_by_idx on public.videos (updated_by);
create index videos_review_note_by_idx on public.videos (review_note_by);

-- ---------------------------------------------------------------------------
-- 2. Rules: publish date and a publishable cover
-- ---------------------------------------------------------------------------
create or replace function private.check_video()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status = 'published' and new.cover_media_id is not null
     and (tg_op = 'INSERT' or old.status <> 'published'
          or new.cover_media_id is distinct from old.cover_media_id) then
    perform private.assert_media_publishable(new.cover_media_id);
  end if;

  return new;
end;
$$;

-- Triggers fire in name order: "validate_video" runs after the permission guard
create trigger guard_content_changes before insert or update on public.videos
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.videos
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.videos
  for each row execute function private.track_review_note();
create trigger validate_video before insert or update on public.videos
  for each row execute function private.check_video();
create trigger audit_row_change after insert or update or delete on public.videos
  for each row execute function private.audit_row_change();

revoke execute on function private.check_video() from public, anon;
grant execute on function private.check_video() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security and explicit grants (same as the other content)
-- ---------------------------------------------------------------------------
alter table public.videos enable row level security;

create policy "Visitors read published videos"
  on public.videos for select to anon
  using (status = 'published' and published_at <= now() and deleted_at is null);
create policy "Members with MFA read every video; others only published ones"
  on public.videos for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read')))
    or (status = 'published' and published_at <= now() and deleted_at is null)
  );
create policy "With MFA, content creators add videos"
  on public.videos for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('content.create')));
create policy "With MFA, editors edit any video; authors their drafts"
  on public.videos for update to authenticated
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
create policy "With MFA, trash purgers delete videos in the trash"
  on public.videos for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

grant select on public.videos to anon, authenticated;
grant insert (status, published_at, cover_media_id, title, description, provider,
              provider_video_id, activity_id, project_id)
  on public.videos to authenticated;
grant update (status, published_at, cover_media_id, title, description, provider,
              provider_video_id, activity_id, project_id, review_note, deleted_at)
  on public.videos to authenticated;
grant delete on public.videos to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Where photos are used, and whether that content is published
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
  where pr.cover_media_id is not null
  union all
  select g.cover_media_id, 'gallery'::text, g.id, 'cover'::text
  from public.galleries g
  where g.cover_media_id is not null
  union all
  select gi.media_id, 'gallery'::text, gi.gallery_id, 'gallery'::text
  from public.gallery_items gi
  union all
  select v.cover_media_id, 'video'::text, v.id, 'cover'::text
  from public.videos v
  where v.cover_media_id is not null;

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
    when 'gallery' then exists (
      select 1 from public.galleries g
      where g.id = p_id and g.status = 'published' and g.deleted_at is null)
    when 'video' then exists (
      select 1 from public.videos v
      where v.id = p_id and v.status = 'published' and v.deleted_at is null)
    else false
  end;
$$;
