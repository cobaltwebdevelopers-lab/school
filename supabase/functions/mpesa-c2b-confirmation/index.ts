// Supabase Edge Function: receives Safaricom Daraja's C2B "Confirmation" callback for
// EVERY school on the platform, works out which school the payment belongs to, records
// it, and auto-reconciles it using the same priority order as the app:
// known parent phone first, then fuzzy admission-number extraction. Ambiguous or
// unmatched payments are left for that school's bursar to resolve in the app.
//
// Routing: Daraja reports the paybill the money was paid to (BusinessShortCode). The
// payment goes to the school that has that paybill AND has been verified by the
// platform operator (schools.paybill_verified). Unverified claims are ignored, so a
// school can't register someone else's paybill and receive their payments.
//
// Every query below is scoped to the resolved school_id. This function uses the service
// role (which bypasses row-level security), so that scoping is the only isolation here.
//
// Deploy:  supabase functions deploy mpesa-c2b-confirmation --no-verify-jwt
// Secret:  supabase secrets set WEBHOOK_SECRET="a-long-random-string"
// Register the callback URL with Safaricom as:
//   https://<project-ref>.supabase.co/functions/v1/mpesa-c2b-confirmation?secret=<WEBHOOK_SECRET>

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

const accepted = () => new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
const rejected = (status: number, desc: string) =>
  new Response(JSON.stringify({ ResultCode: 1, ResultDesc: desc }), { status });

interface AdmissionCandidate {
  admissionNo: string;
  confidence: 'high' | 'medium';
}

