import { useState } from 'react';
import { Search, CreditCard, Printer, Clock } from 'lucide-react';
import { Invoice, initialInvoices } from '../../api/mockData';
import { getInvoices, postPayment } from '../../api/client';
import { useEffect } from 'react';
import { InvoiceStatusBadge } from '../../components/Badge';
import { formatINR, formatDate, isOverdue } from '../../utils/formatters';
import { PaymentModal } from './PaymentModal';
import { PrintInvoiceModal } from '../../layouts/PrintInvoiceModal';

interface InvoicesPageProps {
  invoices?: Invoice[];
  onRecordPayment?: (payment: {
    invoiceId: string;
    method: 'UPI' | 'CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
    amount: number;
    note?: string;
  }) => void;
}

export function InvoicesPage({
  invoices: initialList = initialInvoices,
  onRecordPayment,
}: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialList);

  useEffect(() => {
    getInvoices().then((data) => {
      if (data && data.length > 0) setInvoices(data);
    });
  }, []);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals state
  const [activePaymentInvoice, setActivePaymentInvoice] = useState<Invoice | null>(null);
  const [activePrintInvoice, setActivePrintInvoice] = useState<Invoice | null>(null);

  const handleRecordPaymentInternal = (paymentData: {
    invoiceId: string;
    method: 'UPI' | 'CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
    amount: number;
    note?: string;
  }) => {
    postPayment(paymentData.invoiceId, paymentData);
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === paymentData.invoiceId) {
          const newAmountPaid = inv.amountPaid + paymentData.amount;
          const isFullySettled = newAmountPaid >= inv.total;
          const newPayment = {
            id: `pay-${Date.now()}`,
            invoiceId: inv.id,
            method: paymentData.method,
            amount: paymentData.amount,
            paidOn: new Date().toISOString(),
            note: paymentData.note,
          };

          return {
            ...inv,
            amountPaid: newAmountPaid,
            status: isFullySettled ? ('PAID' as const) : inv.status,
            payments: [...(inv.payments || []), newPayment],
          };
        }
        return inv;
      })
    );

    if (onRecordPayment) {
      onRecordPayment(paymentData);
    }
  };

  const filtered = invoices.filter((inv) => {
    const overdue = isOverdue(inv.dueDate, inv.status);
    let matchesStatus = true;
    if (statusFilter === 'OVERDUE') {
      matchesStatus = overdue;
    } else if (statusFilter !== 'ALL') {
      matchesStatus = inv.status === statusFilter;
    }

    const matchesSearch =
      inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.subscriptionNumber.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices & Billing</h1>
            <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
              Staff Operations
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Section 151-154: Invoices generated strictly from subscriptions. Instant settlement via UPI, Card, Cash.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-medium">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Real-time balance tracking & PDF generation</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Invoice #, Customer, or Subscription #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CONFIRMED', 'PAID', 'OVERDUE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-6">Invoice #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Total (INR)</th>
                <th className="py-3.5 px-4 text-right">Paid (INR)</th>
                <th className="py-3.5 px-4 text-right">Balance Due</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const overdue = isOverdue(inv.dueDate, inv.status);
                const balanceDue = Math.max(0, inv.total - inv.amountPaid);

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-mono font-bold text-slate-900">
                      {inv.number}
                      <span className="block text-[11px] font-normal text-slate-400">
                        {inv.subscriptionNumber}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-400">{inv.customerEmail}</div>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`font-medium ${overdue ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                        {formatDate(inv.dueDate)}
                      </span>
                      {overdue && (
                        <span className="block text-[10px] text-red-500 font-semibold">Overdue</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(inv.total)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono text-emerald-600 font-medium">
                      {formatINR(inv.amountPaid)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold">
                      <span className={balanceDue > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {formatINR(balanceDue)}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <InvoiceStatusBadge status={inv.status} isOverdue={overdue} />
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActivePrintInvoice(inv)}
                          title="Print / View Tax Invoice"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {balanceDue > 0 && inv.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setActivePaymentInvoice(inv)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No invoices match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {activePaymentInvoice && (
        <PaymentModal
          invoice={activePaymentInvoice}
          onClose={() => setActivePaymentInvoice(null)}
          onRecordPayment={handleRecordPaymentInternal}
        />
      )}

      {/* Print / Download Invoice Modal */}
      {activePrintInvoice && (
        <PrintInvoiceModal
          invoice={activePrintInvoice}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}
    </div>
  );
}
