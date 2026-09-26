-- Migration 2 — access control (docs/06-modelo-datos.md §3)
-- Roles, permissions, profiles and the helper functions used by every RLS policy.

-- ---------------------------------------------------------------------------
-- 1. Private schema for security helpers
-- Not exposed by the Data API: RLS policies can use these functions, but nobody
-- can call them through /rest/v1/rpc (avoids Security Advisor lints 0028/0029).
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Catalog tables: changed only through migrations
-- ---------------------------------------------------------------------------
create table public.roles (
  id smallint generated always as identity primary key,
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null,
  description text not null
);

comment on table public.roles is 'Panel roles. System data: changed only through migrations.';

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

comment on table public.permissions is 'Permissions as module.action. System data: changed only through migrations.';

create table public.role_permissions (
  role_id smallint not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create index role_permissions_permission_key_idx on public.role_permissions (permission_key);

insert into public.roles (key, name, description) values
  ('admin', 'Administrador', 'Responsable de la plataforma: usuarios, configuración, auditoría y papelera.'),
  ('editor', 'Editor', 'Revisa, publica y gestiona el contenido, los medios, las autorizaciones y los mensajes.'),
  ('author', 'Autor', 'Crea contenido y sube medios; envía a revisión.');

insert into public.permissions (key, description) values
  ('content.read', 'Ver todo el contenido en el panel'),
  ('content.create', 'Crear contenido'),
  ('content.update_own', 'Editar su propio contenido en borrador o revisión'),
  ('media.upload', 'Subir medios'),
  ('content.update_any', 'Editar cualquier contenido'),
  ('content.publish', 'Publicar, programar, archivar y despublicar'),
  ('content.delete', 'Enviar contenido a la papelera'),
  ('media.update', 'Editar cualquier medio'),
  ('consent.manage', 'Gestionar autorizaciones de uso de imagen'),
  ('messages.read', 'Leer mensajes de contacto'),
  ('messages.manage', 'Atender y archivar mensajes de contacto'),
  ('taxonomy.manage', 'Gestionar categorías, etiquetas y lugares'),
  ('users.manage', 'Invitar usuarios, asignar roles, activar y desactivar'),
  ('settings.manage', 'Cambiar la configuración del sitio'),
  ('audit.read', 'Consultar el registro de auditoría'),
  ('trash.restore', 'Restaurar elementos de la papelera'),
  ('trash.purge', 'Eliminar definitivamente elementos de la papelera');

-- Permission matrix (docs/06 §3)
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on
  p.key in ('content.read', 'content.create', 'content.update_own', 'media.upload')
  or (r.key in ('editor', 'admin') and p.key in (
    'content.update_any', 'content.publish', 'content.delete', 'media.update',
    'consent.manage', 'messages.read', 'messages.manage', 'taxonomy.manage'
  ))
  or (r.key = 'admin' and p.key in (
    'users.manage', 'settings.manage', 'audit.read', 'trash.restore', 'trash.purge'
  ));

-- ---------------------------------------------------------------------------
-- 3. Profiles: one per auth.users row
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role_id smallint references public.roles (id),
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Panel users. role_id null = no permissions. Deactivate instead of deleting (docs/06 §3).';

create index profiles_role_id_idx on public.profiles (role_id);
create index profiles_invited_by_idx on public.profiles (invited_by);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Security helpers
-- ---------------------------------------------------------------------------

-- Did the current session complete MFA?
create or replace function private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

-- Is the current user active and does their role grant this permission?
-- SECURITY DEFINER so it can read profiles without re-entering their RLS policy.
create or replace function private.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    where pr.id = (select auth.uid())
      and pr.is_active
      and rp.permission_key = permission
  );
$$;

-- Provisioning from raw_app_meta_data, which only the server (secret key) can
-- write. Never from raw_user_meta_data: users can edit it themselves.
--
-- Supabase Auth inserts the user first and stores app_metadata in a later
-- update, so provisioning runs on both events:
--   * insert: create the profile (role may still be unknown)
--   * update of raw_app_meta_data: fill role, name and inviter, but ONLY while
--     the profile has no role yet. Later role changes go through
--     public.profiles and its guard (users.manage + MFA).
create or replace function private.provision_profile(
  p_user_id uuid,
  p_email text,
  p_app_meta_data jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id smallint;
  v_invited_by uuid;
  v_full_name text := nullif(trim(p_app_meta_data ->> 'full_name'), '');
begin
  select id into v_role_id from public.roles where key = p_app_meta_data ->> 'role';

  begin
    v_invited_by := nullif(p_app_meta_data ->> 'invited_by', '')::uuid;
  exception when invalid_text_representation then
    v_invited_by := null;
  end;

  if v_invited_by is not null
     and not exists (select 1 from public.profiles where id = v_invited_by) then
    v_invited_by := null;
  end if;

  insert into public.profiles (id, full_name, role_id, invited_by)
  values (
    p_user_id,
    left(coalesce(v_full_name, split_part(p_email, '@', 1), 'Usuario'), 120),
    v_role_id,
    v_invited_by
  )
  on conflict (id) do update
    set role_id = excluded.role_id,
        invited_by = coalesce(public.profiles.invited_by, excluded.invited_by),
        full_name = coalesce(left(v_full_name, 120), public.profiles.full_name)
    where public.profiles.role_id is null
      and excluded.role_id is not null;
end;
$$;

create or replace function private.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.provision_profile(new.id, new.email, coalesce(new.raw_app_meta_data, '{}'::jsonb));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_auth_user_change();

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function private.handle_auth_user_change();

-- Role, status and inviter changes need users.manage + MFA, and nobody can change
-- their own role or status (prevents locking the organization out by mistake).
-- Without a signed-in user (migrations, server jobs) changes are allowed.
create or replace function private.guard_profile_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id then
    raise exception 'profiles.id cannot change' using errcode = '42501';
  end if;

  if new.role_id is distinct from old.role_id
     or new.is_active is distinct from old.is_active
     or new.invited_by is distinct from old.invited_by then
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role or status' using errcode = '42501';
    end if;
    if not (private.is_aal2() and private.has_permission('users.manage')) then
      raise exception 'Changing roles or status requires users.manage and MFA' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_profile_changes before update on public.profiles
  for each row execute function private.guard_profile_changes();

-- Only authenticated sessions (inside RLS policies) may execute the helpers.
revoke execute on function private.is_aal2() from public, anon;
revoke execute on function private.has_permission(text) from public, anon;
revoke execute on function private.provision_profile(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function private.handle_auth_user_change() from public, anon, authenticated;
revoke execute on function private.guard_profile_changes() from public, anon;
grant execute on function private.is_aal2() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.guard_profile_changes() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row level security and explicit grants (docs/06 §10)
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;

create policy "Signed-in users can read roles"
  on public.roles for select to authenticated using (true);
create policy "Signed-in users can read permissions"
  on public.permissions for select to authenticated using (true);
create policy "Signed-in users can read the permission matrix"
  on public.role_permissions for select to authenticated using (true);

create policy "Users read their own profile; managers with MFA read all"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or ((select private.is_aal2()) and (select private.has_permission('users.manage')))
  );

create policy "With MFA, users edit their own profile; managers edit any"
  on public.profiles for update to authenticated
  using (
    (select private.is_aal2())
    and (id = (select auth.uid()) or (select private.has_permission('users.manage')))
  )
  with check (
    (select private.is_aal2())
    and (id = (select auth.uid()) or (select private.has_permission('users.manage')))
  );

-- No insert policy (profiles come from the invite trigger) and no delete policy
-- (users are deactivated, never deleted).
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, role_id, is_active) on public.profiles to authenticated;
