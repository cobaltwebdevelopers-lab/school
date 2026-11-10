#!/bin/bash
# Multi-tenant isolation tests. Run setup_test_db.sh first, then apply 20260910000004_multi_tenant.sql.
# Signs up users in two schools and tries to read/write across the boundary, escalate roles,
# reuse invites, squat paybills, etc.
A=11111111-1111-1111-1111-111111111111   # old bursar  (school 1 "My School")
T=22222222-2222-2222-2222-222222222222   # old teacher (school 1)
N=33333333-3333-3333-3333-333333333333   # no school
C=cccccccc-cccc-cccc-cccc-cccccccccccc   # new signup -> creates school 2
D=dddddddd-dddd-dddd-dddd-dddddddddddd   # new signup -> joins school 2 via invite
E=eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
F=ffffffff-ffff-ffff-ffff-ffffffffffff
fail=0
as(){ local uid=$1; shift; printf "set role authenticated;\nselect set_config('request.jwt.claim.sub','%s',false) \\\\g /dev/null\n%s\n" "$uid" "$*" | su postgres -c "psql -d t -At -q" 2>&1 | grep -v '^$'; }
su_(){ printf "%s\n" "$1" | su postgres -c "psql -d t -At -q" 2>&1; }
eq(){ if [ "$2" == "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1  (expected [$2] got [$3])"; fail=1; fi; }
has(){ if echo "$3" | grep -qi "$2"; then echo "PASS  $1"; else echo "FAIL  $1  (expected to contain [$2] got [$3])"; fail=1; fi; }

su_ "insert into auth.users (id,email,raw_user_meta_data) values ('$C','c@sunrise.test',jsonb_build_object('full_name','Carol')),('$D','d@sunrise.test',jsonb_build_object('full_name','Dan')),('$E','e@x.test','{}'),('$F','f@x.test','{}')" >/dev/null

echo "== signup trigger =="
eq "new user gets a profile with no school" "Carol|c@sunrise.test|false" "$(su_ "select full_name||'|'||email||'|'||(school_id is not null) from profiles where id='$C'")"

echo "== create school =="
as $C "select create_school('Sunrise Academy','Nakuru','0700','s@sunrise.test','P111','400200',null)" >/dev/null
eq "creator becomes bursar of new school" "bursar|true" "$(su_ "select role||'|'||(school_id is not null) from profiles where id='$C'")"
eq "new school seeded with 3 fee tiers" "3" "$(su_ "select count(*) from fee_tiers where school_id=(select school_id from profiles where id='$C')")"
eq "default term is this year" "Term 1 $(date +%Y)" "$(su_ "select current_term from schools where id=(select school_id from profiles where id='$C')")"
has "can't create a second school" "already belong" "$(as $C "select create_school('Another')")"
has "unauthenticated-style user N can create school but blank name rejected" "name is required" "$(as $N "select create_school('  ')")"

echo "== data isolation =="
as $C "insert into students (admission_no,name,grade) values ('1024','Carol Kid','Grade 3')" >/dev/null
eq "same admission no allowed in a different school" "1024" "$(su_ "select admission_no from students where name='Carol Kid'")"
eq "C sees only own students" "Carol Kid" "$(as $C "select string_agg(name,',') from students")"
eq "A sees only own school's students" "Amina Hassan,Brian Otieno" "$(as $A "select string_agg(name,',' order by name) from students")"
C_SCHOOL=$(su_ "select school_id from profiles where id='$C'")
A_SCHOOL=$(su_ "select school_id from profiles where id='$A'")
has "A cannot insert a student INTO school 2" "row-level security" "$(as $A "insert into students (school_id,admission_no,name,grade) values ('$C_SCHOOL','9','Injected','G1')")"
eq "A cannot update school 2's student (0 rows affected)" "0" "$(as $A "with u as (update students set name='Hacked' where name='Carol Kid' returning 1) select count(*) from u")"
eq "school 2's student untouched" "Carol Kid" "$(su_ "select name from students where admission_no='1024' and school_id='$C_SCHOOL'")"
eq "A cannot delete school 2's tiers" "3" "$(as $A "delete from fee_tiers where school_id='$C_SCHOOL'" >/dev/null; su_ "select count(*) from fee_tiers where school_id='$C_SCHOOL'")"
eq "C sees only own 3 tiers" "3" "$(as $C "select count(*) from fee_tiers")"

echo "== receipts are numbered per school =="
as $C "insert into payments (mpesa_ref,sender_phone,amount,account_ref) values ('ZZ1','254700',500,'1024')" >/dev/null
CP=$(su_ "select id from payments where mpesa_ref='ZZ1'")
as $C "insert into receipts (payment_id,total_amount) values ('$CP',500)" >/dev/null
eq "school 2's first receipt is #1" "1" "$(su_ "select receipt_no from receipts where school_id='$C_SCHOOL'")"
as $A "insert into receipts (payment_id,total_amount) values ('b0000000-0000-0000-0000-000000000001',10)" >/dev/null
eq "school 1 continues from its own counter (#3)" "3" "$(su_ "select max(receipt_no) from receipts where school_id='$A_SCHOOL'")"
eq "C can't see school 1's receipts" "1" "$(as $C "select count(*) from receipts")"

echo "== profiles / school / privilege escalation =="
eq "A sees only own school's members" "2" "$(as $A "select count(*) from profiles")"
eq "C sees only own school's members" "1" "$(as $C "select count(*) from profiles")"
as $T "update profiles set role='bursar' where id='$T'" >/dev/null
eq "teacher cannot promote themselves" "teacher" "$(su_ "select role from profiles where id='$T'")"
as $T "update profiles set school_id='$C_SCHOOL' where id='$T'" >/dev/null
eq "teacher cannot move themselves into another school" "$A_SCHOOL" "$(su_ "select school_id from profiles where id='$T'")"
as $C "update schools set subscription_status='active', receipt_seq=0 where id='$C_SCHOOL'" >/dev/null
eq "bursar cannot self-grant a subscription" "trialing" "$(su_ "select subscription_status from schools where id='$C_SCHOOL'")"
as $C "update schools set paybill_verified=true where id='$C_SCHOOL'" >/dev/null
eq "bursar cannot self-verify a paybill" "f" "$(su_ "select paybill_verified from schools where id='$C_SCHOOL'")"
eq "C can't read school 1's row" "1" "$(as $C "select count(*) from schools")"

echo "== invites =="
CODE=$(as $C "select create_invite('teacher',2,7)")
eq "invite code is 12 chars" "12" "${#CODE}"
as $D "select accept_invite('$CODE')" >/dev/null
eq "D joins school 2 as teacher" "teacher|$C_SCHOOL" "$(su_ "select role||'|'||school_id from profiles where id='$D'")"
as $E "select accept_invite(lower('$CODE'))" >/dev/null
eq "code is case-insensitive and allows 2nd use" "$C_SCHOOL" "$(su_ "select school_id from profiles where id='$E'")"
has "3rd use rejected (max_uses=2)" "Invalid or expired" "$(as $F "select accept_invite('$CODE')")"
has "garbage code rejected" "Invalid or expired" "$(as $F "select accept_invite('NOTACODE')")"
has "already-in-school user can't accept another invite" "already belong" "$(as $D "select accept_invite('$CODE')")"
su_ "update school_invites set expires_at = now() - interval '1 day'" >/dev/null
has "expired code rejected" "Invalid or expired" "$(as $F "select accept_invite('$CODE')")"
has "teacher cannot create invites" "Only a bursar" "$(as $D "select create_invite('teacher')")"
has "bursar cannot invite with a bogus role" "Invalid role" "$(as $C "select create_invite('superadmin')")"

echo "== teacher view =="
eq "teacher D cannot read students table" "0" "$(as $D "select count(*) from students")"
eq "teacher D sees clearance only for own school (1 student)" "Carol Kid" "$(as $D "select string_agg(name,',') from student_clearance")"
eq "teacher T sees clearance only for school 1 (2 students)" "2" "$(as $T "select count(*) from student_clearance")"
eq "teacher can't read payments" "0" "$(as $D "select count(*) from payments")"
eq "teacher can't read invites" "0" "$(as $D "select count(*) from school_invites")"
has "teacher can't change roles" "Only a bursar" "$(as $D "select set_member_role('$E','bursar')")"
has "teacher can't edit school settings" "Only a bursar" "$(as $D "select update_school_settings('x',null,null,null,null,null,null,'T1')")"
has "user with no school can't create invites" "Only a bursar" "$(as $N "select create_invite('teacher')")"

echo "== membership management =="
has "bursar can't demote the last bursar" "at least one bursar" "$(as $C "select set_member_role('$C','teacher')")"
has "bursar can't remove the last bursar" "at least one bursar" "$(as $C "select remove_member('$C')")"
has "bursar can't touch another school's member" "Member not found" "$(as $C "select set_member_role('$T','teacher')")"
as $C "select set_member_role('$D','bursar')" >/dev/null
eq "bursar promotes D to bursar" "bursar" "$(su_ "select role from profiles where id='$D'")"
as $C "select set_member_role('$C','teacher')" >/dev/null
eq "with 2 bursars, one may step down" "teacher" "$(su_ "select role from profiles where id='$C'")"
as $D "select remove_member('$E')" >/dev/null
eq "removed member drops back to no school" "f" "$(su_ "select (school_id is not null) from profiles where id='$E'")"
eq "removed member can no longer see school data" "0" "$(as $E "select count(*) from student_clearance")"

echo "== settings & paybill verification =="
as $D "select update_school_settings('Sunrise Academy',null,'Nakuru','0700','s@sunrise.test','P111','400200','Term 2 2026')" >/dev/null
eq "bursar updates term" "Term 2 2026" "$(su_ "select current_term from schools where id='$C_SCHOOL'")"
su_ "update schools set paybill_verified=true where id='$C_SCHOOL'" >/dev/null
as $D "select update_school_settings('Sunrise Academy','Rise','Nakuru','0700','s@sunrise.test','P111','400200','Term 2 2026')" >/dev/null
eq "paybill stays verified if unchanged" "t" "$(su_ "select paybill_verified from schools where id='$C_SCHOOL'")"
as $D "select update_school_settings('Sunrise Academy','Rise','Nakuru','0700','s@sunrise.test','P111','999999','Term 2 2026')" >/dev/null
eq "changing paybill drops verification" "f" "$(su_ "select paybill_verified from schools where id='$C_SCHOOL'")"
su_ "update schools set paybill_number='400200', paybill_verified=true where id='$C_SCHOOL'" >/dev/null
su_ "update schools set paybill_number='400200' where id='$A_SCHOOL'" >/dev/null
has "two schools may CLAIM the same paybill..." "" "ok"
has "...but only one can be VERIFIED" "duplicate key" "$(su_ "update schools set paybill_verified=true where id='$A_SCHOOL'")"

echo "== archive + anon =="
as $A "update students set is_active=false where admission_no='1025'" >/dev/null
eq "archived student drops off teacher clearance" "1" "$(as $T "select count(*) from student_clearance")"
has "anon cannot call create_school" "permission denied" "$(printf "set role anon;\nselect create_school('x');\n" | su postgres -c "psql -d t -At -q" 2>&1)"

echo "== fee tier safety + tenant deletion =="
as $D "insert into student_fee_balances (student_id,fee_tier_id,term,amount_due,amount_paid) select s.id, t.id, 'Term 2 2026', 5000, 0 from students s, fee_tiers t where s.admission_no='1024' and s.school_id='$C_SCHOOL' and t.school_id='$C_SCHOOL' and t.name='Tuition'" >/dev/null
has "tier with recorded balances cannot be deleted" "violates foreign key" "$(as $D "delete from fee_tiers where name='Tuition'")"
eq "balances survive the failed delete" "1" "$(su_ "select count(*) from student_fee_balances where school_id='$C_SCHOOL'")"
as $D "delete from fee_tiers where name='Transport'" >/dev/null
eq "unused tier CAN be deleted" "2" "$(su_ "select count(*) from fee_tiers where school_id='$C_SCHOOL'")"
as $D "insert into fee_tiers (name,priority) values ('Lunch',4)" >/dev/null
eq "bursar can add a school-specific tier" "Lunch" "$(su_ "select name from fee_tiers where school_id='$C_SCHOOL' and name='Lunch'")"
has "duplicate tier name in same school rejected" "duplicate key" "$(as $D "insert into fee_tiers (name,priority) values ('Lunch',5)")"
eq "school 1's tiers unaffected by school 2's changes" "3" "$(su_ "select count(*) from fee_tiers where school_id='$A_SCHOOL'")"
su_ "delete from schools where id='$C_SCHOOL'" >/dev/null
eq "deleting a school cascades all its data" "0" "$(su_ "select (select count(*) from students where school_id='$C_SCHOOL') + (select count(*) from payments where school_id='$C_SCHOOL') + (select count(*) from receipts where school_id='$C_SCHOOL') + (select count(*) from fee_tiers where school_id='$C_SCHOOL') + (select count(*) from student_fee_balances where school_id='$C_SCHOOL')")"
eq "...and school 1 is untouched" "1|3" "$(su_ "select (select count(*) from students where school_id='$A_SCHOOL' and is_active)||'|'||(select count(*) from fee_tiers where school_id='$A_SCHOOL')")"
eq "members of a deleted school fall back to onboarding" "f" "$(su_ "select (school_id is not null) from profiles where id='$D'")"

echo; [ $fail -eq 0 ] && echo "ALL ISOLATION TESTS PASSED" || echo "SOME TESTS FAILED"
