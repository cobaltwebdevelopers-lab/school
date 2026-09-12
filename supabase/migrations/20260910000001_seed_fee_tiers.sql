/*
  # Seed default fee tiers

  Boarding is paid off first, then Tuition, then Transport — matching the
  priority order used by the partial-payment allocation logic in
  src/lib/paymentAllocation.ts. Adjust names/priority here if your school's
  fee structure differs; lower priority number = paid first.
*/

insert into fee_tiers (name, priority)
select v.name, v.priority
from (values ('Boarding', 1), ('Tuition', 2), ('Transport', 3)) as v(name, priority)
where not exists (select 1 from fee_tiers where fee_tiers.name = v.name);
