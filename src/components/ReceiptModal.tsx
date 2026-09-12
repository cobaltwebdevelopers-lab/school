import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { PaybillPayment, Student, AllocationLine } from '@/types';
import { formatKSh, SCHOOL, CURRENT_TERM } from '@/mockData';
import { Printer, X, GraduationCap, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  payment: PaybillPayment;
  student: Student;
  allocations: AllocationLine[];
  receiptNo: number;
  outstandingBalance: number;
  onClose: () => void;
}

type PrintFormat = 'standard' | 'thermal';

/** Injects an @page rule sized for an 80mm thermal roll for the duration of the print job, then removes it. */
function printWithThermalPage() {
  const styleEl = document.createElement('style');
  styleEl.id = 'thermal-page-style';
  styleEl.innerHTML = '@media print { @page { size: 80mm auto; margin: 2mm; } }';
  document.head.appendChild(styleEl);

  const cleanup = () => {
    styleEl.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}

export function ReceiptModal({ payment, student, allocations, receiptNo, outstandingBalance, onClose }: ReceiptModalProps) {
  const [format, setFormat] = useState<PrintFormat>('standard');
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const receiptNoFormatted = `ETR-${String(receiptNo).padStart(6, '0')}`;

  useEffect(() => {
    if (!qrRef.current) return;
    const payload = JSON.stringify({
      receiptNo: receiptNoFormatted,
      pin: SCHOOL.kraPin,
      amount: payment.amount,
      date: payment.timestamp,
      student: student.admissionNo,
    });
    QRCode.toCanvas(qrRef.current, payload, { width: 96, margin: 0, color: { dark: '#0f172a', light: '#ffffff' } }).catch(() => {});
  }, [payment, student, receiptNoFormatted]);

  const handlePrint = (fmt: PrintFormat) => {
    setFormat(fmt);
    requestAnimationFrame(() => {
      if (fmt === 'thermal') {
        printWithThermalPage();
      } else {
        window.print();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between print:hidden shrink-0">
          <h3 className="font-bold text-slate-900">Payment Receipt</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {format === 'standard' ? (
            <div className="p-8" id="receipt-content">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{SCHOOL.name}</h2>
                <p className="text-xs text-slate-500">{SCHOOL.motto}</p>
                <p className="text-xs text-slate-400 mt-1">{SCHOOL.address}</p>
                <p className="text-xs text-slate-400">{SCHOOL.phone}</p>
                <p className="text-xs text-slate-400 font-mono mt-1">KRA PIN: {SCHOOL.kraPin}</p>
              </div>

              <div className="flex items-center justify-center gap-2 mb-6 pb-6 border-b border-dashed border-slate-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">Payment Received — eTIMS Receipt</span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Receipt No.</span>
                  <span className="font-mono font-semibold text-slate-900">{receiptNoFormatted}</span>
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

              <div className="mb-6">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Payment Allocation</p>
                <div className="space-y-1.5">
                  {allocations.map((line) => (
                    <div key={line.feeTierId} className="flex justify-between text-sm">
                      <span className="text-slate-500">{line.tierName}</span>
                      <span className="font-medium text-slate-900">{formatKSh(line.amount)}</span>
                    </div>
                  ))}
                  {allocations.length === 0 && (
                    <p className="text-xs text-slate-400">Recorded as a credit — no outstanding balances at time of payment.</p>
                  )}
                </div>
                <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-900">Total Paid</span>
                  <span className="font-bold text-emerald-600">{formatKSh(payment.amount)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-500">Tax Treatment</span>
                  <span className="text-slate-500">Exempt (Education Services)</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="font-semibold text-slate-900">Outstanding Balance</span>
                  <span className="font-bold text-slate-900">{formatKSh(outstandingBalance)}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-dashed border-slate-200">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="h-12 border-b border-slate-300 w-32 mb-1" />
                    <p className="text-xs text-slate-500">Bursar Signature</p>
                  </div>
                  <canvas ref={qrRef} className="w-24 h-24" />
                </div>
                <p className="text-center text-xs text-slate-400 mt-4">
                  This is a computer-generated eTIMS-ready receipt.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-4">
              <div
                id="receipt-content"
                className="text-black"
                style={{ width: '72mm', fontFamily: "'Courier New', Courier, monospace" }}
              >
                <div className="text-center text-[13px] font-bold leading-tight">{SCHOOL.name.toUpperCase()}</div>
                <div className="text-center text-[9px] leading-tight">{SCHOOL.address}</div>
                <div className="text-center text-[9px] leading-tight">Tel: {SCHOOL.phone}</div>
                <div className="text-center text-[9px] leading-tight">KRA PIN: {SCHOOL.kraPin}</div>

                <div className="my-2 border-t border-dashed border-black" />
                <div className="text-center text-[11px] font-bold">FEE PAYMENT RECEIPT</div>
                <div className="mt-1 text-[10px] leading-snug">
                  <div className="flex justify-between"><span>Receipt No:</span><span>{receiptNoFormatted}</span></div>
                  <div className="flex justify-between"><span>Date:</span><span>{new Date(payment.timestamp).toLocaleDateString('en-KE')}</span></div>
                  <div className="flex justify-between"><span>M-Pesa Ref:</span><span>{payment.mpesaRef}</span></div>
                </div>

                <div className="my-2 border-t border-dashed border-black" />
                <div className="text-[10px] leading-snug">
                  <p>Student: {student.name}</p>
                  <p>Adm No: {student.admissionNo} · {student.grade}</p>
                  <p>Term: {CURRENT_TERM}</p>
                </div>

                <div className="my-2 border-t border-dashed border-black" />
                <div className="text-[10px] leading-snug">
                  {allocations.map((line) => (
                    <div key={line.feeTierId} className="flex justify-between">
                      <span>{line.tierName}</span>
                      <span>{formatKSh(line.amount)}</span>
                    </div>
                  ))}
                </div>

                <div className="my-2 border-t border-dashed border-black" />
                <div className="text-center text-[10px]">TOTAL PAID</div>
                <div className="text-center text-[13px] font-bold">{formatKSh(payment.amount)}</div>
                <div className="mt-1 text-[9px] flex justify-between">
                  <span>Tax:</span><span>Exempt (Education)</span>
                </div>
                <div className="text-[9px] flex justify-between">
                  <span>Balance:</span><span>{formatKSh(outstandingBalance)}</span>
                </div>

                <div className="my-2 border-t border-dashed border-black" />
                <div className="flex justify-center">
                  <canvas ref={qrRef} className="w-20 h-20" />
                </div>
                <div className="mt-2 text-center text-[8px] italic leading-tight">
                  Computer-generated eTIMS-ready receipt
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-2 print:hidden shrink-0">
          <div className="flex gap-3">
            <button
              onClick={() => handlePrint('standard')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Standard
            </button>
            <button
              onClick={() => handlePrint('thermal')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Thermal (80mm)
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
