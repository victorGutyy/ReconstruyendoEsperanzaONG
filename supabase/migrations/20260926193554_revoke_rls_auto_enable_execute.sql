-- Hosted projects created with "Enable automatic RLS" get public.rls_auto_enable(),
-- an event-trigger function declared SECURITY DEFINER that PUBLIC can execute through
-- /rest/v1/rpc (Security Advisor lints 0028 and 0029).
--
-- Deny by default (docs/05 §1): nobody calls it through the API. The event trigger
-- keeps firing, because Postgres invokes event triggers without checking EXECUTE.
--
-- Conditional: the function does not exist in the local Supabase stack.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
