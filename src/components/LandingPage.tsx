import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/product';
import {
  GraduationCap,
  Wand2,
  Phone,
  Layers,
  Receipt,
  ShieldCheck,
  ArrowRight,
  Building2,
  UserPlus,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const features = [
    {
      icon: Wand2,
      title: 'Fuzzy matching',
      text: 'Reconciles messy M-Pesa references like "ADM1024" or "adm-1024" to the right student automatically.',
    },
    {
      icon: Phone,
      title: 'Instant recognition',
      text: 'Once a parent\u2019s phone is linked to their child, every future payment reconciles instantly.',
    },
    {
      icon: Layers,
      title: 'Your fee structure',
      text: 'Define your own fee categories and the order payments are applied \u2014 Boarding first, then Tuition, or however your school works.',
    },
    {
      icon: Receipt,
      title: 'eTIMS-ready receipts',
      text: 'Sequential, QR-coded receipts for each school, in standard and 80mm thermal-printer formats.',
    },
    {
      icon: ShieldCheck,
      title: 'Roles for your whole office',
      text: 'Bursars reconcile, directors see the numbers, teachers just see who\u2019s cleared \u2014 nothing more.',
    },
    {
      icon: Building2,
      title: 'Private to your school',
      text: 'Every school\u2019s students, payments and receipts are kept completely separate from every other school\u2019s.',
    },
  ];

  const steps = [
    { icon: Building2, title: 'Create your school', text: 'Add your school\u2019s details, KRA PIN and M-Pesa paybill.' },
    { icon: UserPlus, title: 'Add students and your team', text: 'Enter students with their term fees, and invite your director and teachers with a code.' },
    { icon: Zap, title: 'Let payments reconcile themselves', text: 'Payments are matched, split across your fee categories, and receipted \u2014 you only handle the exceptions.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">{PRODUCT_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-sm font-semibold text-emerald-600 mb-3">{PRODUCT_TAGLINE}</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
          Fee reconciliation that <span className="text-emerald-600">matches itself</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto">
          Messy M-Pesa references, split fee structures, and hand-written receipts — handled
          automatically, with eTIMS-ready paperwork and the right access for everyone in your office.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={onSignUp}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Create your school
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

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-center text-xl font-bold text-slate-900 mb-8">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="text-center px-2">
              <div className="mx-auto w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Step {i + 1}</p>
              <h3 className="font-semibold text-slate-900 mt-1">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{text}</p>
            </div>
          ))}
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
        {PRODUCT_NAME} · {PRODUCT_TAGLINE}
      </footer>
    </div>
  );
}
