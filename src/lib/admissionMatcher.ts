import type { Student } from '@/types';

export interface AdmissionCandidate {
  admissionNo: string;
  confidence: 'high' | 'medium';
  matchType: 'prefixed' | 'bare';
}

export interface MatchResult {
  student: Student | null;
  method: 'phone' | 'fuzzy' | 'none';
  confidence: 'high' | 'medium' | 'none';
  candidates: AdmissionCandidate[];
  ambiguous: boolean;
}

/**
 * Extracts admission-number candidates from a messy M-Pesa account reference string.
 *
 * Handles things like:
 *   "1024", "ADM1024", "adm-1024", "ADM 1024", "Adm.1024",
 *   "admission no 1024", "school fees adm:1024", "FEE-1024 TERM2"
 *
 * A prefixed match (something that looks like "ADM" + digits) is treated as
 * high confidence. A bare digit sequence with no prefix is medium confidence,
 * since it could be a phone-number fragment or something unrelated.
 */
export function extractAdmissionCandidates(rawText: string): AdmissionCandidate[] {
  if (!rawText) return [];

  const text = rawText.trim();
  const candidates = new Map<string, AdmissionCandidate>();

  // Prefixed pattern: ADM / ADMISSION / ADM NO / ADM# etc, followed by digits.
  // Separators allowed between the prefix and the digits: space, dot, dash, colon, hash.
  const prefixedPattern = /adm(?:ission)?\.?\s*(?:no\.?|number|#)?\s*[\s.\-:#]*?(\d{3,6})/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixedPattern.exec(text)) !== null) {
    const admissionNo = match[1];
    candidates.set(admissionNo, { admissionNo, confidence: 'high', matchType: 'prefixed' });
  }

  // Bare digit sequences (3-6 digits), used as a fallback when no prefix is present.
  const barePattern = /\d{3,6}/g;
  while ((match = barePattern.exec(text)) !== null) {
    const admissionNo = match[0];
    if (!candidates.has(admissionNo)) {
      candidates.set(admissionNo, { admissionNo, confidence: 'medium', matchType: 'bare' });
    }
  }

  return Array.from(candidates.values());
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Normalize to the last 9 digits (Kenyan local number without country code/leading 0)
  return digits.slice(-9);
}

/**
 * Attempts to reconcile an incoming payment to a student, in priority order:
 *   1. Known parent phone mapping (instant, high confidence)
 *   2. Fuzzy admission-number extraction from the account reference text
 *
 * `knownPhoneMap` maps a normalized phone number to a student id, sourced from
 * the parent_phones table (phones the bursar has previously confirmed).
 */
export function matchPayment(
  senderPhone: string,
  accountRef: string,
  students: Student[],
  knownPhoneMap: Map<string, string>,
): MatchResult {
  // 1. Phone mapping — instant, no need to look at the messy text at all.
  const normalizedSender = normalizePhone(senderPhone);
  const mappedStudentId = knownPhoneMap.get(normalizedSender);
  if (mappedStudentId) {
    const student = students.find((s) => s.id === mappedStudentId) ?? null;
    if (student) {
      return { student, method: 'phone', confidence: 'high', candidates: [], ambiguous: false };
    }
  }

  // 2. Fuzzy match against admission numbers extracted from the account ref.
  const candidates = extractAdmissionCandidates(accountRef);
  const admissionIndex = new Map(students.map((s) => [s.admissionNo.trim(), s]));

  const matchedStudents = candidates
    .map((c) => ({ candidate: c, student: admissionIndex.get(c.admissionNo) }))
    .filter((m): m is { candidate: AdmissionCandidate; student: Student } => !!m.student);

  if (matchedStudents.length === 0) {
    return { student: null, method: 'none', confidence: 'none', candidates, ambiguous: false };
  }

  // Prefer high-confidence (prefixed) matches over bare-digit matches.
  const highConfidence = matchedStudents.filter((m) => m.candidate.confidence === 'high');
  const pool = highConfidence.length > 0 ? highConfidence : matchedStudents;

  const uniqueStudents = new Set(pool.map((m) => m.student.id));
  if (uniqueStudents.size > 1) {
    // Multiple different students plausibly match — needs a human to pick.
    return {
      student: null,
      method: 'fuzzy',
      confidence: 'medium',
      candidates,
      ambiguous: true,
    };
  }

  const best = pool[0];
  return {
    student: best.student,
    method: 'fuzzy',
    confidence: best.candidate.confidence,
    candidates,
    ambiguous: false,
  };
}
