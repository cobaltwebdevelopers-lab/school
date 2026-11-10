import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { createSchool, acceptInvite } from '@/lib/data';
import { PRODUCT_NAME } from '@/lib/product';
import { GraduationCap, Building2, KeyRound, LogOut } from 'lucide-react';

type Mode = 'create' | 'join';

const inputClass =
  'mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';
const labelClass = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';

export function OnboardingPage() {
  const { profile, signOut, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [currentTerm, setCurrentTerm] = useState(`Term 1 ${new Date().getFullYear()}`);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [paybill, setPaybill] = useState('');
  const [code, setCode] = useState('');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createSchool({ name, currentTerm, address, phone, email, kraPin, paybill });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the school.');
      setBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await acceptInvite(code);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that invite code.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">{PRODUCT_NAME}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Set up your school, or join one your colleagues already created.</p>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={() => { setMode('create'); setError(''); }}
            className={`flex items-center gap-2.5 p-4 rounded-xl border text-left transition-colors ${
              mode === 'create' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Create a school</p>
              <p className="text-xs text-slate-500">You'll be the bursar</p>
            </div>
          </button>
          <button
            onClick={() => { setMode('join'); setError(''); }}
            className={`flex items-center gap-2.5 p-4 rounded-xl border text-left transition-colors ${
              mode === 'join' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <KeyRound className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Join with a code</p>
              <p className="text-xs text-slate-500">From your bursar</p>
            </div>
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <label className={labelClass}>School name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Current term *</label>
              <input required value={currentTerm} onChange={(e) => setCurrentTerm(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>KRA PIN</label>
                <input value={kraPin} onChange={(e) => setKraPin(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>M-Pesa paybill</label>
                <input value={paybill} onChange={(e) => setPaybill(e.target.value)} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Everything except the name and term can be added later in Settings. Fee categories
              (Boarding, Tuition, Transport) are set up for you and can be changed.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {busy ? 'Creating...' : 'Create school'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <label className={labelClass}>Invite code</label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 7F3A9C21B84D"
                className={`${inputClass} font-mono tracking-wider uppercase`}
              />
            </div>
            <p className="text-xs text-slate-400">
              Ask your school's bursar for a code. It sets your role (bursar, director, or teacher).
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {busy ? 'Joining...' : 'Join school'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
