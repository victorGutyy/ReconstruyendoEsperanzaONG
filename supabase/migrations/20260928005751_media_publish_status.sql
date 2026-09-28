-- Migration 8 — what each photo still needs before it can be published (step 6.4).
--
-- An author cannot read image authorizations (personal data, consent.manage
-- only) but must know whether their photo lacks one. This function returns
-- ONLY issue codes (see private.media_publish_issues), never names or any
-- data from the authorizations.
create or replace function public.media_publish_status(p_media_ids uuid[])
returns table (media_id uuid, issues text[])
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, private.media_publish_issues(m.id)
  from public.media m
  where m.id = any (p_media_ids)
    -- Same audience as reading photos: members with MFA and content.read
    and (select private.is_aal2())
    and (select private.has_permission('content.read'))
    -- One page of the library at a time, not the whole table
    and cardinality(p_media_ids) <= 500;
$$;

comment on function public.media_publish_status(uuid[]) is
  'Issue codes per photo (empty = publishable). Codes only: no personal data. MFA + content.read.';

revoke execute on function public.media_publish_status(uuid[]) from public, anon;
grant execute on function public.media_publish_status(uuid[]) to authenticated;
