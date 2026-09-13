import { useState, useMemo } from 'react';
import type { Student, StudentFeeBalance } from '@/types';
import { formatKSh, CURRENT_TERM } from '@/mockData';
import { Search, MessageCircle, CheckCircle2, Clock, AlertCircle, X, UserPlus, Trash2 } from 'lucide-react';

type LedgerStatus = 'Cleared' | 'Partial' | 'Overdue';

interface StudentLedgerProps {
  students: Student[];
  balances: StudentFeeBalance[];
  onWhatsAppAlert: (student: Student, due: number, paid: number, balance: number) => void;
  onAddStudent: () => void;
  onRemoveStudent: (student: Student) => void;
}

function studentTotals(studentId: string, balances: StudentFeeBalance[]) {
  const rows = balances.filter((b) => b.studentId === studentId);
  const due = rows.reduce((sum, b) => sum + b.amountDue, 0);
  const paid = rows.reduce((sum, b) => sum + b.amountPaid, 0);
  return { due, paid, balance: Math.max(0, due - paid) };
}

function statusFor(due: number, paid: number): LedgerStatus {
  if (due === 0) return 'Cleared';
  if (paid >= due) return 'Cleared';
  if (paid > 0) return 'Partial';
  return 'Overdue';
}

export function StudentLedger({ students, balances, onWhatsAppAlert, onAddStudent, onRemoveStudent }: StudentLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LedgerStatus>('all');

  const rows = useMemo(() => {
    return students.map((s) => {
      const { due, paid, balance } = studentTotals(s.id, balances);
      return { student: s, due, paid, balance, status: statusFor(due, paid) };
    });
  }, [students, balances]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.student.name.toLowerCase().includes(q) ||
          r.student.admissionNo.includes(q) ||
          r.student.grade.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, searchQuery, statusFilter]);

  const statusBadge = (status: LedgerStatus) => {
    const styles = {
      Cleared: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      Partial: 'bg-amber-100 text-amber-700 border-amber-200',
      Overdue: 'bg-red-100 text-red-700 border-red-200',
    };
    const icons = {
      Cleared: <CheckCircle2 className="w-3.5 h-3.5" />,
      Partial: <Clock className="w-3.5 h-3.5" />,
      Overdue: <AlertCircle className="w-3.5 h-3.5" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Student Fee Ledger & Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">{CURRENT_TERM} - {students.length} students enrolled</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, admission, grade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="Cleared">Cleared</option>
            <option value="Partial">Partial</option>
            <option value="Overdue">Overdue</option>
          </select>
          <button
            onClick={onAddStudent}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admission No.</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Class/Grade</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Term Fee</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total Paid</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Balance</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(({ student, due, paid, balance, status }) => (
              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">{student.admissionNo}</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {student.name.charAt(0)}
                    </div>
                    <span className="font-medium text-slate-900">{student.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-slate-600">{student.grade}</td>
                <td className="px-6 py-3.5 text-right text-slate-600">{formatKSh(due)}</td>
                <td className="px-6 py-3.5 text-right font-semibold text-emerald-600">{formatKSh(paid)}</td>
                <td className="px-6 py-3.5 text-right font-semibold text-slate-900">{formatKSh(balance)}</td>
                <td className="px-6 py-3.5">{statusBadge(status)}</td>
                <td className="px-6 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onWhatsAppAlert(student, due, paid, balance)}
                      disabled={status === 'Cleared'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp Alert
                    </button>
                    <button
                      onClick={() => onRemoveStudent(student)}
                      title="Remove student"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WhatsAppModal({
  student,
  paid,
  balance,
  onClose,
}: {
  student: Student;
  paid: number;
  balance: number;
  onClose: () => void;
}) {
  const message = `Dear Parent, payment of KSh ${paid.toLocaleString('en-KE')} received for ${student.name} (ADM: ${student.admissionNo}). Outstanding balance for ${CURRENT_TERM} is KSh ${balance.toLocaleString('en-KE')}.`;
  const whatsappUrl = `https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">WhatsApp Balance Alert</h3>
              <p className="text-xs text-slate-500">To: {student.parentName} ({student.parentPhone})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
          </div>
          <div className="flex gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Open in WhatsApp
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(message)}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Copy Text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
