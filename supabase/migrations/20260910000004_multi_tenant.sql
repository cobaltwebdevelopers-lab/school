/*
  # Multi-tenant conversion

  One shared database, one `school_id` on every tenant-owned table, and
  row-level security that scopes every read and write to the signed-in
  user's school. Isolation is enforced by Postgres itself, not just the UI.

  What changes
  ------------
  1. `schools` — one row per tenant (name, KRA PIN, paybill, current term,
     subscription fields, per-school receipt counter).
  2. `profiles.school_id` — which school a user belongs to. Role stays on the
     profile (bursar / director / teacher), now meaning "role in that school".
  3. `school_id` on students, fee_tiers, student_fee_balances, parent_phones,
     payments, payment_allocations and receipts. Defaults to the caller's
     school, so the app doesn't have to pass it on inserts.
  4. Uniqueness is per school: admission numbers, fee tier names and receipt
     numbers (each school's receipts count up from 1 independently).
  5. Every RLS policy is rewritten to be school-scoped. The old policy that
     let any user read every profile is gone.
  6. Anything that changes who belongs to a school, or a school's billing
     state, goes through SECURITY DEFINER functions — clients cannot write
     those columns directly:
       create_school, create_invite, accept_invite, update_school_settings,
       set_member_role, remove_member
  7. A trigger creates a profile for every new auth user (replaces the old
     client-side profile insert and its email-confirmation workaround).
  8. Existing single-school data is carried over into one school called
     "My School" (rename it in Settings), so nothing is lost.

  Paybill safety
  --------------
  Payments are routed to a school by the paybill number Safaricom reports.
  A school can *claim* a paybill in Settings, but payments only route to it
  once a platform operator sets `paybill_verified = true` (see SETUP.md).
  Otherwise anyone could claim another school's paybill and receive its
  payments.
*/

-- ============ schools (tenants) ============
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  motto text,
  address text,
  phone text,
  email text,
  kra_pin text,
  paybill_number text,
  paybill_verified boolean not null default false,
  current_term text not null default ('Term 1 ' || extract(year from now())::int),
  receipt_seq bigint not null default 0,
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);

-- Two schools may claim the same paybill, but only one can be verified.
create unique index if not exists idx_schools_verified_paybill
  on schools (paybill_number) where paybill_verified;

alter table schools enable row level security;

-- ============ profiles: school membership ============
alter table profiles add column if not exists school_id uuid references schools(id) on delete set null;
alter table profiles add column if not exists email text;
alter table profiles alter column role set default 'teacher';
create index if not exists idx_profiles_school on profiles (school_id);

update profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ============ helpers used by RLS ============
create or replace function current_school_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select school_id from profiles where id = auth.uid();
$$;

create or replace function current_role_name()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ============ tenant column on every tenant-owned table ============
alter table students            add column if not exists school_id uuid references schools(id) on delete cascade;
alter table fee_tiers           add column if not exists school_id uuid references schools(id) on delete cascade;
alter table student_fee_balances add column if not exists school_id uuid references schools(id) on delete cascade;
alter table parent_phones       add column if not exists school_id uuid references schools(id) on delete cascade;
alter table payments            add column if not exists school_id uuid references schools(id) on delete cascade;
alter table payment_allocations add column if not exists school_id uuid references schools(id) on delete cascade;
alter table receipts            add column if not exists school_id uuid references schools(id) on delete cascade;

-- ============ carry existing single-school data into one school ============
do $$
declare
  v_school uuid;
begin
  -- Only on the first run: once any school exists the conversion is done, and
  -- re-running must not sweep people who haven't joined a school into a new one.
  if not exists (select 1 from schools)
     and (exists (select 1 from students)
          or exists (select 1 from payments)
          or exists (select 1 from profiles)) then

    insert into schools (name) values ('My School') returning id into v_school;

    update profiles             set school_id = v_school where school_id is null;
    update students             set school_id = v_school where school_id is null;
    update fee_tiers            set school_id = v_school where school_id is null;
    update student_fee_balances set school_id = v_school where school_id is null;
    update parent_phones        set school_id = v_school where school_id is null;
    update payments             set school_id = v_school where school_id is null;
    update payment_allocations  set school_id = v_school where school_id is null;
    update receipts             set school_id = v_school where school_id is null;

    -- Keep the new per-school receipt counter ahead of what's already issued.
    update schools
       set receipt_seq = coalesce((select max(receipt_no) from receipts where school_id = v_school), 0)
     where id = v_school;
  end if;

  -- Fee tiers seeded globally by the earlier single-school migration are
  -- superseded: every school now gets its own set when it's created.
  delete from fee_tiers where school_id is null;
