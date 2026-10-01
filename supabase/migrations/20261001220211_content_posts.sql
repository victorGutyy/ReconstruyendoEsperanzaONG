-- Stories (posts, RF-A-04, docs/06 §5) on the shared content engine (step 7.6a).
--
-- Same states, review note, permissions and audit as activities. Photos: only
-- the cover. Public photos now check published content of any type through
-- private.content_is_published, so each new type adds one line there.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 160),
  cover_media_id uuid references public.media (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  excerpt text check (char_length(excerpt) <= 300),
  -- Tiptap JSON (never HTML, docs/05 §6) and its plain text for search
  body jsonb,
  body_text text,
  category_id uuid references public.categories (id),
  -- Public signature, editable; the internal author is created_by (decision 7.6a)
  byline text check (char_length(btrim(byline)) between 1 and 120),
  review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  review_note_by uuid references public.profiles (id),
  review_note_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint posts_published_has_date check (status <> 'published' or published_at is not null),
  -- A published story has a category and an excerpt for its card
  constraint posts_published_complete check (
    status <> 'published' or (category_id is not null and btrim(coalesce(excerpt, '')) <> '')
  )
);

comment on table public.posts is
  'Stories (RF-A-04). Published = status published and published_at <= now().';

create unique index posts_slug_key on public.posts (slug) where deleted_at is null;
create index posts_public_idx on public.posts (status, published_at);
create index posts_category_idx on public.posts (category_id);
create index posts_cover_idx on public.posts (cover_media_id);
create index posts_created_by_idx on public.posts (created_by);
create index posts_updated_by_idx on public.posts (updated_by);
create index posts_review_note_by_idx on public.posts (review_note_by);

-- ---------------------------------------------------------------------------
-- 2. Rules: publish date, story category, frozen slug, publishable cover
-- ---------------------------------------------------------------------------
create or replace function private.check_post()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.scope = 'post'
  ) then
    raise exception 'The category must be a story category' using errcode = '23514';
  end if;

  -- Public URLs do not change once the story was published or scheduled
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

-- Same chain as activities (triggers fire in name order)
create trigger check_post before insert or update on public.posts
  for each row execute function private.check_post();
create trigger guard_content_changes before insert or update on public.posts
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.posts
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.posts
  for each row execute function private.track_review_note();
create trigger audit_row_change after insert or update or delete on public.posts
  for each row execute function private.audit_row_change();

revoke execute on function private.check_post() from public, anon;
grant execute on function private.check_post() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security and explicit grants (same as activities)
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;

create policy "Visitors read published stories"
  on public.posts for select to anon
  using (status = 'published' and published_at <= now() and deleted_at is null);
create policy "Members with MFA read every story; others only published ones"
  on public.posts for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read')))
    or (status = 'published' and published_at <= now() and deleted_at is null)
  );
create policy "With MFA, content creators add stories"
  on public.posts for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('content.create')));
create policy "With MFA, editors edit any story; authors their drafts"
  on public.posts for update to authenticated
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
create policy "With MFA, trash purgers delete stories in the trash"
  on public.posts for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

-- Ids, authorship, timestamps and who wrote the review note never come from the API
grant select on public.posts to anon, authenticated;
grant insert (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              excerpt, body, body_text, category_id, byline)
  on public.posts to authenticated;
grant update (slug, status, published_at, seo_title, seo_description, cover_media_id, title,
              excerpt, body, body_text, category_id, byline, review_note, deleted_at)
  on public.posts to authenticated;
grant delete on public.posts to authenticated;

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
  where p.cover_media_id is not null;

-- Published or scheduled and not in the trash. Each content type adds its line (7.6).
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
    else false
  end;
$$;

revoke execute on function private.content_is_published(text, uuid) from public, anon;
grant execute on function private.content_is_published(text, uuid) to authenticated, service_role;

create or replace function public.media_public_targets(p_media_ids uuid[] default null)
returns table (media_id uuid, public_key text, should_be_public boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select m.id, m.public_key
    from public.media m
    where (p_media_ids is not null and m.id = any (p_media_ids))
       or (p_media_ids is null and (
             m.public_key is not null
             or exists (select 1 from public.content_media_usages u where u.media_id = m.id)))
  )
  select
    c.id,
    c.public_key,
    exists (
      select 1
      from public.content_media_usages u
      where u.media_id = c.id and private.content_is_published(u.entity_type, u.entity_id)
    )
    and coalesce(cardinality(private.media_publish_issues(c.id)) = 0, false)
  from candidates c;
$$;
