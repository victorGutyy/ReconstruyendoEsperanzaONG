-- Site settings (step 8.1, docs/06 site_settings, RF-A-30, HU-11). One row
-- with the organization's contact details, social networks and default SEO,
-- read by the public site and edited only by the Administrator.

create table public.site_settings (
  -- A single row: the key can only be true
  id boolean primary key default true check (id),
  organization_name text not null
    check (char_length(btrim(organization_name)) between 1 and 120),
  tagline text check (char_length(tagline) <= 160),
  contact_email text check (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- E.164, Colombian numbers only (+57 and 10 digits)
  whatsapp_number text check (whatsapp_number ~ '^\+57[0-9]{10}$'),
  phone text check (phone ~ '^\+57[0-9]{10}$'),
  -- {"facebook": "https://…", …}: only these networks, only https on their own
  -- domain (checked again in the app, docs/05)
  social_links jsonb not null default '{}'::jsonb check (
    jsonb_typeof(social_links) = 'object'
    and social_links - array['facebook', 'instagram', 'tiktok', 'youtube', 'x'] = '{}'::jsonb
    and not jsonb_path_exists(social_links, '$.* ? (@.type() != "string" || !(@ like_regex "^https://"))')
  ),
  -- {"description": "…"}
  default_seo jsonb not null default '{}'::jsonb check (
    jsonb_typeof(default_seo) = 'object'
    and default_seo - array['description'] = '{}'::jsonb
    and char_length(coalesce(default_seo ->> 'description', '')) <= 160
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.site_settings is
  'One row: contact details, networks and default SEO of the public site (RF-A-30).';

-- Starts with markers: nothing invented (CLAUDE.md)
insert into public.site_settings (organization_name, tagline, default_seo) values (
  'Reconstruyendo Esperanza',
  '[PENDIENTE: frase corta aprobada por la organización]',
  '{"description": "[PENDIENTE: descripción institucional aprobada por la organización]"}'
);

-- Who changed it: from the session, never from the form
create or replace function private.set_settings_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke execute on function private.set_settings_actor() from public, anon;
grant execute on function private.set_settings_actor() to authenticated;

create trigger set_settings_actor before update on public.site_settings
  for each row execute function private.set_settings_actor();
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
create trigger audit_row_change after insert or update or delete on public.site_settings
  for each row execute function private.audit_row_change();

alter table public.site_settings enable row level security;

create policy "Everyone reads the site settings"
  on public.site_settings for select to anon, authenticated
  using (true);
create policy "With MFA, settings managers edit the site settings"
  on public.site_settings for update to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('settings.manage')))
  with check ((select private.is_aal2()) and (select private.has_permission('settings.manage')));

-- No insert or delete: the row exists from the start and is never removed
grant select on public.site_settings to anon, authenticated;
grant update (organization_name, tagline, contact_email, whatsapp_number, phone, social_links,
              default_seo)
  on public.site_settings to authenticated;
