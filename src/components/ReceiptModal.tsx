import type { PaybillPayment, Student } from '@/types';
import { formatKSh, SCHOOL, CURRENT_TERM } from '@/mockData';
import { Printer, X, GraduationCap, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  payment: PaybillPayment;
  student: Student;
  onClose: () => void;
}

export function ReceiptModal({ payment, student, onClose }: ReceiptModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between print:hidden">
            <h3 className="font-bold text-slate-900">Payment Receipt</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8" id="receipt-content">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{SCHOOL.name}</h2>
              <p className="text-xs text-slate-500">{SCHOOL.motto}</p>
              <p className="text-xs text-slate-400 mt-1">{SCHOOL.address}</p>
              <p className="text-xs text-slate-400">{SCHOOL.phone}</p>
            </div>

            <div className="flex items-center justify-center gap-2 mb-6 pb-6 border-b border-dashed border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600">Payment Received</span>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Receipt No.</span>
                <span className="font-mono font-semibold text-slate-900">RCP-{payment.mpesaRef}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-900">
                  {new Date(payment.timestamp).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">M-PESA Ref</span>
                <span className="font-mono font-semibold text-slate-900">{payment.mpesaRef}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Sender Phone</span>
                <span className="font-medium text-slate-900">{payment.senderPhone}</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Student Details</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold text-slate-900">{student.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Admission No.</span>
                  <span className="font-mono font-semibold text-slate-900">{student.admissionNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Class</span>
                  <span className="font-medium text-slate-900">{student.grade}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Term</span>
                  <span className="font-medium text-slate-900">{CURRENT_TERM}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Term Tuition Fee</span>
                <span className="font-medium text-slate-900">{formatKSh(student.termTuitionFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-semibold text-emerald-600">{formatKSh(payment.amount)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Outstanding Balance</span>
                <span className="font-bold text-slate-900">
                  {formatKSh(Math.max(0, student.termTuitionFee - student.totalPaid))}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-slate-200">
              <div className="flex justify-between items-end">
                <div>
                  <div className="h-12 border-b border-slate-300 w-32 mb-1" />
                  <p className="text-xs text-slate-500">Bursar Signature</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Generated on</p>
                  <p className="text-xs font-medium text-slate-600">
                    {new Date().toLocaleDateString('en-KE')}
                  </p>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-6">
                This is a computer-generated receipt. No stamp required.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
