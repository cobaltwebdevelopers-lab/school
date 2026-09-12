import { useEffect, useMemo, useState } from 'react';
import type { FeeTier, StudentFeeBalance, PaybillPayment } from '@/types';
import { fetchFeeTiers, fetchStudentFeeBalances, fetchPayments } from '@/lib/data';
import { formatKSh } from '@/mockData';
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';

const CURRENT_TERM = 'Term 2 2026';

export function DirectorDashboard() {
  const [tiers, setTiers] = useState<FeeTier[]>([]);
  const [balances, setBalances] = useState<StudentFeeBalance[]>([]);
  const [payments, setPayments] = useState<PaybillPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchFeeTiers(), fetchStudentFeeBalances(CURRENT_TERM), fetchPayments()])
      .then(([t, b, p]) => {
        setTiers(t);
        setBalances(b);
        setPayments(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const projected = balances.reduce((sum, b) => sum + b.amountDue, 0);
    const actual = balances.reduce((sum, b) => sum + b.amountPaid, 0);
    const uncollected = Math.max(0, projected - actual);
    const totalCollections = payments
      .filter((p) => p.status === 'matched')
      .reduce((sum, p) => sum + p.amount, 0);
    const collectionRate = projected > 0 ? Math.round((actual / projected) * 100) : 0;
    return { projected, actual, uncollected, totalCollections, collectionRate };
  }, [balances, payments]);

  const byTier = useMemo(() => {
    return tiers.map((tier) => {
      const tierBalances = balances.filter((b) => b.feeTierId === tier.id);
      const due = tierBalances.reduce((s, b) => s + b.amountDue, 0);
      const paid = tierBalances.reduce((s, b) => s + b.amountPaid, 0);
      return { tier, due, paid, pct: due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0 };
    });
  }, [tiers, balances]);

  if (loading) {
    return <main className="max-w-6xl mx-auto px-8 py-8 text-sm text-slate-500">Loading...</main>;
  }

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Financial Reporting</h2>
        <p className="text-sm text-slate-500 mt-1">{CURRENT_TERM} · Director view (read-only)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Wallet className="w-5 h-5" />} label="Total Term Collection" value={formatKSh(stats.totalCollections)} tone="emerald" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Projected Revenue" value={formatKSh(stats.projected)} tone="slate" />
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Actual Revenue" value={formatKSh(stats.actual)} tone="blue" />
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label="Uncollected Debt" value={formatKSh(stats.uncollected)} tone="red" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-slate-900">Collection Rate</h3>
          <span className="text-sm font-bold text-emerald-600">{stats.collectionRate}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.collectionRate}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">Projected vs. actual revenue collected so far this term.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Collection by Fee Category</h3>
        <div className="space-y-4">
          {byTier.map(({ tier, due, paid, pct }) => (
            <div key={tier.id}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">{tier.name}</span>
                <span className="text-slate-500 font-mono">{formatKSh(paid)} / {formatKSh(due)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
          {byTier.length === 0 && <p className="text-sm text-slate-400">No fee tiers configured yet.</p>}
        </div>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'emerald' | 'slate' | 'blue' | 'red' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>{icon}</div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
