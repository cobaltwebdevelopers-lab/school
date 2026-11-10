import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth, useSchool } from '@/lib/auth';
import {
  updateSchoolSettings,
  fetchMembers,
  setMemberRole,
  removeMember,
  createInvite,
  fetchInvites,
  revokeInvite,
  fetchFeeTiers,
  addFeeTier,
  updateFeeTier,
  deleteFeeTier,
} from '@/lib/data';
import type { FeeTier, SchoolInvite, SchoolMember, UserRole } from '@/types';
import { ArrowLeft, Building2, Users, Layers, Copy, Trash2, Plus, CheckCircle2, Clock, Check } from 'lucide-react';

type Tab = 'school' | 'team' | 'fees';

const inputClass =
  'mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';
const labelClass = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';
const roleLabel: Record<UserRole, string> = { bursar: 'Bursar', director: 'Director', teacher: 'Teacher' };

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/* ------------------------------ School ------------------------------ */

function SchoolTab() {
  const school = useSchool();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: school.name,
    motto: school.motto,
    address: school.address,
    phone: school.phone,
    email: school.email,
    kraPin: school.kraPin,
    paybill: school.paybillNumber,
    currentTerm: school.currentTerm,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setSaved(false);
  };

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateSchoolSettings(form);
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  const trialDays = school.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(school.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>School name *</label>
            <input required value={form.name} onChange={set('name')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Current term *</label>
            <input required value={form.currentTerm} onChange={set('currentTerm')} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Motto</label>
          <input value={form.motto} onChange={set('motto')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <input value={form.address} onChange={set('address')} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Phone</label>
            <input value={form.phone} onChange={set('phone')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>KRA PIN</label>
            <input value={form.kraPin} onChange={set('kraPin')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>M-Pesa paybill</label>
            <input value={form.paybill} onChange={set('paybill')} className={inputClass} />
          </div>
        </div>

        {form.paybill.trim() && (
          <div
            className={`flex items-start gap-2.5 rounded-lg p-3 text-sm ${
              school.paybillVerified && form.paybill.trim() === school.paybillNumber
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {school.paybillVerified && form.paybill.trim() === school.paybillNumber ? (
              <>
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Paybill verified. Incoming M-Pesa payments are routed to your school automatically.</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Pending verification. We confirm you own this paybill before routing its payments to your
                  school — until then, record payments manually. Changing the number restarts verification.
                </span>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Changing the current term doesn't move any student balances. Add the new term's fees to each student first.
        </p>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-900">Subscription</h3>
        <p className="text-sm text-slate-500 mt-1">
          {school.subscriptionStatus === 'trialing' && trialDays !== null
            ? `Free trial — ${trialDays} day${trialDays === 1 ? '' : 's'} left.`
            : school.subscriptionStatus === 'active'
              ? 'Active.'
              : school.subscriptionStatus === 'past_due'
                ? 'Payment overdue.'
                : 'Cancelled.'}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- Team ------------------------------- */

function TeamTab() {
  const { user } = useAuth();
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [invites, setInvites] = useState<SchoolInvite[]>([]);
  const [inviteRole, setInviteRole] = useState<UserRole>('teacher');
  const [maxUses, setMaxUses] = useState(1);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([fetchMembers(), fetchInvites()]);
    setMembers(m);
    setInvites(i);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  function copy(code: string) {
    void navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 1500);
  }

  const active = invites.filter((i) => new Date(i.expiresAt) > new Date() && i.useCount < i.maxUses);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Members</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {m.fullName || m.email} {m.id === user?.id && <span className="text-xs text-slate-400">(you)</span>}
                </p>
                <p className="text-xs text-slate-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={m.role}
                  onChange={(e) => run(() => setMemberRole(m.id, e.target.value as UserRole))}
                  className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {(Object.keys(roleLabel) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{roleLabel[r]}</option>
                  ))}
                </select>
                {m.id !== user?.id && (
                  <button
                    title="Remove from school"
                    onClick={() => {
                      if (window.confirm(`Remove ${m.fullName || m.email} from this school? They'll lose access immediately.`)) {
                        void run(() => removeMember(m.id));
                      }
                    }}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-900">Invite a colleague</h3>
        <p className="text-xs text-slate-500 mt-1">
          They sign up, choose "Join with a code", and enter it. Codes expire after 14 days.
        </p>
        <div className="flex flex-wrap items-end gap-3 mt-4">
          <div>
            <label className={labelClass}>Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="mt-1.5 block px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white"
            >
              {(Object.keys(roleLabel) as UserRole[]).map((r) => (
                <option key={r} value={r}>{roleLabel[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>People</label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1.5 block w-24 px-3 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <button
            onClick={() => run(() => createInvite(inviteRole, maxUses))}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Create code
          </button>
        </div>

        {active.length > 0 && (
          <div className="mt-5 space-y-2">
            {active.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold tracking-wider text-slate-900">{i.code}</span>
                  <span className="text-xs text-slate-500">
                    {roleLabel[i.role]} · {i.useCount}/{i.maxUses} used · expires{' '}
                    {new Date(i.expiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copy(i.code)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg"
                  >
                    {copied === i.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === i.code ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    title="Revoke"
                    onClick={() => run(() => revokeInvite(i.id))}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Fee structure --------------------------- */

function FeeRow({ tier, onChanged, onError }: { tier: FeeTier; onChanged: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(tier.name);
  const [priority, setPriority] = useState(String(tier.priority));
  const dirty = name.trim() !== tier.name || Number(priority) !== tier.priority;

  async function save() {
    try {
      await updateFeeTier(tier.id, name, Number(priority) || 1);
      onChanged();
    } catch (e) {
      onError(errMsg(e));
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the "${tier.name}" category?`)) return;
    try {
      await deleteFeeTier(tier.id);
      onChanged();
    } catch (e) {
      onError(errMsg(e));
    }
  }

  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <input
        type="number"
        min={1}
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="w-16 px-2.5 py-2 text-sm border border-slate-200 rounded-lg font-mono text-center"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
      />
      <button
        onClick={save}
        disabled={!dirty || !name.trim()}
        className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-30"
      >
        Save
      </button>
      <button
        title="Delete"
        onClick={remove}
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function FeesTab() {
  const [tiers, setTiers] = useState<FeeTier[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setTiers(await fetchFeeTiers());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    try {
      await addFeeTier(newName, (tiers.length ? tiers[tiers.length - 1].priority : 0) + 1);
      setNewName('');
      await load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">Fee categories</h3>
        <p className="text-xs text-slate-500 mt-1">
          A payment is applied to the lowest number first. Change a number to change the order — for example
          Boarding 1, Tuition 2, Transport 3.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {tiers.map((t) => (
          <FeeRow key={`${t.id}-${t.name}-${t.priority}`} tier={t} onChanged={load} onError={setError} />
        ))}
      </div>
      <form onSubmit={handleAdd} className="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category, e.g. Lunch"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </form>
      {error && <p className="px-6 pb-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/* ------------------------------- Page ------------------------------- */

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('school');
  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'school', label: 'School', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'fees', label: 'Fee structure', icon: Layers },
  ];

  return (
    <main className="max-w-3xl mx-auto px-8 py-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </button>
      <h2 className="text-2xl font-bold text-slate-900">Settings</h2>

      <div className="flex gap-1 mt-5 mb-6 border-b border-slate-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'school' && <SchoolTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'fees' && <FeesTab />}
    </main>
  );
}
