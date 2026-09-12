import { useEffect, useMemo, useState } from 'react';
import type { StudentClearance } from '@/types';
import { fetchStudentClearance } from '@/lib/data';
import { Search, GraduationCap } from 'lucide-react';

export function TeacherDashboard() {
  const [students, setStudents] = useState<StudentClearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');

  useEffect(() => {
    fetchStudentClearance()
      .then(setStudents)
      .finally(() => setLoading(false));
  }, []);

  const grades = useMemo(() => Array.from(new Set(students.map((s) => s.grade))).sort(), [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [students, search, gradeFilter]);

  return (
    <main className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Class Clearance List</h2>
          <p className="text-sm text-slate-500">Fee clearance status for this term</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        >
          <option value="all">All Classes</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students found.</p>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">{s.grade} · Adm No. {s.admissionNo}</p>
              </div>
              <span
                className={`inline-block w-3.5 h-3.5 rounded-full ${s.cleared ? 'bg-emerald-500' : 'bg-red-500'}`}
                title={s.cleared ? 'Cleared for term' : 'Not cleared'}
                aria-label={s.cleared ? 'Cleared for term' : 'Not cleared'}
              />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
