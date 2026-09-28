-- Migration 10 — minor's opinion and validity end date in image authorizations (step 6.5).
--
-- docs/09 §4.1: with minors, the legal guardian signs and the child is heard
-- according to their age; if the child does not want to appear, the photo is
-- not published even if the adult signed. docs/09 §4.3: the form states how
-- long the authorization lasts.

alter table public.consent_records
  add column minor_opinion text
    check (minor_opinion in ('agrees', 'disagrees', 'not_applicable')),
  add column valid_until date;

comment on column public.consent_records.minor_opinion is
  'Minors only: agrees / disagrees (then it does not authorize anything) / not_applicable (age).';
comment on column public.consent_records.valid_until is
  'Optional end date written on the form; after it the authorization no longer counts.';

alter table public.consent_records
  add constraint minor_opinion_only_for_minors check (
    (is_minor and minor_opinion is not null) or (not is_minor and minor_opinion is null)
  ),
  add constraint valid_until_after_granted check (valid_until is null or valid_until >= granted_on);

grant insert (minor_opinion, valid_until) on public.consent_records to authenticated;
grant update (minor_opinion, valid_until) on public.consent_records to authenticated;

-- The publication rule now also ignores expired authorizations and those of
-- minors who do not want to appear. "Today" is Colombian time.
create or replace function private.media_publish_issues(p_media_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with valid_consents as (
    select c.signer_type
    from public.media_consents mc
    join public.consent_records c on c.id = mc.consent_record_id
    where mc.media_id = p_media_id
      and c.revoked_at is null
      and c.deleted_at is null
      and (c.valid_until is null or c.valid_until >= (now() at time zone 'America/Bogota')::date)
      and not (c.is_minor and c.minor_opinion = 'disagrees')
  )
  select array_remove(array[
    case when m.deleted_at is not null then 'in_trash' end,
    case when m.processing_status <> 'ready' then 'not_processed' end,
    case when char_length(btrim(coalesce(m.alt_text, ''))) = 0 then 'missing_alt_text' end,
    case when m.people_in_photo is null then 'people_unclassified' end,
    case
      when m.people_in_photo = 'identifiable' and not exists (select 1 from valid_consents)
        then 'missing_consent'
    end,
    case
      when m.people_in_photo = 'minors'
        and not exists (select 1 from valid_consents where signer_type = 'legal_guardian')
        then 'missing_guardian_consent'
    end
  ], null)
  from public.media m
  where m.id = p_media_id;
$$;