end $$;

-- Auth users who never got a profile row (e.g. signup pending email
-- confirmation) get one with no school: they'll go through onboarding.
insert into profiles (id, full_name, email, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), u.email, 'teacher'
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

alter table students             alter column school_id set not null;
alter table fee_tiers            alter column school_id set not null;
alter table student_fee_balances alter column school_id set not null;
alter table parent_phones        alter column school_id set not null;
alter table payments             alter column school_id set not null;
alter table payment_allocations  alter column school_id set not null;
alter table receipts             alter column school_id set not null;

-- Inserts from the app inherit the caller's school automatically.
alter table students             alter column school_id set default current_school_id();
alter table fee_tiers            alter column school_id set default current_school_id();
alter table student_fee_balances alter column school_id set default current_school_id();
alter table parent_phones        alter column school_id set default current_school_id();
alter table payments             alter column school_id set default current_school_id();
alter table payment_allocations  alter column school_id set default current_school_id();
alter table receipts             alter column school_id set default current_school_id();

create index if not exists idx_students_school            on students (school_id);
create index if not exists idx_fee_tiers_school           on fee_tiers (school_id);
create index if not exists idx_balances_school            on student_fee_balances (school_id);
create index if not exists idx_parent_phones_school       on parent_phones (school_id);
create index if not exists idx_payments_school            on payments (school_id);
create index if not exists idx_payment_allocations_school on payment_allocations (school_id);
create index if not exists idx_receipts_school            on receipts (school_id);

-- ============ uniqueness is per school ============
alter table students drop constraint if exists students_admission_no_key;
drop index if exists idx_students_admission_no;
alter table students drop constraint if exists students_school_admission_key;
alter table students add constraint students_school_admission_key unique (school_id, admission_no);

alter table fee_tiers drop constraint if exists fee_tiers_school_name_key;
alter table fee_tiers add constraint fee_tiers_school_name_key unique (school_id, name);

-- ============ fee tiers can't be deleted out from under recorded balances ============
-- The original schema cascaded tier deletion into student_fee_balances, which
-- would silently erase every student's balance on that tier. Now that schools
-- manage their own tiers, deleting one that has money recorded against it
-- fails instead. (NO ACTION rather than RESTRICT so deleting a whole school
-- still cascades cleanly.)
alter table student_fee_balances drop constraint if exists student_fee_balances_fee_tier_id_fkey;
alter table student_fee_balances
  add constraint student_fee_balances_fee_tier_id_fkey
  foreign key (fee_tier_id) references fee_tiers(id);

-- ============ per-school receipt numbering ============
alter table receipts drop constraint if exists receipts_receipt_no_key;
alter table receipts alter column receipt_no drop default;
drop sequence if exists receipts_receipt_no_seq;
alter table receipts drop constraint if exists receipts_school_receipt_no_key;
alter table receipts add constraint receipts_school_receipt_no_key unique (school_id, receipt_no);

create or replace function assign_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update schools
     set receipt_seq = receipt_seq + 1
   where id = new.school_id
  returning receipt_seq into new.receipt_no;
  return new;
end;
$$;

drop trigger if exists trg_assign_receipt_no on receipts;
create trigger trg_assign_receipt_no
  before insert on receipts
  for each row execute function assign_receipt_no();

-- ============ invites ============
create table if not exists school_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('bursar', 'director', 'teacher')),
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0,
  expires_at timestamptz not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_school_invites_school on school_invites (school_id);
alter table school_invites enable row level security;

-- ============ new auth users get a profile automatically ============
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, 'teacher')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ RLS: replace every policy with school-scoped ones ============
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'students', 'fee_tiers', 'student_fee_balances', 'parent_phones',
        'payments', 'payment_allocations', 'receipts', 'schools', 'school_invites'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- schools: members can read their own school. Writes only via functions below.
create policy "Members read own school" on schools
  for select to authenticated
  using (id = (select current_school_id()));

