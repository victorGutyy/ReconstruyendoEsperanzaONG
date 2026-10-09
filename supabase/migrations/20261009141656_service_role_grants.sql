-- The server role can work on the tables (fix, oct-2026).
--
-- Staging has "Automatically expose new tables" off (docs/04 §8.1), and that
-- also left service_role (the server key, lib/supabase/admin.ts) without
-- SELECT/INSERT/UPDATE/DELETE on every table. The local stack grants them by
-- default, so the tests passed while staging failed: photos stayed in
-- "processing", public copies and the daily sync could not write, and the
-- contact form could not store a message.
--
-- This does not open anything to visitors or members (anon/authenticated keep
-- only what each migration grants): the server key already bypasses RLS by
-- design and lives only on the server, after the app checked the permission.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tables created by later migrations get the same, in every environment
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

-- Append-only records stay append-only for the server too (their triggers
-- refuse it anyway; without the privilege it never gets that far)
revoke update, delete on public.audit_logs from service_role;
revoke update, delete on public.page_versions from service_role;

-- Fixed pages call it while saving: without it the server could not publish
-- one (found in step 8.5)
grant execute on function private.is_legal_page(text) to service_role;
