import { useState } from 'react';
import type { Student } from '@/types';
import { getStudentBalance, getStudentStatus, formatKSh, CURRENT_TERM } from '@/mockData';
import { Send, X, CheckCircle2, Smartphone } from 'lucide-react';

interface BroadcastModalProps {
  students: Student[];
  onClose: () => void;
}

export function BroadcastModal({ students, onClose }: BroadcastModalProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const overdueStudents = students.filter((s) => getStudentBalance(s) > 5000);

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Broadcast Overdue SMS Reminders</h3>
              <p className="text-xs text-slate-500">Send fee reminders to parents with balance over KSh 5,000</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Reminders Sent Successfully</h3>
              <p className="text-sm text-slate-500">
                {overdueStudents.length} SMS reminders dispatched to parents via Safaricom bulk SMS gateway.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{overdueStudents.length} parents</span> will receive an SMS reminder for outstanding balances above KSh 5,000.
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {overdueStudents.map((student) => {
                  const balance = getStudentBalance(student);
                  return (
                    <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{student.parentName}</p>
                          <p className="text-xs text-slate-500">{student.parentPhone} - Parent of {student.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Balance</p>
                        <p className="text-sm font-bold text-red-600">{formatKSh(balance)}</p>
                      </div>
                    </div>
                  );
                })}
                {overdueStudents.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-8">No students with balance over KSh 5,000</p>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-500 mb-1">Sample message:</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  "Dear Parent, this is a reminder that the outstanding school fee balance for {CURRENT_TERM} is KSh [amount]. Please pay via M-PESA Paybill {`{school_paybill}`} Account [admission_no]. Thank you."
                </p>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || overdueStudents.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send {overdueStudents.length} SMS Reminders
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
