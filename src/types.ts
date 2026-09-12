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
}

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
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