-- profiles: you can see yourself and the other members of your school.
-- Writes only via functions below (so nobody can edit their own role/school).
create policy "Read own profile and school members" on profiles
  for select to authenticated
  using (id = auth.uid() or school_id = (select current_school_id()));

-- invites: bursar of the school only
create policy "Bursar reads school invites" on school_invites
  for select to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

create policy "Bursar revokes school invites" on school_invites
  for delete to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- students
create policy "Bursar and director read students" on students
  for select to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) in ('bursar', 'director'));

create policy "Bursar manages students" on students
  for all to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar')
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- fee tiers: every member can read their school's tiers (names/priority only)
create policy "Members read fee tiers" on fee_tiers
  for select to authenticated
  using (school_id = (select current_school_id()));

create policy "Bursar manages fee tiers" on fee_tiers
  for all to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar')
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- balances
create policy "Bursar and director read balances" on student_fee_balances
  for select to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) in ('bursar', 'director'));

create policy "Bursar manages balances" on student_fee_balances
  for all to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar')
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- parent phone mappings
create policy "Bursar manages parent phones" on parent_phones
  for all to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar')
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- payments
create policy "Bursar and director read payments" on payments
  for select to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) in ('bursar', 'director'));

create policy "Bursar manages payments" on payments
  for all to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar')
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- allocations
create policy "Bursar and director read allocations" on payment_allocations
  for select to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) in ('bursar', 'director'));

create policy "Bursar manages allocations" on payment_allocations
  for all to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar')
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- receipts (read + create only; never edited or deleted)
create policy "Bursar and director read receipts" on receipts
  for select to authenticated
  using (school_id = (select current_school_id()) and (select current_role_name()) in ('bursar', 'director'));

create policy "Bursar creates receipts" on receipts
  for insert to authenticated
  with check (school_id = (select current_school_id()) and (select current_role_name()) = 'bursar');

-- ============ teacher-safe clearance view, scoped to the caller's school ============
create or replace view student_clearance as
select
  s.id,
  s.admission_no,
  s.name,
  s.grade,
  coalesce(
    bool_and(b.amount_paid >= b.amount_due),
    true
  ) as cleared
from students s
left join student_fee_balances b on b.student_id = s.id
where s.is_active = true
  and s.school_id = current_school_id()
group by s.id, s.admission_no, s.name, s.grade;

grant select on student_clearance to authenticated;

-- ============ functions: the only way to change school membership / settings ============

