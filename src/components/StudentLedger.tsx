import { useState, useMemo } from 'react';
import type { Student } from '@/types';
import { formatKSh, getStudentStatus, getStudentBalance, CURRENT_TERM } from '@/mockData';
import { Search, MessageCircle, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';

interface StudentLedgerProps {
  students: Student[];
  onWhatsAppAlert: (student: Student) => void;
}

export function StudentLedger({ students, onWhatsAppAlert }: StudentLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Cleared' | 'Partial' | 'Overdue'>('all');

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const status = getStudentStatus(s);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.admissionNo.includes(q) || s.grade.toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, searchQuery, statusFilter]);

  const statusBadge = (student: Student) => {
    const status = getStudentStatus(student);
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
            {filtered.map((student) => {
              const balance = getStudentBalance(student);
              return (
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
                  <td className="px-6 py-3.5 text-right text-slate-600">{formatKSh(student.termTuitionFee)}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-emerald-600">{formatKSh(student.totalPaid)}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-slate-900">{formatKSh(balance)}</td>
                  <td className="px-6 py-3.5">{statusBadge(student)}</td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => onWhatsAppAlert(student)}
                      disabled={getStudentStatus(student) === 'Cleared'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp Alert
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WhatsAppModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const balance = getStudentBalance(student);
  const message = `Dear Parent, payment of KSh ${student.totalPaid.toLocaleString('en-KE')} received for ${student.name} (ADM: ${student.admissionNo}). Outstanding balance for ${CURRENT_TERM} is KSh ${balance.toLocaleString('en-KE')}.`;
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
