import { supabase } from '@/lib/supabase';
import type {
  Student,
  PaybillPayment,
  FeeTier,
  StudentFeeBalance,
  ParentPhoneMapping,
  StudentClearance,
  AllocationLine,
  MatchMethod,
} from '@/types';

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    admissionNo: s.admission_no,
    name: s.name,
    grade: s.grade,
    parentPhone: s.parent_phone ?? '',
    parentName: s.parent_name ?? '',
    termTuitionFee: 0,
    totalPaid: 0,
  }));
}

export async function fetchStudentClearance(): Promise<StudentClearance[]> {
  const { data, error } = await supabase.from('student_clearance').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    admissionNo: s.admission_no,
    name: s.name,
    grade: s.grade,
    cleared: s.cleared,
  }));
}

export async function fetchFeeTiers(): Promise<FeeTier[]> {
  const { data, error } = await supabase.from('fee_tiers').select('*').order('priority');
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, priority: t.priority }));
}

export async function fetchStudentFeeBalances(term: string): Promise<StudentFeeBalance[]> {
  const { data, error } = await supabase.from('student_fee_balances').select('*').eq('term', term);
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    studentId: b.student_id,
    feeTierId: b.fee_tier_id,
    term: b.term,
    amountDue: Number(b.amount_due),
    amountPaid: Number(b.amount_paid),
  }));
}

export async function fetchParentPhones(): Promise<ParentPhoneMapping[]> {
  const { data, error } = await supabase.from('parent_phones').select('*');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    phone: p.phone,
    studentId: p.student_id,
    verifiedAt: p.verified_at,
  }));
}

export async function fetchPayments(): Promise<PaybillPayment[]> {
  const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    timestamp: p.created_at,
    mpesaRef: p.mpesa_ref ?? '',
    senderPhone: p.sender_phone,
    amount: Number(p.amount),
    accountRef: p.account_ref,
    status: p.status,
    matchedStudentId: p.matched_student_id ?? undefined,
    matchMethod: p.match_method ?? undefined,
  }));
}

/** Normalizes a phone to its last 9 digits, matching the logic in admissionMatcher.ts. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

/**
 * Confirms a match: updates the payment row, records the tiered allocation,
 * and — if this is the first time this phone has been linked — saves the
 * phone→student mapping so future payments from the same number auto-reconcile.
 */
export async function confirmMatch(
  paymentId: string,
  studentId: string,
  senderPhone: string,
  method: MatchMethod,
  term: string,
  allocations: AllocationLine[],
) {
  const { error: paymentError } = await supabase
    .from('payments')
    .update({ status: 'matched', matched_student_id: studentId, match_method: method })
    .eq('id', paymentId);
  if (paymentError) throw paymentError;

  if (allocations.length > 0) {
    const rows = allocations.map((a) => ({
      payment_id: paymentId,
      student_id: studentId,
      fee_tier_id: a.feeTierId,
      term,
      amount: a.amount,
    }));
    const { error: allocError } = await supabase.from('payment_allocations').insert(rows);
    if (allocError) throw allocError;

    for (const a of allocations) {
      const { data: balance } = await supabase
        .from('student_fee_balances')
        .select('id, amount_paid')
        .eq('student_id', studentId)
        .eq('fee_tier_id', a.feeTierId)
        .eq('term', term)
        .maybeSingle();
      if (balance) {
        await supabase
          .from('student_fee_balances')
          .update({ amount_paid: Number(balance.amount_paid) + a.amount })
          .eq('id', balance.id);
      }
    }
  }

  // Save the phone -> student mapping so next time this parent pays, it's instant.
  // Skip this for cash payments or anything without a real phone number.
  const normalized = normalizePhone(senderPhone);
  if (normalized.length >= 9) {
    const { data: existing } = await supabase
      .from('parent_phones')
      .select('id')
      .eq('phone', normalized)
      .eq('student_id', studentId)
      .maybeSingle();
    if (!existing) {
      await supabase.from('parent_phones').insert({ phone: normalized, student_id: studentId });
    }
  }
}

/**
 * Records a cash payment taken at the bursar's office (no M-Pesa reference)
 * and immediately reconciles it against the given student using the same
 * allocation path as an M-Pesa match. Returns the new payment's id.
 */
export async function recordCashPayment(
  studentId: string,
  amount: number,
  allocations: AllocationLine[],
  term: string,
): Promise<string> {
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      sender_phone: 'Cash',
      amount,
      account_ref: 'Cash payment at bursar office',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !payment) throw error ?? new Error('Unable to record cash payment');

  await confirmMatch(payment.id, studentId, 'Cash', 'manual', term, allocations);
  return payment.id as string;
}

export async function nextReceiptNo(paymentId: string, studentId: string, totalAmount: number, issuedBy: string) {
  const { data, error } = await supabase
    .from('receipts')
    .insert({ payment_id: paymentId, student_id: studentId, total_amount: totalAmount, issued_by: issuedBy })
    .select('receipt_no')
    .single();
  if (error) throw error;
  return data.receipt_no as number;
}

export async function fetchAllocationsForPayment(paymentId: string): Promise<AllocationLine[]> {
  const { data, error } = await supabase
    .from('payment_allocations')
    .select('fee_tier_id, amount, fee_tiers(name)')
    .eq('payment_id', paymentId);
  if (error) throw error;
  return (data ?? []).map((a) => ({
    feeTierId: a.fee_tier_id,
    tierName: (a as unknown as { fee_tiers: { name: string } | null }).fee_tiers?.name ?? 'Fee',
    amount: Number(a.amount),
  }));
}

/** Returns the existing receipt number for a payment if one was already issued, otherwise creates one. */
export async function fetchOrCreateReceiptNo(
  paymentId: string,
  studentId: string,
  totalAmount: number,
  issuedBy: string,
): Promise<number> {
  const { data: existing } = await supabase
    .from('receipts')
    .select('receipt_no')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (existing) return existing.receipt_no as number;
  return nextReceiptNo(paymentId, studentId, totalAmount, issuedBy);
}
