-- Team members (docs/06 §5) on the shared content engine (step 7.6d).
--
-- People with name and photo: handled only by people who manage
-- authorizations, no minors, and published only with a usable authorization.
-- Like testimonials, the profile keeps copies of the authorization's state
-- (consent_withdrawn, consent_valid_until) so visitors stop seeing it as soon
-- as it is revoked or expires. A draft may still lack the authorization.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  -- The person's photo (optional): publishable like any photo with people
  cover_media_id uuid references public.media (id),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  role_title text not null check (char_length(btrim(role_title)) between 1 and 120),
  -- Plain text, no rich editor (decision 7.6d)
  bio text check (char_length(bio) <= 600),
  position int not null default 0,
  consent_record_id uuid references public.consent_records (id),
  consent_withdrawn boolean not null default true,
  consent_valid_until date,
  review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  review_note_by uuid references public.profiles (id),
  review_note_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint team_members_published_has_date check (status <> 'published' or published_at is not null),
  -- docs/06: a published profile always has its authorization
  constraint team_members_published_with_consent check (
    status <> 'published' or consent_record_id is not null
  )
);

comment on table public.team_members is
  'Team: published only with an adult''s authorization; hidden from visitors once it is revoked or expires.';

create index team_members_order_idx on public.team_members (position);
create index team_members_public_idx on public.team_members (status, published_at);
create index team_members_consent_idx on public.team_members (consent_record_id);
create index team_members_cover_idx on public.team_members (cover_media_id);
create index team_members_created_by_idx on public.team_members (created_by);
create index team_members_updated_by_idx on public.team_members (updated_by);
create index team_members_review_note_by_idx on public.team_members (review_note_by);

-- ---------------------------------------------------------------------------
-- 2. Rules (same idea as testimonials; the authorization may be missing in a draft)
-- ---------------------------------------------------------------------------
create or replace function private.check_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consent record;
begin
  if new.consent_record_id is null then
    new.consent_withdrawn := true;
    new.consent_valid_until := null;
  else
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
    new.consent_withdrawn :=
      v_consent.revoked_at is not null or v_consent.deleted_at is not null or v_consent.is_minor;
    new.consent_valid_until := v_consent.valid_until;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status <> 'published'
          or new.consent_record_id is distinct from old.consent_record_id
          or new.cover_media_id is distinct from old.cover_media_id) then
    if new.consent_record_id is null or not private.consent_is_valid(new.consent_record_id) then
      raise exception 'consent_not_valid' using errcode = '23514';
    end if;
    if new.cover_media_id is not null then
      perform private.assert_media_publishable(new.cover_media_id);
    end if;
  end if;

  return new;
end;
$$;

-- Testimonials and team profiles follow their authorization
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
  update public.team_members m
  set consent_withdrawn = m.consent_withdrawn
  where m.consent_record_id = new.id;
  return new;
end;
$$;

-- Triggers fire in name order: "validate_team_member" runs after the permission guard
create trigger guard_content_changes before insert or update on public.team_members
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.team_members
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.team_members
  for each row execute function private.track_review_note();
create trigger validate_team_member before insert or update on public.team_members
  for each row execute function private.check_team_member();
create trigger audit_row_change after insert or update or delete on public.team_members
  for each row execute function private.audit_row_change();

revoke execute on function private.check_team_member() from public, anon;
grant execute on function private.check_team_member() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security: only people who manage authorizations (decision 7.6d)
-- ---------------------------------------------------------------------------
alter table public.team_members enable row level security;

create policy "Visitors read published team profiles with a usable authorization"
  on public.team_members for select to anon
  using (
    status = 'published' and published_at <= now() and deleted_at is null
    and not consent_withdrawn
    and (consent_valid_until is null
         or consent_valid_until >= (now() at time zone 'America/Bogota')::date)
  );
create policy "Authorization managers with MFA read every team profile; others the public ones"
  on public.team_members for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read'))
     and (select private.has_permission('consent.manage')))
    or (status = 'published' and published_at <= now() and deleted_at is null
        and not consent_withdrawn
        and (consent_valid_until is null
             or consent_valid_until >= (now() at time zone 'America/Bogota')::date))
  );
create policy "With MFA, authorization managers add team profiles"
  on public.team_members for insert to authenticated
  with check (
    (select private.is_aal2()) and (select private.has_permission('content.create'))
    and (select private.has_permission('consent.manage'))
  );
create policy "With MFA, authorization managers edit team profiles"
  on public.team_members for update to authenticated
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
create policy "With MFA, trash purgers delete team profiles in the trash"
  on public.team_members for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

-- consent_withdrawn and consent_valid_until are never written from the API
grant select on public.team_members to anon, authenticated;
grant insert (status, published_at, cover_media_id, full_name, role_title, bio, position,
              consent_record_id)
  on public.team_members to authenticated;
grant update (status, published_at, cover_media_id, full_name, role_title, bio, position,
              consent_record_id, review_note, deleted_at)
  on public.team_members to authenticated;
grant delete on public.team_members to authenticated;

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
  where v.cover_media_id is not null
  union all
  select t.cover_media_id, 'testimonial'::text, t.id, 'cover'::text
  from public.testimonials t
  where t.cover_media_id is not null
  union all
  select m.cover_media_id, 'team_member'::text, m.id, 'cover'::text
  from public.team_members m
  where m.cover_media_id is not null;

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
    -- People: not published once their authorization was revoked or expired
    when 'testimonial' then exists (
      select 1 from public.testimonials t
      where t.id = p_id and t.status = 'published' and t.deleted_at is null
        and private.consent_is_valid(t.consent_record_id))
    when 'team_member' then exists (
      select 1 from public.team_members m
      where m.id = p_id and m.status = 'published' and m.deleted_at is null
        and m.consent_record_id is not null
        and private.consent_is_valid(m.consent_record_id))
    else false
  end;
$$;
