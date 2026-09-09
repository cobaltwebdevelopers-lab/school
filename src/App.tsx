import { useState, useMemo } from 'react';
import type { PaybillPayment, Student } from '@/types';
import { students as initialStudents, paybillPayments as initialPayments, getStudentBalance } from '@/mockData';
import { Header } from '@/components/Header';
import { StatsBar } from '@/components/StatsBar';
import { ReconciliationFeed } from '@/components/ReconciliationFeed';
import { StudentLedger, WhatsAppModal } from '@/components/StudentLedger';
import { ReceiptModal } from '@/components/ReceiptModal';
import { BroadcastModal } from '@/components/BroadcastModal';
import { Smartphone } from 'lucide-react';

function App() {
  const [payments, setPayments] = useState<PaybillPayment[]>(initialPayments);
  const [students] = useState<Student[]>(initialStudents);
  const [receiptData, setReceiptData] = useState<{ payment: PaybillPayment; student: Student } | null>(null);
  const [whatsappStudent, setWhatsappStudent] = useState<Student | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const handleMatch = (paymentId: string, studentId: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: 'matched' as const, matchedStudentId: studentId }
          : p
      )
    );
  };

  const stats = useMemo(() => {
    const totalCollections = payments
      .filter((p) => p.status === 'matched')
      .reduce((sum, p) => sum + p.amount, 0);
    const unmatchedCount = payments.filter((p) => p.status === 'unmatched').length;
    const pendingCount = payments.filter((p) => p.status === 'pending').length;
    const totalArrears = students.reduce((sum, s) => sum + getStudentBalance(s), 0);
    return { totalCollections, unmatchedCount, pendingCount, totalArrears };
  }, [payments, students]);

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
          <button
            onClick={() => setShowBroadcast(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Smartphone className="w-4 h-4" />
            Broadcast Overdue SMS Reminders
          </button>
        </div>

        <StatsBar {...stats} />

        <ReconciliationFeed
          payments={payments}
          onMatch={handleMatch}
          onViewReceipt={(payment, student) => setReceiptData({ payment, student })}
        />

        <StudentLedger students={students} onWhatsAppAlert={(s) => setWhatsappStudent(s)} />
      </main>

      {receiptData && (
        <ReceiptModal
          payment={receiptData.payment}
          student={receiptData.student}
          onClose={() => setReceiptData(null)}
        />
      )}

      {whatsappStudent && (
        <WhatsAppModal student={whatsappStudent} onClose={() => setWhatsappStudent(null)} />
      )}

      {showBroadcast && (
        <BroadcastModal students={students} onClose={() => setShowBroadcast(false)} />
      )}
    </div>
  );
}

export default App;
