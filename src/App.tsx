import { useState, useMemo, useEffect, useCallback } from 'react';
import type { PaybillPayment, Student, FeeTier, StudentFeeBalance, MatchMethod, AllocationLine } from '@/types';
import { CURRENT_TERM } from '@/mockData';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchStudents,
  fetchFeeTiers,
  fetchStudentFeeBalances,
  fetchParentPhones,
  fetchPayments,
  confirmMatch,
  fetchAllocationsForPayment,
  fetchOrCreateReceiptNo,
  recordCashPayment,
} from '@/lib/data';
import { LoginPage } from '@/components/LoginPage';
import { LandingPage } from '@/components/LandingPage';
import { TeacherDashboard } from '@/components/TeacherDashboard';
import { DirectorDashboard } from '@/components/DirectorDashboard';
import { Header } from '@/components/Header';
import { StatsBar } from '@/components/StatsBar';
import { ReconciliationFeed } from '@/components/ReconciliationFeed';
import { StudentLedger, WhatsAppModal } from '@/components/StudentLedger';
import { ReceiptModal } from '@/components/ReceiptModal';
import { BroadcastModal } from '@/components/BroadcastModal';
import { CashPaymentModal } from '@/components/CashPaymentModal';
import { allocatePayment } from '@/lib/paymentAllocation';
import { Smartphone, Banknote } from 'lucide-react';

interface ReceiptState {
  payment: PaybillPayment;
  student: Student;
  allocations: AllocationLine[];
  receiptNo: number;
  outstandingBalance: number;
}

function BursarDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeTiers, setFeeTiers] = useState<FeeTier[]>([]);
  const [balances, setBalances] = useState<StudentFeeBalance[]>([]);
  const [parentPhoneMap, setParentPhoneMap] = useState<Map<string, string>>(new Map());
  const [payments, setPayments] = useState<PaybillPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [receiptData, setReceiptData] = useState<ReceiptState | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<{ student: Student; paid: number; balance: number } | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);

  const loadAll = useCallback(async () => {
    const [s, t, b, phones, p] = await Promise.all([
      fetchStudents(),
      fetchFeeTiers(),
      fetchStudentFeeBalances(CURRENT_TERM),
      fetchParentPhones(),
      fetchPayments(),
    ]);
    setStudents(s);
    setFeeTiers(t);
    setBalances(b);
    setParentPhoneMap(new Map(phones.map((ph) => [ph.phone, ph.studentId])));
    setPayments(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleMatch = async (paymentId: string, studentId: string, method: MatchMethod, allocations: AllocationLine[]) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;
    await confirmMatch(paymentId, studentId, payment.senderPhone, method, CURRENT_TERM, allocations);
    await loadAll();
  };

  const handleCashPayment = async (studentId: string, amount: number) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const tierBalances = feeTiers.map((tier) => {
      const b = balances.find((bal) => bal.studentId === studentId && bal.feeTierId === tier.id);
      return {
        feeTierId: tier.id,
        tierName: tier.name,
        priority: tier.priority,
        amountDue: b?.amountDue ?? 0,
        amountPaid: b?.amountPaid ?? 0,
      };
    });
    const { allocations } = allocatePayment(amount, tierBalances);

    const paymentId = await recordCashPayment(studentId, amount, allocations, CURRENT_TERM);
    await loadAll();
    setShowCashModal(false);

    const [fetchedAllocations, receiptNo] = await Promise.all([
      fetchAllocationsForPayment(paymentId),
      fetchOrCreateReceiptNo(paymentId, studentId, amount, user?.id ?? ''),
    ]);
    const due = tierBalances.reduce((sum, t) => sum + t.amountDue, 0);
    const paid = tierBalances.reduce((sum, t) => sum + t.amountPaid, 0) + amount;
    setReceiptData({
      payment: {
        id: paymentId,
        mpesaRef: 'CASH',
        senderPhone: 'Cash',
        amount,
        accountRef: 'Cash payment',
        status: 'matched',
        timestamp: new Date().toISOString(),
      },
      student,
      allocations: fetchedAllocations,
      receiptNo,
      outstandingBalance: Math.max(0, due - paid),
    });
  };

  const openReceipt = async (payment: PaybillPayment, student: Student) => {
    const [allocations, receiptNo] = await Promise.all([
      fetchAllocationsForPayment(payment.id),
      fetchOrCreateReceiptNo(payment.id, student.id, payment.amount, user?.id ?? ''),
    ]);
    const studentBalances = balances.filter((b) => b.studentId === student.id);
    const due = studentBalances.reduce((sum, b) => sum + b.amountDue, 0);
    const paid = studentBalances.reduce((sum, b) => sum + b.amountPaid, 0);
    setReceiptData({ payment, student, allocations, receiptNo, outstandingBalance: Math.max(0, due - paid) });
  };

  const stats = useMemo(() => {
    const totalCollections = payments
      .filter((p) => p.status === 'matched')
      .reduce((sum, p) => sum + p.amount, 0);
    const unmatchedCount = payments.filter((p) => p.status === 'unmatched').length;
    const pendingCount = payments.filter((p) => p.status === 'pending').length;
    const totalArrears = balances.reduce((sum, b) => sum + Math.max(0, b.amountDue - b.amountPaid), 0);
    return { totalCollections, unmatchedCount, pendingCount, totalArrears };
  }, [payments, balances]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="max-w-[1400px] mx-auto px-8 py-16 text-center text-sm text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Fees Reconciliation Dashboard</h2>
            <p className="text-sm text-slate-500 mt-1">
              {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCashModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <Banknote className="w-4 h-4" />
              Record Cash Payment
            </button>
            <button
              onClick={() => setShowBroadcast(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
            >
              <Smartphone className="w-4 h-4" />
              Broadcast Overdue SMS Reminders
            </button>
          </div>
        </div>

        <StatsBar {...stats} />

        <ReconciliationFeed
          payments={payments}
          students={students}
          feeTiers={feeTiers}
          balances={balances}
          parentPhoneMap={parentPhoneMap}
          onMatch={handleMatch}
          onViewReceipt={openReceipt}
        />

        <StudentLedger
          students={students}
          balances={balances}
          onWhatsAppAlert={(student, _due, paid, balance) => setWhatsappTarget({ student, paid, balance })}
        />
      </main>

      {receiptData && (
        <ReceiptModal
          payment={receiptData.payment}
          student={receiptData.student}
          allocations={receiptData.allocations}
          receiptNo={receiptData.receiptNo}
          outstandingBalance={receiptData.outstandingBalance}
          onClose={() => setReceiptData(null)}
        />
      )}

      {whatsappTarget && (
        <WhatsAppModal
          student={whatsappTarget.student}
          paid={whatsappTarget.paid}
          balance={whatsappTarget.balance}
          onClose={() => setWhatsappTarget(null)}
        />
      )}

      {showCashModal && (
        <CashPaymentModal
          students={students}
          feeTiers={feeTiers}
          balances={balances}
          onClose={() => setShowCashModal(false)}
          onSubmit={handleCashPayment}
        />
      )}

      {showBroadcast && (
        <BroadcastModal students={students} balances={balances} onClose={() => setShowBroadcast(false)} />
      )}
    </div>
  );
}

function App() {
  const { user, profile, loading } = useAuth();
  const [screen, setScreen] = useState<'landing' | 'signin' | 'signup'>('landing');

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-slate-900">Supabase not configured</h1>
          <p className="text-sm text-slate-500 mt-2">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file, run the migration
            in supabase/migrations, then create your first bursar account.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading...</div>;
  }

  if (!user) {
    if (screen === 'signin' || screen === 'signup') {
      return <LoginPage initialMode={screen} onBack={() => setScreen('landing')} />;
    }
    return (
      <LandingPage onSignIn={() => setScreen('signin')} onSignUp={() => setScreen('signup')} />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-slate-900">Account not set up</h1>
          <p className="text-sm text-slate-500 mt-2">
            Your login works, but no role has been assigned yet. Ask your administrator to add a
            row for you in the <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">profiles</code> table.
          </p>
        </div>
      </div>
    );
  }

  if (profile.role === 'teacher') {
    return <TeacherDashboard />;
  }

  if (profile.role === 'director') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <DirectorDashboard />
      </div>
    );
  }

  return <BursarDashboard />;
}

export default App;
