/*
  # Add student archiving

  Students can have payments, allocations, and receipts tied to them, and
  those financial records are intentionally never cascade-deleted (see the
  original schema migration) — a school needs to keep that audit trail even
  after a student leaves. So "removing" a student here means archiving them
  (is_active = false), not a hard delete: they disappear from the active
  roster, ledger, and teacher clearance view, but their payment history
  stays intact for as long as the school needs it.
*/

alter table students add column if not exists is_active boolean not null default true;

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
group by s.id, s.admission_no, s.name, s.grade;
