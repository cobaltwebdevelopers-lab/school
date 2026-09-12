import { SCHOOL } from '@/mockData';
import { GraduationCap, Wand2, Phone, Layers, Receipt, ShieldCheck, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const features = [
    {
      icon: Wand2,
      title: 'Fuzzy Matching',
      text: 'Reconciles messy M-Pesa references like "ADM1024" or "adm-1024" to the right student automatically.',
    },
    {
      icon: Phone,
      title: 'Instant Recognition',
      text: 'Once a parent\u2019s phone is linked to their child, every future payment reconciles instantly.',
    },
    {
      icon: Layers,
      title: 'Tiered Allocation',
      text: 'Partial payments are split across Boarding, Tuition, and Transport in the right priority order.',
    },
    {
      icon: Receipt,
      title: 'eTIMS-Ready Receipts',
      text: 'Sequential, QR-coded receipts in both standard and 80mm thermal-printer formats.',
    },
    {
      icon: ShieldCheck,
      title: 'Role-Based Access',
      text: 'Bursars reconcile, directors see the numbers, teachers just see who\u2019s cleared \u2014 nothing more.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">{SCHOOL.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
          Fee reconciliation that <span className="text-emerald-600">matches itself</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto">
          Messy M-Pesa references, split fee structures, and manual receipt-writing — handled
          automatically, with eTIMS-ready paperwork and role-based access for your whole office.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={onSignUp}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Create an Account
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onSignIn}
            className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-white transition-colors"
          >
            Sign In
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        {SCHOOL.name} · New accounts start with teacher-level access; ask your bursar to
        upgrade your role if needed.
      </footer>
    </div>
  );
}
