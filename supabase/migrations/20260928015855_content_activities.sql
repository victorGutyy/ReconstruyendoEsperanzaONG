-- Migration 11 — content engine + activities (docs/06 §1.1 and §5, docs/04 §5.2, step 7.1)
--
-- Shared rules for every content table (states, who publishes, trash) and the
-- first content type: activities, with their photos and tags. The generic
-- functions are reused by the other content types in step 7.6.

-- ---------------------------------------------------------------------------
-- 1. Publication states. "Scheduled" is not a state: it is `published` with
--    published_at in the future (docs/06 §1.1).
-- ---------------------------------------------------------------------------
create type public.content_status as enum ('draft', 'review', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 160),
  cover_media_id uuid references public.media (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  summary text check (char_length(summary) <= 300),
  -- Tiptap JSON (never HTML, docs/05 §6) and its plain text for search
  body jsonb,
  body_text text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place_id uuid references public.places (id),
  category_id uuid references public.categories (id),
  -- What the organization reports; never invented figures
  results text check (char_length(results) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint activities_ends_after_start check (ends_at is null or ends_at >= starts_at),
  constraint activities_published_has_date check (status <> 'published' or published_at is not null),
  -- RN-A-02: every published activity has a general place and a category
  constraint activities_published_complete check (
    status <> 'published' or (place_id is not null and category_id is not null)
  )
);

comment on table public.activities is
  'Activities (RF-A-03). Published = status published and published_at <= now().';

create unique index activities_slug_key on public.activities (slug) where deleted_at is null;
create index activities_starts_at_idx on public.activities (starts_at desc);
create index activities_public_idx on public.activities (status, published_at);
create index activities_place_idx on public.activities (place_id);
create index activities_category_idx on public.activities (category_id);
create index activities_cover_idx on public.activities (cover_media_id);
create index activities_created_by_idx on public.activities (created_by);
create index activities_updated_by_idx on public.activities (updated_by);

-- The photos of an activity, in order. Own id so the audit log records them.
create table public.activity_media (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  -- restrict: a photo in use cannot be purged by mistake (the trash unlinks it first)
  media_id uuid not null references public.media (id),
  position int not null default 0,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  constraint activity_media_unique unique (activity_id, media_id)
);
create index activity_media_media_idx on public.activity_media (media_id);

create table public.activity_tags (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  tag_id uuid not null references public.tags (id),
  constraint activity_tags_unique unique (activity_id, tag_id)
);
create index activity_tags_tag_idx on public.activity_tags (tag_id);

-- Deferred from step 6.2: an authorization can say which activity it was signed for
alter table public.consent_records
  add column activity_id uuid references public.activities (id) on delete set null;
create index consent_records_activity_idx on public.consent_records (activity_id);

-- ---------------------------------------------------------------------------
-- 3. Where each photo is used: computed from the real references, so it can
--    never drift (decision 7.1-A). Used to block publication and, in 7.5, to
--    find the content affected by a revoked authorization.
-- ---------------------------------------------------------------------------
create view public.content_media_usages with (security_invoker = true) as
  select a.cover_media_id as media_id, 'activity'::text as entity_type, a.id as entity_id,
         'cover'::text as usage
  from public.activities a
  where a.cover_media_id is not null
  union all
  select am.media_id, 'activity'::text, am.activity_id, 'gallery'::text
  from public.activity_media am;

comment on view public.content_media_usages is
  'Where each photo is used (cover, gallery). Runs with the caller''s RLS.';

-- ---------------------------------------------------------------------------
-- 4. Rules that RLS cannot express (docs/06 §10 guard_content_changes)
-- ---------------------------------------------------------------------------

-- Generic for every content table: valid state changes (docs/04 §5.2), who
-- may publish, trash and restore. Without a user (server jobs) it does not apply.
create or replace function private.guard_content_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from text;
  v_to text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('published', 'archived') and not private.has_permission('content.publish') then
      raise exception 'Publishing requires content.publish' using errcode = '42501';
    end if;
    if new.deleted_at is not null then
      raise exception 'New content cannot start in the trash' using errcode = '42501';
    end if;
    return new;
  end if;

  v_from := old.status::text;
  v_to := new.status::text;

  if v_from <> v_to then
    if (v_from, v_to) not in (
      ('draft', 'review'), ('review', 'draft'),
      ('review', 'published'), ('draft', 'published'),
      ('published', 'archived'), ('published', 'draft'),
      ('archived', 'draft')
    ) then
      raise exception 'invalid_status_transition: % -> %', v_from, v_to using errcode = '23514';
    end if;
    if (v_from in ('published', 'archived') or v_to in ('published', 'archived'))
       and not private.has_permission('content.publish') then
      raise exception 'Publishing, unpublishing and archiving require content.publish'
        using errcode = '42501';
    end if;
  end if;

  -- Rescheduling something already published is also publishing
  if new.status = 'published' and new.published_at is distinct from old.published_at
     and not private.has_permission('content.publish') then
    raise exception 'Scheduling requires content.publish' using errcode = '42501';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if old.deleted_at is null and not private.has_permission('content.delete') then
      raise exception 'Sending to the trash requires content.delete' using errcode = '42501';
    end if;
    if old.deleted_at is not null and new.deleted_at is null
       and not private.has_permission('trash.restore') then
      raise exception 'Restoring requires trash.restore' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Raises when a photo cannot be public (docs/06 §6, HU-06). The message names
-- the photo and what it lacks so the panel can say which one to fix.
create or replace function private.assert_media_publishable(p_media_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_issues text[];
begin
  v_issues := private.media_publish_issues(p_media_id);
  if v_issues is null or cardinality(v_issues) > 0 then
    raise exception 'media_not_publishable'
      using errcode = '23514',
            detail = p_media_id::text || ':' || array_to_string(coalesce(v_issues, array['missing']), ',');
  end if;
end;
$$;

-- Activities: publish date, category scope, frozen slug and photos that can be public.
create or replace function private.check_activity()
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

  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.scope = 'activity'
  ) then
    raise exception 'The category must be an activity category' using errcode = '23514';
  end if;

  -- Public URLs do not change once the activity was published or scheduled
  if tg_op = 'UPDATE' and old.published_at is not null and new.slug is distinct from old.slug then
    raise exception 'The slug cannot change after publication' using errcode = '23514';
  end if;

  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published'
          or new.cover_media_id is distinct from old.cover_media_id) then
    for v_media in
      select new.cover_media_id where new.cover_media_id is not null
      union
      select am.media_id from public.activity_media am where am.activity_id = new.id
    loop
      perform private.assert_media_publishable(v_media);
    end loop;
  end if;

  return new;
