-- Tags of stories (step 8.3, RF-A-04, docs/06 §4 tags). The model already
-- had post_tags; step 7.6a only built activity_tags. Same rules: visible when
-- the story is visible, edited by whoever may edit the story.

create table public.post_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.tags (id),
  constraint post_tags_unique unique (post_id, tag_id)
);
create index post_tags_tag_idx on public.post_tags (tag_id);

comment on table public.post_tags is 'Tags of a story (RF-A-04). Own id for the audit log.';

-- Whoever can edit the story edits its tags (like private.can_edit_activity)
create or replace function private.can_edit_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and private.is_aal2()
      and (
        private.has_permission('content.update_any')
        or (private.has_permission('content.update_own')
            and p.created_by = auth.uid()
            and p.status in ('draft', 'review'))
      )
  );
$$;

revoke execute on function private.can_edit_post(uuid) from public, anon;
grant execute on function private.can_edit_post(uuid) to authenticated;

create trigger audit_row_change after insert or update or delete on public.post_tags
  for each row execute function private.audit_row_change();

alter table public.post_tags enable row level security;

create policy "Tags of visible stories are visible"
  on public.post_tags for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Editors of the story add its tags"
  on public.post_tags for insert to authenticated
  with check (private.can_edit_post(post_id));
create policy "Editors of the story remove its tags"
  on public.post_tags for delete to authenticated
  using (private.can_edit_post(post_id));

grant select on public.post_tags to anon, authenticated;
grant insert (post_id, tag_id) on public.post_tags to authenticated;
grant delete on public.post_tags to authenticated;
