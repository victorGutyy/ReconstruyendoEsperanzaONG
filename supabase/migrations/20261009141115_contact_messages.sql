-- Contact messages (step 8.7, docs/06 §7 contact_messages, RF-A-09, HU-03,
-- docs/09: minimal personal data, 12-month retention in F9).
--
-- No insert for visitors or members: a bot with the publishable key could
-- write here directly, skipping Turnstile and the rate limit. Only the
-- contact Server Action inserts, with the server key, after both checks.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- E.164, Colombian numbers (+57 and ten digits), like the site settings
  phone text check (phone ~ '^\+57[0-9]{10}$'),
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  -- Which version of the data policy the person accepted, and when
  privacy_policy_version text not null check (char_length(btrim(privacy_policy_version)) between 1 and 40),
  consent_accepted_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'read', 'handled', 'archived')),
  handled_by uuid references public.profiles (id),
  handled_at timestamptz,
  -- HMAC of the IP with a server secret: spots abuse without keeping the IP
  ip_hash text check (char_length(ip_hash) <= 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  deleted_at timestamptz,
  constraint contact_messages_reachable check (email is not null or phone is not null)
);

comment on table public.contact_messages is
  'Messages from the contact form (RF-A-09). Inserted only by the server after Turnstile and the rate limit.';

create index contact_messages_inbox_idx on public.contact_messages (status, created_at desc);
create index contact_messages_handled_by_idx on public.contact_messages (handled_by);
create index contact_messages_updated_by_idx on public.contact_messages (updated_by);

-- Who changed it and who handled it: from the session, never from the form.
-- Taking a message out of the trash needs trash.restore, like content.
create or replace function private.guard_contact_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null
     and not private.has_permission('trash.restore') then
    raise exception 'Restoring requires trash.restore' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  if new.status = 'handled' and old.status is distinct from 'handled' then
    new.handled_by := auth.uid();
    new.handled_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_contact_message() from public, anon;
grant execute on function private.guard_contact_message() to authenticated;

create trigger guard_contact_message before update on public.contact_messages
  for each row execute function private.guard_contact_message();
create trigger set_updated_at before update on public.contact_messages
  for each row execute function public.set_updated_at();
create trigger audit_row_change after insert or update or delete on public.contact_messages
  for each row execute function private.audit_row_change();

alter table public.contact_messages enable row level security;

create policy "With MFA, message readers read the messages"
  on public.contact_messages for select to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('messages.read')));
create policy "With MFA, message managers handle the messages"
  on public.contact_messages for update to authenticated
  using ((select private.is_aal2()) and (select private.has_permission('messages.manage')))
  with check ((select private.is_aal2()) and (select private.has_permission('messages.manage')));
create policy "With MFA, trash purgers delete messages in the trash"
  on public.contact_messages for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );

-- Members only change the state; nobody writes a message through the API
grant select on public.contact_messages to authenticated;
grant update (status, deleted_at) on public.contact_messages to authenticated;
grant delete on public.contact_messages to authenticated;
