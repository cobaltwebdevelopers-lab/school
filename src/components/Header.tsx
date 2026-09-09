import { SCHOOL } from '@/mockData';
import { GraduationCap, Wifi } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-[#0F172A] text-white">
      <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-emerald-500 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">{SCHOOL.name}</h1>
            <p className="text-xs text-slate-400">Fees Reconciliation Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">
              Safaricom Daraja Paybill C2B Live
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">Bursar Office</p>
              <p className="text-xs text-slate-400">{SCHOOL.phone}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
              BO
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
