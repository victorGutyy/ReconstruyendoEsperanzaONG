-- Migration 5 — taxonomy: places, categories and tags (docs/06-modelo-datos.md §4, step 6.1)
--
-- Read by everyone (the public site filters by them) except what is in the
-- trash; written by taxonomy.manage with MFA. Slugs are set on creation and
-- never change (they will be part of public URLs).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- General places only (neighbourhood, vereda...), never addresses (RN-A-03).
-- The organization loads the list from the panel: nothing is seeded here.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  kind text not null check (kind in ('municipality', 'neighborhood', 'vereda', 'sector', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.places is
  'General places (neighbourhood, vereda). Never addresses (RN-A-03). Loaded by the organization.';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('activity', 'post')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text check (char_length(description) <= 300),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.categories is
  'Categories per content type (activities, posts), ordered by position.';

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.tags is 'Free tags for activities and posts (created while writing, F7).';

-- Slugs are unique among rows that are not in the trash
create unique index places_slug_key on public.places (slug) where deleted_at is null;
create unique index categories_scope_slug_key on public.categories (scope, slug)
  where deleted_at is null;
create unique index tags_slug_key on public.tags (slug) where deleted_at is null;
create index categories_scope_position_idx on public.categories (scope, position);

-- ---------------------------------------------------------------------------
-- 2. Triggers: updated_at and audit
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.places
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create trigger audit_row_change after insert or update or delete on public.places
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.categories
  for each row execute function private.audit_row_change();
create trigger audit_row_change after insert or update or delete on public.tags
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------------
-- 3. Row level security and explicit grants (docs/06 §10)
-- ---------------------------------------------------------------------------
alter table public.places enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;

-- Visitors see what is not in the trash; managers with MFA also see the trash
-- (needed to restore it, and so that an UPDATE that moves a row to the trash
-- can still return it).
create policy "Visitors read places not in the trash"
  on public.places for select to anon using (deleted_at is null);
create policy "Members read places; managers with MFA also the trash"
  on public.places for select to authenticated
  using (
    deleted_at is null
    or ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')))
  );
create policy "With MFA, taxonomy managers add places"
  on public.places for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')));
create policy "With MFA, taxonomy managers edit places"
  on public.places for update to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')))
  with check ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')));
create policy "With MFA, trash purgers delete places"
  on public.places for delete to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('trash.purge')));

create policy "Visitors read categories not in the trash"
  on public.categories for select to anon using (deleted_at is null);
create policy "Members read categories; managers with MFA also the trash"
  on public.categories for select to authenticated
  using (
    deleted_at is null
    or ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')))
  );
create policy "With MFA, taxonomy managers add categories"
  on public.categories for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')));
create policy "With MFA, taxonomy managers edit categories"
  on public.categories for update to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')))
  with check ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')));
create policy "With MFA, trash purgers delete categories"
  on public.categories for delete to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('trash.purge')));

create policy "Visitors read tags not in the trash"
  on public.tags for select to anon using (deleted_at is null);
create policy "Members read tags; managers with MFA also the trash"
  on public.tags for select to authenticated
  using (
    deleted_at is null
    or ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')))
  );
create policy "With MFA, taxonomy managers add tags"
  on public.tags for insert to authenticated
  with check ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')));
create policy "With MFA, taxonomy managers edit tags"
  on public.tags for update to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')))
  with check ((select private.is_aal2()) and (select private.has_permission('taxonomy.manage')));
create policy "With MFA, trash purgers delete tags"
  on public.tags for delete to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('trash.purge')));

-- Column grants: the slug is written once (insert) and never updated.
grant select on public.places, public.categories, public.tags to anon, authenticated;

grant insert (name, slug, kind, is_active) on public.places to authenticated;
grant update (name, kind, is_active, deleted_at) on public.places to authenticated;

grant insert (scope, name, slug, description, position) on public.categories to authenticated;
grant update (name, description, position, deleted_at) on public.categories to authenticated;

grant insert (name, slug) on public.tags to authenticated;
grant update (name, deleted_at) on public.tags to authenticated;

grant delete on public.places, public.categories, public.tags to authenticated;
