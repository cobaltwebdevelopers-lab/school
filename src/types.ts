export type ReconciliationStatus = 'matched' | 'unmatched' | 'pending';

export type StudentStatus = 'Cleared' | 'Partial' | 'Overdue';

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
}

export interface ReceiptData {
  payment: PaybillPayment;
  student: Student;
  term: string;
  schoolName: string;
  schoolLogo: string;
  generatedAt: string;
}
