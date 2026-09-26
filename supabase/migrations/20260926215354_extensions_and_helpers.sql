-- Migration 1 — extensions and helpers (docs/06-modelo-datos.md §12)

-- ---------------------------------------------------------------------------
-- 1. Deny by default (docs/05 §1)
-- Objects that the migrations create in `public` get NO privileges for the API
-- roles unless a migration grants them explicitly. This makes the local stack
-- behave like staging, where "Automatically expose new tables" is off
-- (docs/04 §8.1).
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
-- Functions: PUBLIC's EXECUTE is a global built-in default that a per-schema
-- rule cannot remove, so every migration also revokes it per function
-- (enforced by supabase/tests/00_security_baseline.test.sql).
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Extensions
-- ---------------------------------------------------------------------------
-- Accent-insensitive Spanish search (docs/06 §8)
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- 3. Trigger helpers shared by every business table
-- ---------------------------------------------------------------------------

-- Keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: sets updated_at to now().';

-- Fills created_by / updated_by from the signed-in user, never from the form
-- (docs/06 §1.1). created_by cannot change after insert.
-- Without a user (auth.uid() is null: migrations, seeds, server jobs) the
-- values sent by the trusted caller are kept.
create or replace function public.set_actor_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if actor is not null then
      new.created_by := actor;
    end if;
  else
    new.created_by := old.created_by;
  end if;

  if actor is not null then
    new.updated_by := actor;
  end if;

  return new;
end;
$$;

comment on function public.set_actor_columns() is
  'BEFORE INSERT OR UPDATE trigger: created_by/updated_by from auth.uid(); created_by is immutable.';

-- Trigger functions are never called through the API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.set_actor_columns() from public, anon, authenticated;
