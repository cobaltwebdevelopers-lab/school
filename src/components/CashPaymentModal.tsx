import { useMemo, useState } from 'react';
import type { Student, StudentFeeBalance, FeeTier } from '@/types';
import { formatKSh, CURRENT_TERM } from '@/mockData';
import { allocatePayment } from '@/lib/paymentAllocation';
import { X, Banknote, Search } from 'lucide-react';

interface CashPaymentModalProps {
  students: Student[];
  feeTiers: FeeTier[];
  balances: StudentFeeBalance[];
  onClose: () => void;
  onSubmit: (studentId: string, amount: number) => Promise<void>;
}

export function CashPaymentModal({ students, feeTiers, balances, onClose, onSubmit }: CashPaymentModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const results = useMemo(() => {
    if (!query || selected) return [];
    const q = query.toLowerCase();
    return students
      .filter((s) => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, selected, students]);

  const preview = useMemo(() => {
    const value = parseFloat(amount);
    if (!selected || !value || value <= 0) return null;
    const tierBalances = feeTiers.map((tier) => {
      const b = balances.find((bal) => bal.studentId === selected.id && bal.feeTierId === tier.id);
      return {
        feeTierId: tier.id,
        tierName: tier.name,
        priority: tier.priority,
        amountDue: b?.amountDue ?? 0,
        amountPaid: b?.amountPaid ?? 0,
      };
    });
    return allocatePayment(value, tierBalances);
  }, [amount, selected, feeTiers, balances]);

  const handleSubmit = async () => {
    const value = parseFloat(amount);
    if (!selected || !value || value <= 0) return;
    setSaving(true);
    try {
      await onSubmit(selected.id, value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Record Cash Payment</h3>
              <p className="text-xs text-slate-500">{CURRENT_TERM}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!selected ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Find Student
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or admission number..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              {results.length > 0 && (
                <div className="mt-2 border border-slate-100 rounded-lg divide-y divide-slate-100 overflow-hidden">
                  {results.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelected(s);
                        setQuery('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-slate-900">{s.name}</span>
                      <span className="text-xs font-mono text-slate-500">{s.admissionNo} · {s.grade}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-500 font-mono">{selected.admissionNo} · {selected.grade}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Change
              </button>
            </div>
          )}

          {selected && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Amount (KSh)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono"
              />
            </div>
          )}

          {preview && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
              <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider mb-2">
                Allocation Preview
              </p>
              <div className="space-y-1">
                {preview.allocations.map((a) => (
                  <div key={a.feeTierId} className="flex justify-between text-sm">
                    <span className="text-slate-600">{a.tierName}</span>
                    <span className="font-semibold text-slate-900">{formatKSh(a.amount)}</span>
                  </div>
                ))}
                {preview.overpayment > 0 && (
                  <div className="flex justify-between text-sm pt-1 border-t border-emerald-200 mt-1">
                    <span className="text-slate-600">Credit (overpayment)</span>
                    <span className="font-semibold text-slate-900">{formatKSh(preview.overpayment)}</span>
                  </div>
                )}
                {preview.allocations.length === 0 && preview.overpayment === 0 && (
                  <p className="text-xs text-slate-500">No outstanding balances found for this student.</p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selected || !amount || parseFloat(amount) <= 0 || saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Recording...' : 'Record Payment & Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
