-- Migration 6 — media and image consents (docs/06-modelo-datos.md §6 and §11, step 6.2)
--
-- Photos, the signed image authorizations (RF-A-29) and the link between them,
-- plus the private Storage buckets. Storage is reached only through the server
-- (secret key, after the app checks the permission): the buckets have no API
-- policies at all.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- The id is also the file name. No original file name and no EXIF metadata
-- are ever stored.
create table public.media (
  id uuid primary key default gen_random_uuid(),
  -- Technical columns: written only by the server (no grant to the API roles)
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'ready', 'failed')),
  private_path text,
  public_key text,
  mime_type text,
  width int check (width > 0),
  height int check (height > 0),
  bytes int check (bytes > 0),
  -- Descriptive columns: written by the people in the panel
  alt_text text check (char_length(alt_text) <= 300),
  caption text check (char_length(caption) <= 500),
  credit text check (char_length(credit) <= 120),
  -- null = not classified yet: cannot be published until someone decides
  people_in_photo text check (people_in_photo in ('none', 'identifiable', 'minors')),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ready_media_has_files check (processing_status <> 'ready' or private_path is not null)
);

comment on table public.media is
  'Photos. Technical columns (status, paths, public_key) are written only by the server.';

create index media_uploaded_by_idx on public.media (uploaded_by);
create index media_created_at_idx on public.media (created_at desc) where deleted_at is null;

-- Signed image authorizations. Data minimisation (docs/09): no ID number,
-- phone, address or e-mail.
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  subject_name text not null check (char_length(btrim(subject_name)) between 1 and 120),
  is_minor boolean not null,
  signer_type text not null check (signer_type in ('self', 'legal_guardian')),
  signer_name text check (char_length(signer_name) <= 120),
  scope_description text not null check (char_length(btrim(scope_description)) between 1 and 500),
  granted_on date not null,
  channel text not null check (channel in ('paper', 'digital')),
  form_version text not null check (char_length(btrim(form_version)) between 1 and 40),
  -- Photo of the signed form, in the private consent-documents bucket
  document_path text not null,
  revoked_at timestamptz,
  revocation_note text check (char_length(revocation_note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint minor_signed_by_guardian check (not is_minor or signer_type = 'legal_guardian'),
  constraint guardian_has_name check (
    signer_type <> 'legal_guardian' or char_length(btrim(coalesce(signer_name, ''))) > 0
  )
);

comment on table public.consent_records is
  'Signed image authorizations (RF-A-29). Minimal data; a revocation cannot be undone.';

create index consent_records_created_by_idx on public.consent_records (created_by);
create index consent_records_updated_by_idx on public.consent_records (updated_by);

-- Which authorizations cover which photos. It has its own id so the audit log
-- can record every link and unlink.
create table public.media_consents (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media (id) on delete cascade,
  consent_record_id uuid not null references public.consent_records (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint media_consents_unique unique (media_id, consent_record_id)
);

create index media_consents_consent_record_idx on public.media_consents (consent_record_id);

-- ---------------------------------------------------------------------------
-- 2. Guards (what RLS cannot express)
-- ---------------------------------------------------------------------------

-- The uploader is always the signed-in user and never changes.
create or replace function private.set_media_uploader()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.uploaded_by := auth.uid();
    end if;
  else
    new.uploaded_by := old.uploaded_by;
  end if;
  return new;
end;
$$;

-- A revocation is final (RB-005): if the person authorizes again, a new
-- record is registered, so the legal history stays complete.
create or replace function private.guard_consent_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'A revoked authorization cannot be reinstated; register a new one'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger set_media_uploader before insert or update on public.media
  for each row execute function private.set_media_uploader();
create trigger guard_consent_changes before update on public.consent_records
  for each row execute function private.guard_consent_changes();

create trigger set_updated_at before update on public.media
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.consent_records
  for each row execute function public.set_updated_at();
create trigger set_actor_columns before insert or update on public.consent_records
  for each row execute function public.set_actor_columns();

create trigger audit_row_change after insert or update or delete on public.media
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.consent_records
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.media_consents
  for each row execute function private.audit_row_change();

revoke execute on function private.set_media_uploader() from public, anon;
revoke execute on function private.guard_consent_changes() from public, anon;
grant execute on function private.set_media_uploader() to authenticated;
grant execute on function private.guard_consent_changes() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. "Can this photo be published?" (docs/06 §6, HU-06)
-- ---------------------------------------------------------------------------

-- What is missing before a photo can be public. Empty array = publishable.
-- Used by the publication trigger of the content tables (F7) and by the panel.
-- SECURITY DEFINER: it must see the authorizations even when the caller
-- cannot (e.g. an author sending content to review with warnings); it only
-- returns issue codes, never personal data.
create or replace function private.media_publish_issues(p_media_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when m.deleted_at is not null then 'in_trash' end,
    case when m.processing_status <> 'ready' then 'not_processed' end,
    case when char_length(btrim(coalesce(m.alt_text, ''))) = 0 then 'missing_alt_text' end,
    case when m.people_in_photo is null then 'people_unclassified' end,
    case
      when m.people_in_photo = 'identifiable' and not exists (
        select 1
        from public.media_consents mc
        join public.consent_records c on c.id = mc.consent_record_id
        where mc.media_id = m.id and c.revoked_at is null and c.deleted_at is null
      ) then 'missing_consent'
    end,
    case
      when m.people_in_photo = 'minors' and not exists (
        select 1
        from public.media_consents mc
        join public.consent_records c on c.id = mc.consent_record_id
        where mc.media_id = m.id and c.revoked_at is null and c.deleted_at is null
          and c.signer_type = 'legal_guardian'
      ) then 'missing_guardian_consent'
    end
  ], null)
  from public.media m
  where m.id = p_media_id;
$$;

comment on function private.media_publish_issues(uuid) is
  'Issue codes that prevent publishing a photo; empty array = publishable, null = no such photo.';

create or replace function private.media_is_publishable(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(private.media_publish_issues(p_media_id)) = 0, false);
$$;

revoke execute on function private.media_publish_issues(uuid) from public, anon, authenticated;
revoke execute on function private.media_is_publishable(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row level security and explicit grants (docs/06 §10)
-- ---------------------------------------------------------------------------
alter table public.media enable row level security;
alter table public.consent_records enable row level security;
alter table public.media_consents enable row level security;

-- media: visitors only see public photos (public_key is set when published, F7)
create policy "Visitors read public photos"
  on public.media for select to anon
  using (public_key is not null and deleted_at is null);
create policy "With MFA, members read photos"
  on public.media for select to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('content.read')));
