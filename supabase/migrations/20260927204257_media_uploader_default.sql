-- Migration 7 — media.uploaded_by defaults to the signed-in user (step 6.3).
--
-- The API cannot write uploaded_by (no column grant) and the trigger
-- private.set_media_uploader() already forces it to auth.uid(). The default
-- lets the app insert a photo row without naming the column at all.
alter table public.media alter column uploaded_by set default auth.uid();
