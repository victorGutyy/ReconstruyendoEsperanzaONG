-- Institutional and legal pages (docs/06 §5) on the shared content engine (step 7.6e).
--
-- Four fixed pages, created here as drafts with [PENDIENTE: …] markers and
-- never created or deleted from the API. Institutional pages are edited by
-- editors; legal pages only by the Administrator (settings.manage). A page
-- that still says [PENDIENTE is never published. Every publication of a legal
-- page keeps an exact copy of its text in page_versions (append-only), so the
-- version a person accepted (contact form, F8) can always be shown.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique
    check (key in ('about', 'support', 'privacy-policy', 'privacy-notice')),
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 160),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  -- Tiptap JSON (never HTML, docs/05 §6) and its plain text for search
  body jsonb,
  body_text text,
  version text check (char_length(btrim(version)) between 1 and 40),
  review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  review_note_by uuid references public.profiles (id),
  review_note_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  -- Kept for the shared engine; pages are never sent to the trash
  deleted_at timestamptz,
  constraint pages_published_has_date check (status <> 'published' or published_at is not null),
  constraint pages_legal_have_version check (
    status <> 'published' or key not in ('privacy-policy', 'privacy-notice') or version is not null
  )
);

comment on table public.pages is
  'Fixed institutional and legal pages. Legal ones: Administrator only, versioned in page_versions.';

create index pages_updated_by_idx on public.pages (updated_by);
create index pages_created_by_idx on public.pages (created_by);
create index pages_review_note_by_idx on public.pages (review_note_by);

-- Exact text of every published version of a legal page. Append-only: no
-- API grants; only the trigger below writes it.
create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id),
  key text not null,
  version text not null,
  title text not null,
  body jsonb,
  body_text text,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id),
  constraint page_versions_unique unique (page_id, version)
);

comment on table public.page_versions is
  'Append-only copy of each published version of a legal page (what a person accepted).';

create index page_versions_published_by_idx on public.page_versions (published_by);

-- ---------------------------------------------------------------------------
-- 2. Rules
-- ---------------------------------------------------------------------------
create or replace function private.is_legal_page(p_key text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_key in ('privacy-policy', 'privacy-notice');
$$;

-- No pending markers on the site; a legal page publishes each text under a
-- version that was never used before.
create or replace function private.check_page()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_publishing boolean;
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  v_publishing := new.status = 'published' and (
    tg_op = 'INSERT' or old.status <> 'published'
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.body_text is distinct from old.body_text
    or new.version is distinct from old.version
  );

  if v_publishing then
    if position('[PENDIENTE' in upper(coalesce(new.title, '') || ' ' || coalesce(new.body_text, ''))) > 0 then
      raise exception 'page_pending_text' using errcode = '23514';
    end if;
    if private.is_legal_page(new.key) and exists (
      select 1 from public.page_versions v where v.page_id = new.id and v.version = new.version
    ) then
      raise exception 'legal_version_used' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- After a legal page is published (or its published text changes under a
-- new version), keep the exact text. Definer: page_versions has no API grants.
create or replace function private.record_legal_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_legal_page(new.key) and new.status = 'published' and (
    old.status <> 'published'
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.body_text is distinct from old.body_text
    or new.version is distinct from old.version
  ) then
    insert into public.page_versions (page_id, key, version, title, body, body_text, published_by)
    values (new.id, new.key, new.version, new.title, new.body, new.body_text, auth.uid());
  end if;
  return new;
end;
$$;

-- Triggers fire in name order: "validate_page" runs after the permission guard
create trigger guard_content_changes before insert or update on public.pages
  for each row execute function private.guard_content_changes();
create trigger set_actor_columns before insert or update on public.pages
  for each row execute function public.set_actor_columns();
create trigger set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();
create trigger track_review_note before insert or update on public.pages
  for each row execute function private.track_review_note();
create trigger validate_page before insert or update on public.pages
  for each row execute function private.check_page();
create trigger record_legal_version after update on public.pages
  for each row execute function private.record_legal_version();
create trigger audit_row_change after insert or update or delete on public.pages
  for each row execute function private.audit_row_change();

revoke execute on function private.is_legal_page(text) from public, anon;
revoke execute on function private.check_page() from public, anon;
revoke execute on function private.record_legal_version() from public, anon;
grant execute on function private.is_legal_page(text) to authenticated;
grant execute on function private.check_page() to authenticated;
grant execute on function private.record_legal_version() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security: fixed pages, legal ones for the Administrator
-- ---------------------------------------------------------------------------
alter table public.pages enable row level security;
alter table public.page_versions enable row level security;

create policy "Visitors read published pages"
  on public.pages for select to anon
  using (status = 'published' and published_at <= now() and deleted_at is null);
create policy "Members with MFA read every page; others only published ones"
  on public.pages for select to authenticated
  using (
    ((select private.is_aal2()) and (select private.has_permission('content.read')))
    or (status = 'published' and published_at <= now() and deleted_at is null)
  );
create policy "With MFA, editors edit institutional pages; the Administrator the legal ones"
  on public.pages for update to authenticated
  using (
    (select private.is_aal2())
    and case
      when private.is_legal_page(key) then (select private.has_permission('settings.manage'))
      else (select private.has_permission('content.update_any'))
    end
  )
  with check (
    (select private.is_aal2())
    and case
      when private.is_legal_page(key) then (select private.has_permission('settings.manage'))
      else (select private.has_permission('content.update_any'))
    end
  );

create policy "Members with MFA read the published legal versions"
  on public.page_versions for select to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('content.read')));

-- No insert or delete: the four pages are fixed. The key never changes.
grant select on public.pages to anon, authenticated;
grant update (status, published_at, seo_title, seo_description, title, body, body_text, version,
              review_note)
  on public.pages to authenticated;
grant select on public.page_versions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The four pages, as drafts with markers (never text that looks real)
-- ---------------------------------------------------------------------------
insert into public.pages (key, title, body, body_text) values
  ('about', 'Quiénes somos',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"[PENDIENTE: historia, misión y visión de la organización, aprobadas por ella]"}]}]}',
   '[PENDIENTE: historia, misión y visión de la organización, aprobadas por ella]'),
  ('support', 'Cómo apoyar',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"[PENDIENTE: formas de apoyo aprobadas por la organización]"}]}]}',
   '[PENDIENTE: formas de apoyo aprobadas por la organización]'),
  ('privacy-policy', 'Política de tratamiento de datos personales',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"[PENDIENTE: política de tratamiento de datos revisada por el abogado]"}]}]}',
   '[PENDIENTE: política de tratamiento de datos revisada por el abogado]'),
  ('privacy-notice', 'Aviso de privacidad',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"[PENDIENTE: aviso de privacidad revisado por el abogado]"}]}]}',
   '[PENDIENTE: aviso de privacidad revisado por el abogado]');
