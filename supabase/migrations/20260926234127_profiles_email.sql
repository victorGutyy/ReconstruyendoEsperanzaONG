-- Migration 4 — e-mail in profiles (step 5.6, user management)
-- The users page reads the team through RLS (users.manage + MFA) instead of the
-- secret key, so the e-mail is copied from auth.users and kept in sync.

alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

comment on column public.profiles.email is
  'Copy of auth.users.email, kept in sync by triggers. Not writable through the API.';

-- Provisioning now also stores the e-mail. While the profile has no role yet
-- (the invitation is still being set up), the name and inviter from
-- app_metadata are applied; the role is applied only if it arrives there.
-- Once a role exists, app_metadata can no longer change anything but the e-mail.
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

  insert into public.profiles (id, full_name, role_id, invited_by, email)
  values (
    p_user_id,
    left(coalesce(v_full_name, split_part(p_email, '@', 1), 'Usuario'), 120),
    v_role_id,
    v_invited_by,
    p_email
  )
  on conflict (id) do update
    set role_id = coalesce(public.profiles.role_id, excluded.role_id),
        invited_by = coalesce(public.profiles.invited_by, excluded.invited_by),
        full_name = coalesce(left(v_full_name, 120), public.profiles.full_name)
    where public.profiles.role_id is null;
end;
$$;

-- E-mail changes in Supabase Auth are mirrored into the profile
create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

revoke execute on function private.provision_profile(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function private.sync_profile_email() from public, anon, authenticated;

create index profiles_email_idx on public.profiles (lower(email));