-- Create a school and become its bursar.
create or replace function create_school(
  p_name text,
  p_address text default null,
  p_phone text default null,
  p_email text default null,
  p_kra_pin text default null,
  p_paybill text default null,
  p_current_term text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_school uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'School name is required';
  end if;
  if (select school_id from profiles where id = v_user) is not null then
    raise exception 'You already belong to a school';
  end if;

  insert into schools (name, address, phone, email, kra_pin, paybill_number, current_term)
  values (
    trim(p_name),
    nullif(trim(p_address), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    nullif(trim(p_kra_pin), ''),
    nullif(trim(p_paybill), ''),
    coalesce(nullif(trim(p_current_term), ''), 'Term 1 ' || extract(year from now())::int)
  )
  returning id into v_school;

  insert into fee_tiers (school_id, name, priority) values
    (v_school, 'Boarding', 1),
    (v_school, 'Tuition', 2),
    (v_school, 'Transport', 3);

  insert into profiles (id, full_name, email, role, school_id)
  select v_user, coalesce(u.raw_user_meta_data->>'full_name', ''), u.email, 'bursar', v_school
  from auth.users u where u.id = v_user
  on conflict (id) do update set school_id = excluded.school_id, role = 'bursar';

  return v_school;
end;
$$;

-- Bursar creates an invite code for a new staff member.
create or replace function create_invite(
  p_role text,
  p_max_uses integer default 1,
  p_days integer default 14
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid := current_school_id();
  v_code text;
begin
  if v_school is null or current_role_name() <> 'bursar' then
    raise exception 'Only a bursar can create invites';
  end if;
  if p_role not in ('bursar', 'director', 'teacher') then
    raise exception 'Invalid role';
  end if;
  if p_max_uses < 1 or p_max_uses > 200 then
    raise exception 'Invite uses must be between 1 and 200';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into school_invites (school_id, code, role, max_uses, expires_at, created_by)
  values (v_school, v_code, p_role, p_max_uses, now() + make_interval(days => greatest(p_days, 1)), auth.uid());

  return v_code;
end;
$$;

-- A signed-in user with no school joins one using an invite code.
create or replace function accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inv school_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if (select school_id from profiles where id = v_user) is not null then
    raise exception 'You already belong to a school';
  end if;

  select * into v_inv
  from school_invites
  where code = upper(trim(p_code))
  for update;

  if not found or v_inv.expires_at <= now() or v_inv.use_count >= v_inv.max_uses then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into profiles (id, full_name, email, role, school_id)
  select v_user, coalesce(u.raw_user_meta_data->>'full_name', ''), u.email, v_inv.role, v_inv.school_id
  from auth.users u where u.id = v_user
  on conflict (id) do update set school_id = excluded.school_id, role = excluded.role;

  update school_invites set use_count = use_count + 1 where id = v_inv.id;

  return v_inv.school_id;
end;
$$;

-- Bursar edits school details. Billing and paybill-verification columns are
-- deliberately not editable here.
create or replace function update_school_settings(
  p_name text,
  p_motto text,
  p_address text,
  p_phone text,
  p_email text,
  p_kra_pin text,
  p_paybill text,
  p_current_term text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid := current_school_id();
  v_old_paybill text;
  v_new_paybill text := nullif(trim(p_paybill), '');
begin
  if v_school is null or current_role_name() <> 'bursar' then
    raise exception 'Only a bursar can change school settings';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'School name is required';
  end if;
  if coalesce(trim(p_current_term), '') = '' then
    raise exception 'Current term is required';
  end if;

  select paybill_number into v_old_paybill from schools where id = v_school;

  update schools set
    name = trim(p_name),
    motto = nullif(trim(p_motto), ''),
    address = nullif(trim(p_address), ''),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email), ''),
    kra_pin = nullif(trim(p_kra_pin), ''),
    paybill_number = v_new_paybill,
    -- Changing the paybill drops verification until an operator re-checks it.
    paybill_verified = case when v_new_paybill is not distinct from v_old_paybill then paybill_verified else false end,
    current_term = trim(p_current_term)
  where id = v_school;
end;
$$;

-- Bursar changes a colleague's role.
create or replace function set_member_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid := current_school_id();
  v_target_role text;
begin
  if v_school is null or current_role_name() <> 'bursar' then
    raise exception 'Only a bursar can change roles';
  end if;
  if p_role not in ('bursar', 'director', 'teacher') then
    raise exception 'Invalid role';
  end if;

  select role into v_target_role from profiles where id = p_user and school_id = v_school;
  if not found then
    raise exception 'Member not found';
  end if;

  if v_target_role = 'bursar' and p_role <> 'bursar'
     and (select count(*) from profiles where school_id = v_school and role = 'bursar') <= 1 then
    raise exception 'A school needs at least one bursar';
  end if;

  update profiles set role = p_role where id = p_user;
end;
$$;

-- Bursar removes a colleague from the school (they can then join another).
create or replace function remove_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid := current_school_id();
  v_target_role text;
begin
  if v_school is null or current_role_name() <> 'bursar' then
    raise exception 'Only a bursar can remove members';
  end if;

  select role into v_target_role from profiles where id = p_user and school_id = v_school;
  if not found then
    raise exception 'Member not found';
  end if;

  if v_target_role = 'bursar'
     and (select count(*) from profiles where school_id = v_school and role = 'bursar') <= 1 then
    raise exception 'A school needs at least one bursar';
  end if;

  update profiles set school_id = null, role = 'teacher' where id = p_user;
end;
$$;

-- Only signed-in users may call these.
revoke execute on function create_school(text, text, text, text, text, text, text) from public, anon;
revoke execute on function create_invite(text, integer, integer) from public, anon;
revoke execute on function accept_invite(text) from public, anon;
revoke execute on function update_school_settings(text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function set_member_role(uuid, text) from public, anon;
revoke execute on function remove_member(uuid) from public, anon;
grant execute on function create_school(text, text, text, text, text, text, text) to authenticated;
grant execute on function create_invite(text, integer, integer) to authenticated;
grant execute on function accept_invite(text) to authenticated;
grant execute on function update_school_settings(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function set_member_role(uuid, text) to authenticated;
grant execute on function remove_member(uuid) to authenticated;
