export type ReconciliationStatus = 'matched' | 'unmatched' | 'pending';

export type StudentStatus = 'Cleared' | 'Partial' | 'Overdue';

export type UserRole = 'bursar' | 'director' | 'teacher';

export type MatchMethod = 'phone' | 'fuzzy' | 'manual';

export interface Student {
  id: string;
  admissionNo: string;
  name: string;
  grade: string;
  termTuitionFee: number;
  totalPaid: number;
  parentPhone: string;
  parentName: string;
}

export interface PaybillPayment {
  id: string;
  timestamp: string;
  mpesaRef: string;
  senderPhone: string;
  amount: number;
  accountRef: string;
  status: ReconciliationStatus;
  matchedStudentId?: string;
  matchMethod?: MatchMethod;
}

export interface ReceiptData {
  payment: PaybillPayment;
  student: Student;
  term: string;
  schoolName: string;
  schoolLogo: string;
  generatedAt: string;
  allocations?: AllocationLine[];
  receiptNo?: number;
  kraPin?: string;
}

export interface AllocationLine {
  feeTierId: string;
  tierName: string;
  amount: number;
  /** The term this allocation was applied to (set when read back from the database). */
  term?: string;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  /** null until the user creates or joins a school (onboarding). */
  schoolId: string | null;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

/** A tenant. */
export interface School {
  id: string;
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  kraPin: string;
  paybillNumber: string;
  paybillVerified: boolean;
  currentTerm: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
}

export interface SchoolMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface SchoolInvite {
  id: string;
  code: string;
  role: UserRole;
  maxUses: number;
  useCount: number;
  expiresAt: string;
}

export interface FeeTier {
  id: string;
  name: string;
  priority: number;
}

export interface StudentFeeBalance {
  id: string;
  studentId: string;
  feeTierId: string;
  term: string;
  amountDue: number;
  amountPaid: number;
}

export interface ParentPhoneMapping {
  id: string;
  phone: string;
  studentId: string;
  verifiedAt: string;
}

export interface StudentClearance {
  id: string;
  admissionNo: string;
  name: string;
  grade: string;
  cleared: boolean;
}
