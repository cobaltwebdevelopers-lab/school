import { useState } from 'react';
import type { FeeTier } from '@/types';
import { CURRENT_TERM } from '@/mockData';
import type { NewStudentInput } from '@/lib/data';
import { X, UserPlus } from 'lucide-react';

interface AddStudentModalProps {
  feeTiers: FeeTier[];
  onClose: () => void;
  onSubmit: (input: NewStudentInput) => Promise<void>;
}

export function AddStudentModal({ feeTiers, onClose, onSubmit }: AddStudentModalProps) {
  const [admissionNo, setAdmissionNo] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [dues, setDues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!admissionNo.trim() || !name.trim() || !grade.trim()) {
      setError('Admission number, name, and grade are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        admissionNo: admissionNo.trim(),
        name: name.trim(),
        grade: grade.trim(),
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        term: CURRENT_TERM,
        feeDues: feeTiers.map((t) => ({ feeTierId: t.id, amountDue: parseFloat(dues[t.id] || '0') || 0 })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add student. Check the admission number is unique.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Add Student</h3>
              <p className="text-xs text-slate-500">{CURRENT_TERM}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admission No. *</label>
              <input
                type="text"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade / Class *</label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. Grade 7"
                className="mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parent Name</label>
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parent Phone</label>
              <input
                type="text"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="0712345678"
                className="mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          {feeTiers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Term Fees Due (KSh, leave blank if not applicable)
              </label>
              <div className="mt-1.5 space-y-2">
                {feeTiers.map((tier) => (
                  <div key={tier.id} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-24 shrink-0">{tier.name}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dues[tier.id] ?? ''}
                      onChange={(e) => setDues({ ...dues, [tier.id]: e.target.value })}
                      placeholder="0"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40"
          >
            {saving ? 'Adding...' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}
