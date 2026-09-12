import { useState, useMemo, useEffect } from 'react';
import type { PaybillPayment, Student, FeeTier, StudentFeeBalance, MatchMethod, AllocationLine } from '@/types';
import { formatKSh } from '@/mockData';
import { matchPayment, type MatchResult } from '@/lib/admissionMatcher';
import { allocatePayment } from '@/lib/paymentAllocation';
import { Search, CheckCircle2, AlertTriangle, Clock, X, UserCheck, Sparkles, Smartphone } from 'lucide-react';

interface ReconciliationFeedProps {
  payments: PaybillPayment[];
  students: Student[];
  feeTiers: FeeTier[];
  balances: StudentFeeBalance[];
  parentPhoneMap: Map<string, string>;
  onMatch: (paymentId: string, studentId: string, method: MatchMethod, allocations: AllocationLine[]) => void;
  onViewReceipt: (payment: PaybillPayment, student: Student) => void;
}

export function ReconciliationFeed({
  payments,
  students,
  feeTiers,
  balances,
  parentPhoneMap,
  onMatch,
  onViewReceipt,
}: ReconciliationFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'unmatched' | 'pending'>('all');
  const [matchingPayment, setMatchingPayment] = useState<PaybillPayment | null>(null);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.mpesaRef.toLowerCase().includes(q) ||
          p.senderPhone.includes(q) ||
          p.accountRef.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, searchQuery, statusFilter]);

  const statusBadge = (status: PaybillPayment['status']) => {
    const styles = {
      matched: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      unmatched: 'bg-red-100 text-red-700 border-red-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    const icons = {
      matched: <CheckCircle2 className="w-3.5 h-3.5" />,
      unmatched: <AlertTriangle className="w-3.5 h-3.5" />,
      pending: <Clock className="w-3.5 h-3.5" />,
    };
    const labels = { matched: 'Matched', unmatched: 'Unmatched', pending: 'Pending' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
        {icons[status]}
        {labels[status]}
      </span>
    );
  };

  const getStudent = (id?: string) => students.find((s) => s.id === id);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Live Paybill Reconciliation Feed</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time M-PESA Paybill C2B transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ref, phone, account..."
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
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">M-PESA Ref</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sender Phone</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Ref</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((payment) => {
              const student = getStudent(payment.matchedStudentId);
              return (
                <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                    {new Date(payment.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">{payment.mpesaRef}</td>
                  <td className="px-6 py-3.5 text-slate-600">{payment.senderPhone}</td>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">{formatKSh(payment.amount)}</td>
                  <td className="px-6 py-3.5">
                    <span className="text-slate-600">{payment.accountRef}</span>
                    {student && (
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {student.name} (ADM: {student.admissionNo})
                        {payment.matchMethod && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-600">
                            {payment.matchMethod === 'phone' ? <Smartphone className="w-3 h-3" /> : payment.matchMethod === 'fuzzy' ? <Sparkles className="w-3 h-3" /> : null}
                            {payment.matchMethod === 'phone' ? 'auto (known phone)' : payment.matchMethod === 'fuzzy' ? 'auto (fuzzy match)' : 'manual'}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">{statusBadge(payment.status)}</td>
                  <td className="px-6 py-3.5 text-right">
                    {payment.status === 'matched' && student ? (
                      <button
                        onClick={() => onViewReceipt(payment, student)}
                        className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold hover:underline"
                      >
                        View Receipt
                      </button>
                    ) : (
                      <button
                        onClick={() => setMatchingPayment(payment)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Match to Student
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matchingPayment && (
        <MatchModal
          payment={matchingPayment}
          students={students}
          feeTiers={feeTiers}
          balances={balances}
          parentPhoneMap={parentPhoneMap}
          onClose={() => setMatchingPayment(null)}
          onMatch={(studentId, method, allocations) => {
            onMatch(matchingPayment.id, studentId, method, allocations);
            setMatchingPayment(null);
          }}
        />
      )}
    </div>
  );
}

function MatchModal({
  payment,
  students,
  feeTiers,
  balances,
  parentPhoneMap,
  onClose,
  onMatch,
}: {
  payment: PaybillPayment;
  students: Student[];
  feeTiers: FeeTier[];
  balances: StudentFeeBalance[];
  parentPhoneMap: Map<string, string>;
  onClose: () => void;
  onMatch: (studentId: string, method: MatchMethod, allocations: AllocationLine[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [suggestion, setSuggestion] = useState<MatchResult | null>(null);

  useEffect(() => {
    const result = matchPayment(payment.senderPhone, payment.accountRef, students, parentPhoneMap);
    setSuggestion(result);
    if (result.student) setSelectedStudent(result.student);
  }, [payment, students, parentPhoneMap]);

  const filtered = useMemo(() => {
    if (!query) return students;
    const q = query.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.admissionNo.includes(q)
    );
  }, [students, query]);

  const allocation = useMemo(() => {
    if (!selectedStudent) return null;
    const tierBalances = feeTiers.map((tier) => {
      const b = balances.find((bal) => bal.studentId === selectedStudent.id && bal.feeTierId === tier.id);
      return {
        feeTierId: tier.id,
        tierName: tier.name,
        priority: tier.priority,
        amountDue: b?.amountDue ?? 0,
        amountPaid: b?.amountPaid ?? 0,
      };
    });
    return allocatePayment(payment.amount, tierBalances);
  }, [selectedStudent, feeTiers, balances, payment.amount]);

  function confirm() {
    if (!selectedStudent) return;
    const method: MatchMethod = suggestion?.student?.id === selectedStudent.id
      ? (suggestion.method === 'phone' ? 'phone' : suggestion.method === 'fuzzy' ? 'fuzzy' : 'manual')
      : 'manual';
    onMatch(selectedStudent.id, method, allocation?.allocations ?? []);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">Match Payment to Student</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {payment.mpesaRef} - {formatKSh(payment.amount)} from {payment.senderPhone}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {suggestion?.student && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-2.5">
              {suggestion.method === 'phone' ? <Smartphone className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
              <div className="text-xs">
                <p className="font-semibold text-emerald-800">
                  {suggestion.method === 'phone' ? 'Known phone number — instant match' : `Suggested match (${suggestion.confidence} confidence)`}
                </p>
                <p className="text-emerald-700 mt-0.5">
                  {suggestion.student.name} · ADM {suggestion.student.admissionNo} · {suggestion.student.grade}
                </p>
              </div>
            </div>
          )}
          {suggestion?.ambiguous && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
              Multiple students matched candidates in this reference — please confirm manually below.
            </div>
          )}

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or admission no..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2">
            {filtered.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                  selectedStudent?.id === student.id
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">ADM: {student.admissionNo} - {student.grade}</p>
                  </div>
                </div>
                {selectedStudent?.id === student.id && <UserCheck className="w-5 h-5 text-emerald-500" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">No students found</p>
            )}
          </div>

          {selectedStudent && allocation && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3.5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Payment breakdown for {selectedStudent.name}</p>
              <div className="space-y-1.5">
                {allocation.allocations.map((line) => (
                  <div key={line.feeTierId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{line.tierName}</span>
                    <span className="font-mono font-semibold text-slate-900">{formatKSh(line.amount)}</span>
                  </div>
                ))}
                {allocation.allocations.length === 0 && (
                  <p className="text-xs text-slate-400">No outstanding balances — full amount will be recorded as a credit.</p>
                )}
                {allocation.overpayment > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                    <span className="text-slate-500">Overpayment (credit)</span>
                    <span className="font-mono font-semibold text-blue-600">{formatKSh(allocation.overpayment)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={confirm}
            disabled={!selectedStudent}
            className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Match & Allocate Payment
          </button>
        </div>
      </div>
    </div>
  );
}