end;
$$;

-- A photo added to (or moved within) an already published activity must be publishable too.
create or replace function private.check_activity_media()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.activities a where a.id = new.activity_id and a.status = 'published'
  ) then
    perform private.assert_media_publishable(new.media_id);
  end if;
  return new;
end;
$$;

-- Bridge tables follow their activity: whoever can edit it edits its photos and tags.
create or replace function private.can_edit_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = p_activity_id
      and a.deleted_at is null
      and private.is_aal2()
      and (
        private.has_permission('content.update_any')
        or (private.has_permission('content.update_own')
            and a.created_by = auth.uid()
            and a.status in ('draft', 'review'))
      )
  );
$$;

create trigger guard_content_changes before insert or update on public.activities
  for each row execute function private.guard_content_changes();
create trigger check_activity before insert or update on public.activities
  for each row execute function private.check_activity();
create trigger set_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
create trigger set_actor_columns before insert or update on public.activities
  for each row execute function public.set_actor_columns();
create trigger check_activity_media before insert or update on public.activity_media
  for each row execute function private.check_activity_media();

create trigger audit_row_change after insert or update or delete on public.activities
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.activity_media
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.activity_tags
  for each row execute function private.audit_row_change();

revoke execute on function private.guard_content_changes() from public, anon;
revoke execute on function private.assert_media_publishable(uuid) from public, anon;
revoke execute on function private.check_activity() from public, anon;
revoke execute on function private.check_activity_media() from public, anon;
revoke execute on function private.can_edit_activity(uuid) from public, anon;
grant execute on function private.guard_content_changes() to authenticated;
grant execute on function private.assert_media_publishable(uuid) to authenticated;
grant execute on function private.check_activity() to authenticated;
grant execute on function private.check_activity_media() to authenticated;
grant execute on function private.can_edit_activity(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row level security and explicit grants (docs/06 §10)
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;
alter table public.activity_media enable row level security;
alter table public.activity_tags enable row level security;

create policy "Visitors read published activities"
  on public.activities for select to anon
  using (status = 'published' and published_at <= now() and deleted_at is null);
create policy "Members with MFA read every activity; others only published ones"
  on public.activities for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read')))
    or (status = 'published' and published_at <= now() and deleted_at is null)
  );
create policy "With MFA, content creators add activities"
  on public.activities for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('content.create')));
create policy "With MFA, editors edit any activity; authors their drafts"
  on public.activities for update to authenticated
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
create policy "With MFA, trash purgers delete activities in the trash"
  on public.activities for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

-- Bridges are visible when their activity is visible to the caller
create policy "Photos of visible activities are visible"
  on public.activity_media for select to anon, authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));
create policy "Editors of the activity add its photos"
  on public.activity_media for insert to authenticated
  with check (private.can_edit_activity(activity_id));
create policy "Editors of the activity reorder its photos"
  on public.activity_media for update to authenticated
  using (private.can_edit_activity(activity_id))
  with check (private.can_edit_activity(activity_id));
create policy "Editors of the activity remove its photos"
  on public.activity_media for delete to authenticated
  using (private.can_edit_activity(activity_id));

create policy "Tags of visible activities are visible"
  on public.activity_tags for select to anon, authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));
create policy "Editors of the activity add its tags"
  on public.activity_tags for insert to authenticated
  with check (private.can_edit_activity(activity_id));
create policy "Editors of the activity remove its tags"
  on public.activity_tags for delete to authenticated
  using (private.can_edit_activity(activity_id));

-- Column grants: ids, authorship and timestamps are never written from the API
grant select on public.activities to anon, authenticated;
grant insert (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              summary, body, body_text, starts_at, ends_at, place_id, category_id, results)
  on public.activities to authenticated;
grant update (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              summary, body, body_text, starts_at, ends_at, place_id, category_id, results,
              deleted_at)
  on public.activities to authenticated;
grant delete on public.activities to authenticated;

grant select on public.activity_media, public.activity_tags to anon, authenticated;
grant insert (activity_id, media_id, position, caption) on public.activity_media to authenticated;
grant update (position, caption) on public.activity_media to authenticated;
grant delete on public.activity_media to authenticated;
grant insert (activity_id, tag_id) on public.activity_tags to authenticated;
grant delete on public.activity_tags to authenticated;

grant insert (activity_id), update (activity_id) on public.consent_records to authenticated;

grant select on public.content_media_usages to authenticated;
