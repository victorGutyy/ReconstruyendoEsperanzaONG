-- Trash (step 7.7, docs/04 §5.2, docs/06 §1.1). Content and photos already go
-- to the trash with deleted_at, and only trash.purge deletes content that is in
-- it. This step makes purging safe: what pointed to a purged item is unlinked
-- instead of blocking it, photos are only purged from the trash, and only
-- trash.restore takes a photo out of it (like content).

-- ---------------------------------------------------------------------------
-- 1. Purging an activity or a project unlinks what belonged to it
--    (decision 7.7-D4). The photos of a gallery or an activity keep their
--    restrict: a photo in use is never purged.
-- ---------------------------------------------------------------------------
alter table public.activities
  drop constraint activities_project_id_fkey,
  add constraint activities_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.galleries
  drop constraint galleries_activity_id_fkey,
  add constraint galleries_activity_id_fkey
    foreign key (activity_id) references public.activities (id) on delete set null,
  drop constraint galleries_project_id_fkey,
  add constraint galleries_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.videos
  drop constraint videos_activity_id_fkey,
  add constraint videos_activity_id_fkey
    foreign key (activity_id) references public.activities (id) on delete set null,
  drop constraint videos_project_id_fkey,
  add constraint videos_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.testimonials
  drop constraint testimonials_activity_id_fkey,
  add constraint testimonials_activity_id_fkey
    foreign key (activity_id) references public.activities (id) on delete set null,
  drop constraint testimonials_project_id_fkey,
  add constraint testimonials_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Photos: whoever may edit a photo sends it to the trash; only
--    trash.restore takes it out (decision 7.7-D2). Without a user (server
--    jobs) it does not apply, like guard_content_changes.
-- ---------------------------------------------------------------------------
create or replace function private.guard_media_trash()
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
  return new;
end;
$$;

-- Named to run before the other triggers on media (they fire in name order)
create trigger guard_media_trash before update on public.media
  for each row execute function private.guard_media_trash();

revoke execute on function private.guard_media_trash() from public, anon;
grant execute on function private.guard_media_trash() to authenticated;

-- Photos are purged only from the trash, like content
drop policy "With MFA, trash purgers delete photos" on public.media;
create policy "With MFA, trash purgers delete photos in the trash"
  on public.media for delete to authenticated
  using (
    (select private.is_aal2()) and (select private.has_permission('trash.purge'))
    and deleted_at is not null
  );
