-- Testimonials (docs/06 §5) on the shared content engine (step 7.6d).
--
-- A testimonial is the voice of a real person: it cannot exist without their
-- authorization (consent_record_id not null), only people who manage
-- authorizations write them, minors are not allowed (decision 7.6d), and it
-- leaves the public site as soon as the authorization is revoked or expires.
--
-- Visitors cannot read authorizations (personal data), so the testimonial
-- keeps two facts copied from it, kept current by triggers:
--   consent_withdrawn   revoked, in the trash or of a minor
--   consent_valid_until its end date (compared with today in Colombia)
-- Neither is writable from the API.

-- ---------------------------------------------------------------------------
-- 1. Is an authorization usable right now? (server code and triggers)
-- ---------------------------------------------------------------------------
create or replace function private.consent_is_valid(p_consent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consent_records c
    where c.id = p_consent_id
      and c.deleted_at is null
      and c.revoked_at is null
      and not c.is_minor
      and (c.valid_until is null
           or c.valid_until >= (now() at time zone 'America/Bogota')::date)
  );
$$;

revoke execute on function private.consent_is_valid(uuid) from public, anon;
grant execute on function private.consent_is_valid(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  -- The person's photo (optional): publishable like any photo with people
  cover_media_id uuid references public.media (id),
  quote text not null check (char_length(btrim(quote)) between 1 and 600),
  -- What the site shows, e.g. "María" or "M. G." (not necessarily the full name)
  author_display_name text not null check (char_length(btrim(author_display_name)) between 1 and 80),
  author_context text check (char_length(author_context) <= 160),
  consent_record_id uuid not null references public.consent_records (id),
  consent_withdrawn boolean not null default false,
  consent_valid_until date,
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
  constraint testimonials_one_owner check (activity_id is null or project_id is null),
  constraint testimonials_published_has_date check (status <> 'published' or published_at is not null)
);

comment on table public.testimonials is
  'Testimonials: always with an adult''s authorization; hidden from visitors once it is revoked or expires.';

create index testimonials_public_idx on public.testimonials (status, published_at);
create index testimonials_consent_idx on public.testimonials (consent_record_id);
create index testimonials_cover_idx on public.testimonials (cover_media_id);
create index testimonials_activity_idx on public.testimonials (activity_id);
create index testimonials_project_idx on public.testimonials (project_id);
create index testimonials_created_by_idx on public.testimonials (created_by);
create index testimonials_updated_by_idx on public.testimonials (updated_by);
create index testimonials_review_note_by_idx on public.testimonials (review_note_by);

-- ---------------------------------------------------------------------------
-- 3. Rules
-- ---------------------------------------------------------------------------
-- Copies the authorization's facts, refuses minors, requires a usable
-- authorization and a publishable photo to publish. Definer: it reads the
-- authorization on behalf of the trigger (private, not callable from the API).
create or replace function private.check_testimonial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consent record;
begin
  select c.revoked_at, c.deleted_at, c.is_minor, c.valid_until
  into v_consent
  from public.consent_records c
  where c.id = new.consent_record_id;

  if not found then
    raise exception 'consent_not_found' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.consent_record_id is distinct from old.consent_record_id) then
    if v_consent.is_minor then
      raise exception 'consent_is_minor' using errcode = '23514';
    end if;
    if v_consent.deleted_at is not null then
      raise exception 'consent_not_found' using errcode = '23514';
    end if;
  end if;

  -- Always recomputed: the API cannot set them
  new.consent_withdrawn :=
    v_consent.revoked_at is not null or v_consent.deleted_at is not null or v_consent.is_minor;
  new.consent_valid_until := v_consent.valid_until;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published'
          or new.consent_record_id is distinct from old.consent_record_id
          or new.cover_media_id is distinct from old.cover_media_id) then
    if not private.consent_is_valid(new.consent_record_id) then
      raise exception 'consent_not_valid' using errcode = '23514';
    end if;
    if new.cover_media_id is not null then
      perform private.assert_media_publishable(new.cover_media_id);
    end if;
  end if;

  return new;