create policy "With MFA, uploaders add photos"
  on public.media for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('media.upload')));
create policy "With MFA, media editors or the uploader edit photos"
  on public.media for update to authenticated
  using (
    (select private.is_aal2())
    and ((select private.has_permission('media.update')) or uploaded_by = (select auth.uid()))
  )
  with check (
    (select private.is_aal2())
    and ((select private.has_permission('media.update')) or uploaded_by = (select auth.uid()))
  );
create policy "With MFA, trash purgers delete photos"
  on public.media for delete to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('trash.purge')));

-- consent_records and media_consents: consent.manage only (personal data)
create policy "With MFA, consent managers read authorizations"
  on public.consent_records for select to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('consent.manage')));
create policy "With MFA, consent managers add authorizations"
  on public.consent_records for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('consent.manage')));
create policy "With MFA, consent managers edit authorizations"
  on public.consent_records for update to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('consent.manage')))
  with check ((select private.is_aal2()) and (select private.has_permission('consent.manage')));
create policy "With MFA, trash purgers delete authorizations"
  on public.consent_records for delete to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('trash.purge')));

create policy "With MFA, consent managers read links"
  on public.media_consents for select to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('consent.manage')));
create policy "With MFA, consent managers link authorizations to photos"
  on public.media_consents for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('consent.manage')));
create policy "With MFA, consent managers unlink authorizations"
  on public.media_consents for delete to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('consent.manage')));

-- Column grants: technical media columns and document_path stay server-only
grant select on public.media to anon, authenticated;
grant insert (alt_text, caption, credit, people_in_photo) on public.media to authenticated;
grant update (alt_text, caption, credit, people_in_photo, deleted_at)
  on public.media to authenticated;
grant delete on public.media to authenticated;

grant select on public.consent_records to authenticated;
grant insert (subject_name, is_minor, signer_type, signer_name, scope_description, granted_on,
              channel, form_version, document_path)
  on public.consent_records to authenticated;
grant update (subject_name, is_minor, signer_type, signer_name, scope_description, granted_on,
              channel, form_version, revoked_at, revocation_note, deleted_at)
  on public.consent_records to authenticated;
grant delete on public.consent_records to authenticated;

grant select, delete on public.media_consents to authenticated;
grant insert (media_id, consent_record_id) on public.media_consents to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Private Storage buckets (docs/06 §11). No policies on storage.objects:
-- only the server (secret key) reads or writes them, after checking the
-- permission, and hands out signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  -- Originals from the phone, deleted as soon as they are processed
  ('media-incoming', 'media-incoming', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp']),
  -- Processed versions (re-encoded by sharp: no EXIF/GPS)
  ('media-private', 'media-private', false, 5242880, array['image/webp']),
  -- Photos of the signed authorization forms (also re-encoded)
  ('consent-documents', 'consent-documents', false, 5242880, array['image/webp']);
