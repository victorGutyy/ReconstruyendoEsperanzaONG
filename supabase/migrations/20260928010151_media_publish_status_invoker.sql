-- Migration 9 — public.media_publish_status runs with the caller's rights (step 6.4).
--
-- The exposed function no longer bypasses RLS (Supabase advisor lint 0029):
-- the RLS of public.media decides which photos the caller may ask about
-- (members with MFA and content.read). Only the internal helper, which is not
-- reachable through the Data API (private schema), reads the authorizations,
-- and it returns issue codes only.
create or replace function public.media_publish_status(p_media_ids uuid[])
returns table (media_id uuid, issues text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, private.media_publish_issues(m.id)
  from public.media m
  where m.id = any (p_media_ids)
    -- One page of the library at a time, not the whole table
    and cardinality(p_media_ids) <= 500;
$$;

comment on function public.media_publish_status(uuid[]) is
  'Issue codes per photo (empty = publishable). Codes only: no personal data. Runs with the caller''s RLS.';

-- The caller now needs to run the internal helper (private is not exposed by the API)
grant execute on function private.media_publish_issues(uuid) to authenticated;
