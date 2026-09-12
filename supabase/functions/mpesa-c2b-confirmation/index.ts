// Supabase Edge Function: receives Safaricom Daraja's C2B "Confirmation" callback,
// records the payment, and auto-reconciles it using the same priority order as
// the app's client-side matching (parent_phones mapping first, then fuzzy
// admission-number extraction). Only truly ambiguous or no-match payments are
// left for the bursar to resolve by hand in the Reconciliation feed.
//
// Deploy with: supabase functions deploy mpesa-c2b-confirmation --no-verify-jwt
// (Safaricom's callback can't send a Supabase auth token, so JWT verification
// must be disabled for this one function — see SETUP.md.)

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const CURRENT_TERM = Deno.env.get('CURRENT_TERM') ?? 'Term 2 2026';

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
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Method not allowed' }), { status: 405 });
  }

  let body: DarajaC2BPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Invalid payload' }), { status: 400 });
  }

  const amount = Number(body.TransAmount);
  const senderPhone = body.MSISDN ?? '';
  const accountRef = body.BillRefNumber ?? '';
  const mpesaRef = body.TransID;

  if (!mpesaRef || !amount || !senderPhone) {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Missing required fields' }), { status: 400 });
  }

  // Record the raw payment first — this must succeed even if auto-matching fails,
  // so nothing gets lost and the bursar can always reconcile manually as a fallback.
  const { data: payment, error: insertError } = await supabase
    .from('payments')
    .insert({ mpesa_ref: mpesaRef, sender_phone: senderPhone, amount, account_ref: accountRef, status: 'pending' })
    .select('id')
    .single();

  if (insertError || !payment) {
    // Duplicate TransID (Safaricom retries callbacks) — treat as already handled.
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
  }

  // 1. Known phone mapping — instant, high confidence.
  const normalizedSender = normalizePhone(senderPhone);
  let matchedStudentId: string | null = null;
  let matchMethod: 'phone' | 'fuzzy' | null = null;

  if (normalizedSender.length >= 9) {
    const { data: phoneMatch } = await supabase
      .from('parent_phones')
      .select('student_id')
      .eq('phone', normalizedSender)
      .maybeSingle();
    if (phoneMatch) {
      matchedStudentId = phoneMatch.student_id;
      matchMethod = 'phone';
    }
  }

  // 2. Fuzzy admission-number extraction, only if phone mapping didn't resolve it.
  if (!matchedStudentId) {
    const candidates = extractAdmissionCandidates(accountRef);
    if (candidates.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, admission_no')
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
      // If ambiguous (multiple different students matched) or no match at all,
      // leave matchedStudentId null — the bursar resolves it in the app.
    }
  }

  if (!matchedStudentId || !matchMethod) {
    await supabase.from('payments').update({ status: 'unmatched' }).eq('id', payment.id);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
  }

  // Allocate the payment across the student's fee tiers, priority order first.
  const [{ data: feeTiers }, { data: balances }] = await Promise.all([
    supabase.from('fee_tiers').select('*').order('priority'),
    supabase.from('student_fee_balances').select('*').eq('student_id', matchedStudentId).eq('term', CURRENT_TERM),
  ]);

  let remaining = amount;
  const allocationRows: { payment_id: string; student_id: string; fee_tier_id: string; term: string; amount: number }[] = [];
  for (const tier of feeTiers ?? []) {
    if (remaining <= 0) break;
    const balance = (balances ?? []).find((b) => b.fee_tier_id === tier.id);
    if (!balance) continue;
    const outstanding = Math.max(0, Number(balance.amount_due) - Number(balance.amount_paid));
    if (outstanding <= 0) continue;
    const toAllocate = Math.min(outstanding, remaining);
    allocationRows.push({ payment_id: payment.id, student_id: matchedStudentId, fee_tier_id: tier.id, term: CURRENT_TERM, amount: toAllocate });
    await supabase
      .from('student_fee_balances')
      .update({ amount_paid: Number(balance.amount_paid) + toAllocate })
      .eq('id', balance.id);
    remaining -= toAllocate;
  }

  if (allocationRows.length > 0) {
    await supabase.from('payment_allocations').insert(allocationRows);
  }

  await supabase
    .from('payments')
    .update({ status: 'matched', matched_student_id: matchedStudentId, match_method: matchMethod })
    .eq('id', payment.id);

  // First time this phone has paid for this student — remember it for next time.
  if (matchMethod && normalizedSender.length >= 9) {
    const { data: existingPhone } = await supabase
      .from('parent_phones')
      .select('id')
      .eq('phone', normalizedSender)
      .eq('student_id', matchedStudentId)
      .maybeSingle();
    if (!existingPhone) {
      await supabase.from('parent_phones').insert({ phone: normalizedSender, student_id: matchedStudentId });
    }
  }

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
});
