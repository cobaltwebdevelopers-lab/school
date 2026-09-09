import { formatKSh } from '@/mockData';
import { Wallet, AlertCircle, Clock, TrendingUp } from 'lucide-react';

interface StatsBarProps {
  totalCollections: number;
  unmatchedCount: number;
  pendingCount: number;
  totalArrears: number;
}

export function StatsBar({ totalCollections, unmatchedCount, pendingCount, totalArrears }: StatsBarProps) {
  const cards = [
    {
      label: 'Term Total Collections',
      value: formatKSh(totalCollections),
      icon: TrendingUp,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      border: 'border-emerald-200',
    },
    {
      label: 'Unreconciled Paybill Payments',
      value: `${unmatchedCount + pendingCount} pending matching`,
      icon: Clock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      border: 'border-amber-200',
    },
    {
      label: 'Outstanding Fee Arrears',
      value: formatKSh(totalArrears),
      icon: AlertCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      border: 'border-red-200',
    },
    {
      label: 'Daraja Integration',
      value: 'C2B Live',
      icon: Wallet,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      border: 'border-emerald-200',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`bg-white rounded-xl border ${card.border} p-5 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-slate-900">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
