insert into auth.users (id,email,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','bursar@old.school','{"full_name":"Old Bursar"}'),
 ('22222222-2222-2222-2222-222222222222','teacher@old.school','{"full_name":"Old Teacher"}'),
 ('33333333-3333-3333-3333-333333333333','nopro@old.school','{}');
insert into profiles (id,full_name,role) values
 ('11111111-1111-1111-1111-111111111111','Old Bursar','bursar'),
 ('22222222-2222-2222-2222-222222222222','Old Teacher','teacher');
insert into students (id,admission_no,name,grade) values
 ('a0000000-0000-0000-0000-000000000001','1024','Amina Hassan','Grade 7'),
 ('a0000000-0000-0000-0000-000000000002','1025','Brian Otieno','Grade 8');
insert into student_fee_balances (student_id,fee_tier_id,term,amount_due,amount_paid)
 select 'a0000000-0000-0000-0000-000000000001', id, 'Term 2 2026', 10000, 4000 from fee_tiers where name='Tuition';
insert into parent_phones (phone,student_id) values ('712345678','a0000000-0000-0000-0000-000000000001');
insert into payments (id,mpesa_ref,sender_phone,amount,account_ref,status,matched_student_id,match_method) values
 ('b0000000-0000-0000-0000-000000000001','QWE1','254712345678',4000,'ADM1024','matched','a0000000-0000-0000-0000-000000000001','fuzzy');
insert into payment_allocations (payment_id,student_id,fee_tier_id,term,amount)
 select 'b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',id,'Term 2 2026',4000 from fee_tiers where name='Tuition';
insert into receipts (payment_id,student_id,total_amount,issued_by) values
 ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',4000,'11111111-1111-1111-1111-111111111111'),
 ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',0,'11111111-1111-1111-1111-111111111111');
