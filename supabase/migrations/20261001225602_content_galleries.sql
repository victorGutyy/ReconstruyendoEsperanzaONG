-- Galleries (RF-A-06, docs/06 §5) on the shared content engine (step 7.6c).
--
-- Same states, review note, permissions and audit as the other content. A
-- gallery may belong to an activity or a project. Every photo of a published
-- gallery must be publishable, like the photos of an activity.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 160),
  cover_media_id uuid references public.media (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (char_length(description) <= 1000),
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
  -- Of an activity, of a project, or of neither
  constraint galleries_one_owner check (activity_id is null or project_id is null),
  constraint galleries_published_has_date check (status <> 'published' or published_at is not null)
);

comment on table public.galleries is
  'Photo galleries (RF-A-06). Published = status published and published_at <= now().';

create unique index galleries_slug_key on public.galleries (slug) where deleted_at is null;
create index galleries_public_idx on public.galleries (status, published_at);
create index galleries_cover_idx on public.galleries (cover_media_id);
create index galleries_activity_idx on public.galleries (activity_id);
create index galleries_project_idx on public.galleries (project_id);
create index galleries_created_by_idx on public.galleries (created_by);
create index galleries_updated_by_idx on public.galleries (updated_by);
create index galleries_review_note_by_idx on public.galleries (review_note_by);

-- The photos of a gallery, in order. Own id so the audit log records them.
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  -- restrict: a photo in use cannot be purged by mistake (the trash unlinks it first)
  media_id uuid not null references public.media (id),
  position int not null default 0,
  caption text check (char_length(caption) <= 300),
  created_at timestamptz not null default now(),
  constraint gallery_items_unique unique (gallery_id, media_id)
);
create index gallery_items_media_idx on public.gallery_items (media_id);

-- ---------------------------------------------------------------------------
-- 2. Rules
-- ---------------------------------------------------------------------------
-- Publish date, frozen slug, at least one photo and every photo publishable
create or replace function private.check_gallery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_media uuid;
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  -- Public URLs do not change once the gallery was published or scheduled
  if tg_op = 'UPDATE' and old.published_at is not null and new.slug is distinct from old.slug then
    raise exception 'The slug cannot change after publication' using errcode = '23514';
  end if;

  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published'
          or new.cover_media_id is distinct from old.cover_media_id) then
    if not exists (select 1 from public.gallery_items gi where gi.gallery_id = new.id) then
      raise exception 'gallery_empty' using errcode = '23514';
    end if;
    for v_media in
      select new.cover_media_id where new.cover_media_id is not null
      union
      select gi.media_id from public.gallery_items gi where gi.gallery_id = new.id
    loop
      perform private.assert_media_publishable(v_media);
    end loop;
  end if;

  return new;
end;
$$;

-- A photo added to (or moved within) a published gallery must be publishable too
create or replace function private.check_gallery_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.galleries g where g.id = new.gallery_id and g.status = 'published'
  ) then
    perform private.assert_media_publishable(new.media_id);
  end if;
  return new;
end;
$$;

-- Items follow their gallery: whoever can edit it edits its photos
create or replace function private.can_edit_gallery(p_gallery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.galleries g
    where g.id = p_gallery_id
      and g.deleted_at is null
      and private.is_aal2()
      and (
        private.has_permission('content.update_any')
        or (private.has_permission('content.update_own')
            and g.created_by = auth.uid()
            and g.status in ('draft', 'review'))
      )
  );
$$;

-- Triggers fire in name order: "validate_gallery" runs after the permission
-- guard, so a missing permission is reported before a missing photo
create trigger validate_gallery before insert or update on public.galleries
  for each row execute function private.check_gallery();
create trigger guard_content_changes before insert or update on public.galleries
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.galleries
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.galleries
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.galleries
  for each row execute function private.track_review_note();
create trigger check_gallery_item before insert or update on public.gallery_items
  for each row execute function private.check_gallery_item();

create trigger audit_row_change after insert or update or delete on public.galleries
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.gallery_items
  for each row execute function private.audit_row_change();

revoke execute on function private.check_gallery() from public, anon;
revoke execute on function private.check_gallery_item() from public, anon;
revoke execute on function private.can_edit_gallery(uuid) from public, anon;
grant execute on function private.check_gallery() to authenticated;
grant execute on function private.check_gallery_item() to authenticated;
grant execute on function private.can_edit_gallery(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security and explicit grants (same as the other content)
-- ---------------------------------------------------------------------------
alter table public.galleries enable row level security;
alter table public.gallery_items enable row level security;

create policy "Visitors read published galleries"
  on public.galleries for select to anon
  using (status = 'published' and published_at <= now() and deleted_at is null);
create policy "Members with MFA read every gallery; others only published ones"
  on public.galleries for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read')))
    or (status = 'published' and published_at <= now() and deleted_at is null)
  );
create policy "With MFA, content creators add galleries"
  on public.galleries for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('content.create')));
create policy "With MFA, editors edit any gallery; authors their drafts"
  on public.galleries for update to authenticated
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
create policy "With MFA, trash purgers delete galleries in the trash"
  on public.galleries for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

-- Items are visible when their gallery is visible to the caller
create policy "Photos of visible galleries are visible"
  on public.gallery_items for select to anon, authenticated
  using (exists (select 1 from public.galleries g where g.id = gallery_id));
create policy "Editors of the gallery add its photos"
  on public.gallery_items for insert to authenticated
  with check (private.can_edit_gallery(gallery_id));
create policy "Editors of the gallery reorder its photos"
  on public.gallery_items for update to authenticated
  using (private.can_edit_gallery(gallery_id))
  with check (private.can_edit_gallery(gallery_id));
create policy "Editors of the gallery remove its photos"
  on public.gallery_items for delete to authenticated
  using (private.can_edit_gallery(gallery_id));

grant select on public.galleries, public.gallery_items to anon, authenticated;
grant insert (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              description, activity_id, project_id)
  on public.galleries to authenticated;
grant update (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              description, activity_id, project_id, review_note, deleted_at)
  on public.galleries to authenticated;
grant delete on public.galleries to authenticated;
grant insert (gallery_id, media_id, position, caption) on public.gallery_items to authenticated;
grant update (position, caption) on public.gallery_items to authenticated;
grant delete on public.gallery_items to authenticated;

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
  from public.gallery_items gi;

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
    else false
  end;
$$;
