-- Review note (step 7.4b, decision F7-D7): an Editor who returns an activity
-- from review to draft says what to fix. The note is required then, written
-- only by people who can publish, and cleared when the activity moves on.

alter table public.activities
  add column review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  add column review_note_by uuid references public.profiles (id),
  add column review_note_at timestamptz;

comment on column public.activities.review_note is
  'What to fix, from the Editor who returned the activity to draft. Cleared on resubmit or publish.';

create or replace function private.track_review_note()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_returned boolean;
  v_retired boolean;
  -- No session (server scripts with the secret key): trusted, like guard_content_changes
  v_trusted boolean := auth.uid() is null;
  v_publisher boolean := false;
begin
  if not v_trusted then
    v_publisher := private.has_permission('content.publish');
  end if;

  if tg_op = 'INSERT' then
    if new.review_note is not null and not v_trusted then
      raise exception 'review_note_read_only' using errcode = '42501';
    end if;
    new.review_note_by := null;
    new.review_note_at := null;
    return new;
  end if;

  v_returned := old.status = 'review' and new.status = 'draft';
  v_retired := old.status = 'published' and new.status = 'draft';

  if v_returned and v_publisher
     and (new.review_note is null or btrim(new.review_note) = '') then
    raise exception 'review_note_required' using errcode = '23514';
  end if;

  if new.status is distinct from old.status and new.status in ('review', 'published', 'archived') then
    -- Moving on: the note was read
    new.review_note := null;
    new.review_note_by := null;
    new.review_note_at := null;
  elsif new.review_note is distinct from old.review_note then
    -- Written only when returning or retiring, and only by people who can publish
    if new.review_note is null or not (v_returned or v_retired)
       or not (v_publisher or v_trusted) then
      raise exception 'review_note_read_only' using errcode = '42501';
    end if;
    new.review_note := btrim(new.review_note);
    new.review_note_by := auth.uid();
    new.review_note_at := now();
  else
    new.review_note_by := old.review_note_by;
    new.review_note_at := old.review_note_at;
  end if;

  return new;
end;
$$;

comment on function private.track_review_note() is
  'BEFORE INSERT OR UPDATE on activities: requires and stamps the review note; clears it when the activity moves on.';

-- Named to run after guard_content_changes (triggers fire in name order)
create trigger track_review_note before insert or update on public.activities
  for each row execute function private.track_review_note();
revoke execute on function private.track_review_note() from public, anon;

-- The note is written through the API; who and when only by the trigger
grant update (review_note) on public.activities to authenticated;
