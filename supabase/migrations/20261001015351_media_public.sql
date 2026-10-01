-- Public photos (step 7.5a, docs/04 §5.3, ADR-05). A photo is public only
-- while it is used by published (or scheduled) content AND it is publishable
-- (description, people, authorizations). The server copies its processed
-- versions to the public bucket under a random key (media.public_key) and
-- removes them as soon as the rule stops holding.

-- Anyone can read it (like R2 in production); only the server writes, with
-- the secret key, after the panel checked the permission. No API policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media-public', 'media-public', true, 2097152, array['image/webp']);

-- Which photos must be public right now, for the server only.
-- With ids: those photos. Without: every photo that is public or in use (daily sync).
-- Each new content type (step 7.6) adds its published check here.
create or replace function public.media_public_targets(p_media_ids uuid[] default null)
returns table (media_id uuid, public_key text, should_be_public boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select m.id, m.public_key
    from public.media m
    where (p_media_ids is not null and m.id = any (p_media_ids))
       or (p_media_ids is null and (
             m.public_key is not null
             or exists (select 1 from public.content_media_usages u where u.media_id = m.id)))
  )
  select
    c.id,
    c.public_key,
    exists (
      select 1
      from public.content_media_usages u
      join public.activities a on u.entity_type = 'activity' and a.id = u.entity_id
      where u.media_id = c.id and a.status = 'published' and a.deleted_at is null
    )
    and coalesce(cardinality(private.media_publish_issues(c.id)) = 0, false)
  from candidates c;
$$;

comment on function public.media_public_targets(uuid[]) is
  'Server only (secret key): whether each photo must be public now, and its current public key.';

revoke execute on function public.media_public_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.media_public_targets(uuid[]) to service_role;

-- The rule reuses the publishing check; the server role needs to reach it
grant usage on schema private to service_role;
grant execute on function private.media_publish_issues(uuid) to service_role;