end;
$$;

-- When an authorization changes (revoked, expiry date, trash, minor), the
-- content that relies on it recomputes the copied facts. Each content type
-- with a consent_record_id adds its line here (team members, step 7.6d).
create or replace function private.sync_consent_to_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.testimonials t
  set consent_withdrawn = t.consent_withdrawn
  where t.consent_record_id = new.id;
  return new;
end;
$$;

-- Triggers fire in name order: "validate_testimonial" runs after the permission guard
create trigger guard_content_changes before insert or update on public.testimonials
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.testimonials
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.testimonials
  for each row execute function private.track_review_note();
create trigger validate_testimonial before insert or update on public.testimonials
  for each row execute function private.check_testimonial();
create trigger audit_row_change after insert or update or delete on public.testimonials
  for each row execute function private.audit_row_change();

create trigger sync_consent_to_content
  after update of revoked_at, valid_until, is_minor, deleted_at on public.consent_records
  for each row execute function private.sync_consent_to_content();

revoke execute on function private.check_testimonial() from public, anon;
revoke execute on function private.sync_consent_to_content() from public, anon;
grant execute on function private.check_testimonial() to authenticated;
grant execute on function private.sync_consent_to_content() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row level security: only people who manage authorizations (decision 7.6d)
-- ---------------------------------------------------------------------------
alter table public.testimonials enable row level security;

create policy "Visitors read published testimonials with a usable authorization"
  on public.testimonials for select to anon
  using (
    status = 'published' and published_at <= now() and deleted_at is null
    and not consent_withdrawn
    and (consent_valid_until is null
         or consent_valid_until >= (now() at time zone 'America/Bogota')::date)
  );
create policy "Authorization managers with MFA read every testimonial; others the public ones"
  on public.testimonials for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read'))
     and (select private.has_permission('consent.manage')))
    or (status = 'published' and published_at <= now() and deleted_at is null
        and not consent_withdrawn
        and (consent_valid_until is null
             or consent_valid_until >= (now() at time zone 'America/Bogota')::date))
  );
create policy "With MFA, authorization managers add testimonials"
  on public.testimonials for insert to authenticated
  with check (
    (select private.is_aal2()) and (select private.has_permission('content.create'))
    and (select private.has_permission('consent.manage'))
  );
create policy "With MFA, authorization managers edit testimonials"
  on public.testimonials for update to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('consent.manage'))
    and (
      (select private.has_permission('content.update_any'))
      or ((select private.has_permission('content.update_own'))
          and created_by = (select auth.uid())
          and status in ('draft', 'review'))
    )
  )
  with check (
    (select private.is_aal2()) and (select private.has_permission('consent.manage'))
    and (
      (select private.has_permission('content.update_any'))
      or ((select private.has_permission('content.update_own'))
          and created_by = (select auth.uid())
          and status in ('draft', 'review'))
    )
  );
create policy "With MFA, trash purgers delete testimonials in the trash"
  on public.testimonials for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

-- consent_withdrawn and consent_valid_until are never written from the API
grant select on public.testimonials to anon, authenticated;
grant insert (status, published_at, cover_media_id, quote, author_display_name, author_context,
              consent_record_id, activity_id, project_id)
  on public.testimonials to authenticated;
grant update (status, published_at, cover_media_id, quote, author_display_name, author_context,
              consent_record_id, activity_id, project_id, review_note, deleted_at)
  on public.testimonials to authenticated;
grant delete on public.testimonials to authenticated;

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
  where v.cover_media_id is not null
  union all
  select t.cover_media_id, 'testimonial'::text, t.id, 'cover'::text
  from public.testimonials t
  where t.cover_media_id is not null;

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
    -- A testimonial whose authorization was revoked or expired is not published
    when 'testimonial' then exists (
      select 1 from public.testimonials t
      where t.id = p_id and t.status = 'published' and t.deleted_at is null
        and private.consent_is_valid(t.consent_record_id))
    else false
  end;
$$;
