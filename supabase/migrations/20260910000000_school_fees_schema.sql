/*
  # School Fees Reconciliation — full schema

  1. Roles: profiles.role ∈ ('bursar','director','teacher'), tied to auth.users
  2. Students, fee tiers (priority-ordered), per-student-per-tier balances
  3. parent_phones — verified phone → student mapping for instant auto-reconciliation
  4. payments — raw incoming paybill transactions (messy account_ref included)
  5. payment_allocations — tiered breakdown of a payment across fee tiers
  6. receipts — sequential numbering for eTIMS-style receipts
  7. student_clearance view — exposes only a boolean "cleared" flag (no amounts) for teachers
  8. RLS: bursar = full access; director = read-only financial data; teacher = clearance view only
*/

-- ============ profiles / roles ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('bursar', 'director', 'teacher')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile" on profiles
  for select to authenticated using (auth.uid() = id);

create policy "Users can read all profiles for role checks" on profiles
  for select to authenticated using (true);

-- Helper: current user's role, used throughout RLS policies below
create or replace function current_role_name()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- ============ students ============
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  name text not null,
  grade text not null,
  parent_name text,
  parent_phone text,
  created_at timestamptz default now()
);

alter table students enable row level security;

create policy "Bursar and director can read students" on students
  for select to authenticated using (current_role_name() in ('bursar', 'director'));

create policy "Bursar can manage students" on students
  for all to authenticated
  using (current_role_name() = 'bursar')
  with check (current_role_name() = 'bursar');

create index if not exists idx_students_admission_no on students (admission_no);

-- ============ fee tiers (priority order for allocation) ============
create table if not exists fee_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  priority integer not null,
  created_at timestamptz default now()
);

alter table fee_tiers enable row level security;

create policy "Authenticated users can read fee tiers" on fee_tiers
  for select to authenticated using (true);

create policy "Bursar can manage fee tiers" on fee_tiers
  for all to authenticated
  using (current_role_name() = 'bursar')
  with check (current_role_name() = 'bursar');

-- ============ per-student, per-tier, per-term balances ============
create table if not exists student_fee_balances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  fee_tier_id uuid not null references fee_tiers(id) on delete cascade,
  term text not null,
  amount_due numeric not null default 0,
  amount_paid numeric not null default 0,
  created_at timestamptz default now(),
  unique (student_id, fee_tier_id, term)
);

alter table student_fee_balances enable row level security;

create policy "Bursar and director can read balances" on student_fee_balances
  for select to authenticated using (current_role_name() in ('bursar', 'director'));

create policy "Bursar can manage balances" on student_fee_balances
  for all to authenticated
  using (current_role_name() = 'bursar')
  with check (current_role_name() = 'bursar');

-- ============ parent_phones: verified phone -> student mapping ============
create table if not exists parent_phones (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  student_id uuid not null references students(id) on delete cascade,
  verified_at timestamptz default now(),
  unique (phone, student_id)
);

alter table parent_phones enable row level security;

create policy "Bursar can manage parent phone mappings" on parent_phones
  for all to authenticated
  using (current_role_name() = 'bursar')
  with check (current_role_name() = 'bursar');

create index if not exists idx_parent_phones_phone on parent_phones (phone);

-- ============ payments: raw incoming paybill transactions ============
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  mpesa_ref text unique,
  sender_phone text not null,
  amount numeric not null,
  account_ref text not null,
  status text not null default 'pending' check (status in ('matched', 'unmatched', 'pending')),
  matched_student_id uuid references students(id),
  match_method text check (match_method in ('phone', 'fuzzy', 'manual')),
  created_at timestamptz default now()
);

alter table payments enable row level security;

create policy "Bursar and director can read payments" on payments
  for select to authenticated using (current_role_name() in ('bursar', 'director'));

create policy "Bursar can manage payments" on payments
  for all to authenticated
  using (current_role_name() = 'bursar')
  with check (current_role_name() = 'bursar');

create index if not exists idx_payments_status on payments (status);
create index if not exists idx_payments_sender_phone on payments (sender_phone);

-- ============ payment_allocations: tiered breakdown of a payment ============
create table if not exists payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  student_id uuid not null references students(id),
  fee_tier_id uuid not null references fee_tiers(id),
  term text not null,
  amount numeric not null,
  created_at timestamptz default now()
);

alter table payment_allocations enable row level security;

create policy "Bursar and director can read allocations" on payment_allocations
  for select to authenticated using (current_role_name() in ('bursar', 'director'));

create policy "Bursar can manage allocations" on payment_allocations
  for all to authenticated
  using (current_role_name() = 'bursar')
  with check (current_role_name() = 'bursar');

-- ============ receipts: sequential numbering for eTIMS-style receipts ============
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no bigserial unique,
  payment_id uuid references payments(id),
  student_id uuid references students(id),
  total_amount numeric not null,
  issued_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table receipts enable row level security;

create policy "Bursar and director can read receipts" on receipts
  for select to authenticated using (current_role_name() in ('bursar', 'director'));

create policy "Bursar can create receipts" on receipts
  for insert to authenticated with check (current_role_name() = 'bursar');

-- ============ student_clearance view: boolean-only, safe for teacher role ============
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
group by s.id, s.admission_no, s.name, s.grade;

grant select on student_clearance to authenticated;