function extractAdmissionCandidates(rawText: string): AdmissionCandidate[] {
  if (!rawText) return [];
  const text = rawText.trim();
  const candidates = new Map<string, AdmissionCandidate>();

  const prefixedPattern = /adm(?:ission)?\.?\s*(?:no\.?|number|#)?\s*[\s.\-:#]*?(\d{3,6})/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixedPattern.exec(text)) !== null) {
    candidates.set(match[1], { admissionNo: match[1], confidence: 'high' });
  }

  const barePattern = /\d{3,6}/g;
  while ((match = barePattern.exec(text)) !== null) {
    if (!candidates.has(match[0])) {
      candidates.set(match[0], { admissionNo: match[0], confidence: 'medium' });
    }
  }

  return Array.from(candidates.values());
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

interface DarajaC2BPayload {
  TransID: string;
  TransAmount: string;
  MSISDN: string;
  BillRefNumber: string;
  BusinessShortCode: string | number;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return rejected(405, 'Method not allowed');

  // Safaricom can't send a Supabase token, so a shared secret in the URL is the gate.
  if (WEBHOOK_SECRET && new URL(req.url).searchParams.get('secret') !== WEBHOOK_SECRET) {
    return rejected(401, 'Unauthorized');
  }

  let body: DarajaC2BPayload;
  try {
    body = await req.json();
  } catch {
    return rejected(400, 'Invalid payload');
  }

  const amount = Number(body.TransAmount);
  const senderPhone = body.MSISDN ?? '';
  const accountRef = body.BillRefNumber ?? '';
  const mpesaRef = body.TransID;
  const shortCode = String(body.BusinessShortCode ?? '').trim();

  if (!mpesaRef || !amount || !senderPhone || !shortCode) {
    return rejected(400, 'Missing required fields');
  }

  // Which school owns this paybill?
  const { data: school } = await supabase
    .from('schools')
    .select('id, current_term')
    .eq('paybill_number', shortCode)
    .eq('paybill_verified', true)
    .maybeSingle();

  if (!school) {
    // Acknowledge so Safaricom doesn't keep retrying, but there's nowhere to file this.
    // Logged so the platform operator can see it (and verify the school's paybill).
    console.warn(`No verified school for paybill ${shortCode}; payment ${mpesaRef} for KSh ${amount} not recorded.`);
    return accepted();
  }

  const schoolId: string = school.id;
  const term: string = school.current_term;

  // Record the raw payment first — it must succeed even if auto-matching fails,
  // so nothing is lost and the bursar can always reconcile by hand.
  const { data: payment, error: insertError } = await supabase
    .from('payments')
    .insert({
      school_id: schoolId,
      mpesa_ref: mpesaRef,
      sender_phone: senderPhone,
      amount,
      account_ref: accountRef,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !payment) {
    // 23505 = duplicate TransID: Safaricom retried a callback we already handled.
    if (insertError?.code === '23505') return accepted();
    console.error(`Failed to record payment ${mpesaRef}:`, insertError?.message);
    return rejected(500, 'Could not record payment');
  }

  // 1. Known phone mapping (this school's only) — instant, high confidence.
  const normalizedSender = normalizePhone(senderPhone);
  let matchedStudentId: string | null = null;
  let matchMethod: 'phone' | 'fuzzy' | null = null;

  if (normalizedSender.length >= 9) {
    const { data: phoneMatch } = await supabase
      .from('parent_phones')
      .select('student_id, students!inner(is_active)')
      .eq('school_id', schoolId)
      .eq('phone', normalizedSender)
      .eq('students.is_active', true)
      .limit(1)
      .maybeSingle();
    if (phoneMatch) {
      matchedStudentId = phoneMatch.student_id;
      matchMethod = 'phone';
    }
  }

  // 2. Fuzzy admission-number extraction, only if the phone didn't resolve it.
  if (!matchedStudentId) {
    const candidates = extractAdmissionCandidates(accountRef);
    if (candidates.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, admission_no')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .in('admission_no', candidates.map((c) => c.admissionNo));

      const matched = (students ?? []).map((s) => ({
        student: s,
        candidate: candidates.find((c) => c.admissionNo === s.admission_no)!,
      }));

      const highConfidence = matched.filter((m) => m.candidate.confidence === 'high');
      const pool = highConfidence.length > 0 ? highConfidence : matched;
      const uniqueStudentIds = new Set(pool.map((m) => m.student.id));

      if (uniqueStudentIds.size === 1) {
        matchedStudentId = pool[0].student.id;
        matchMethod = 'fuzzy';
      }
      // Ambiguous (several different students) or none: leave for the bursar.
    }
  }

  if (!matchedStudentId || !matchMethod) {
    await supabase.from('payments').update({ status: 'unmatched' }).eq('id', payment.id);
    return accepted();
  }

  // Allocate across this school's fee tiers, priority order first.
  const [{ data: feeTiers }, { data: balances }] = await Promise.all([
    supabase.from('fee_tiers').select('id, priority').eq('school_id', schoolId).order('priority'),
    supabase
      .from('student_fee_balances')
      .select('id, fee_tier_id, amount_due, amount_paid')
      .eq('school_id', schoolId)
      .eq('student_id', matchedStudentId)
      .eq('term', term),
  ]);

  let remaining = amount;
  const allocationRows: {
    school_id: string;
    payment_id: string;
    student_id: string;
    fee_tier_id: string;
    term: string;
    amount: number;
  }[] = [];

  for (const tier of feeTiers ?? []) {
    if (remaining <= 0) break;
    const balance = (balances ?? []).find((b) => b.fee_tier_id === tier.id);
    if (!balance) continue;
    const outstanding = Math.max(0, Number(balance.amount_due) - Number(balance.amount_paid));
    if (outstanding <= 0) continue;
    const toAllocate = Math.min(outstanding, remaining);
    allocationRows.push({
      school_id: schoolId,
      payment_id: payment.id,
      student_id: matchedStudentId,
      fee_tier_id: tier.id,
      term,
      amount: toAllocate,
    });
    await supabase
      .from('student_fee_balances')
      .update({ amount_paid: Number(balance.amount_paid) + toAllocate })
      .eq('id', balance.id)
      .eq('school_id', schoolId);
    remaining -= toAllocate;
  }

  if (allocationRows.length > 0) {
    await supabase.from('payment_allocations').insert(allocationRows);
  }

  await supabase
    .from('payments')
    .update({ status: 'matched', matched_student_id: matchedStudentId, match_method: matchMethod })
    .eq('id', payment.id);

  // Remember this phone for this student so the next payment is instant.
  if (normalizedSender.length >= 9) {
    const { data: existingPhone } = await supabase
      .from('parent_phones')
      .select('id')
      .eq('school_id', schoolId)
      .eq('phone', normalizedSender)
      .eq('student_id', matchedStudentId)
      .maybeSingle();
    if (!existingPhone) {
      await supabase
        .from('parent_phones')
        .insert({ school_id: schoolId, phone: normalizedSender, student_id: matchedStudentId });
    }
  }

  return accepted();
});
