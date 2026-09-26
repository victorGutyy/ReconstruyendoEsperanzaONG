-- Trigger helpers from migration `extensions_and_helpers` (docs/06 §1.1).
begin;
select plan(10);

select has_function('public', 'set_updated_at', 'set_updated_at() exists');
select has_function('public', 'set_actor_columns', 'set_actor_columns() exists');
select isnt_definer('public', 'set_updated_at', 'set_updated_at() is SECURITY INVOKER');
select isnt_definer('public', 'set_actor_columns', 'set_actor_columns() is SECURITY INVOKER');
select has_extension('unaccent', 'unaccent is installed');

-- A throwaway table that uses both triggers, as business tables will
create table public.__helpers_probe (
  id int primary key,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create trigger set_updated_at before update on public.__helpers_probe
  for each row execute function public.set_updated_at();
create trigger set_actor_columns before insert or update on public.__helpers_probe
  for each row execute function public.set_actor_columns();

-- Act as a signed-in user
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

-- A forged created_by is replaced by the real user
insert into public.__helpers_probe (id, note, created_by, updated_at)
values (1, 'first', '99999999-9999-9999-9999-999999999999', '2000-01-01');

select is(
  (select created_by from public.__helpers_probe where id = 1),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by comes from auth.uid(), not from the insert values'
);

-- Another user edits the row
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

update public.__helpers_probe
set note = 'edited', created_by = '99999999-9999-9999-9999-999999999999'
where id = 1;

select is(
  (select created_by from public.__helpers_probe where id = 1),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by cannot be changed by an update'
);

select is(
  (select updated_by from public.__helpers_probe where id = 1),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'updated_by is the user who made the update'
);

select isnt(
  (select updated_at from public.__helpers_probe where id = 1),
  '2000-01-01'::timestamptz,
  'updated_at is refreshed on update'
);

-- Without a user (system context) trusted values are kept
select set_config('request.jwt.claims', '', true);
insert into public.__helpers_probe (id, note, created_by)
values (2, 'system', '33333333-3333-3333-3333-333333333333');

select is(
  (select created_by from public.__helpers_probe where id = 2),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'without a signed-in user, the trusted created_by value is kept'
);

select * from finish();
rollback;
