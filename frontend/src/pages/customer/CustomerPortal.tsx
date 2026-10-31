import { useState } from 'react';
import { FileText, Receipt, Printer, ShieldCheck } from 'lucide-react';
import { initialSubscriptions, initialInvoices, Invoice } from '../../api/mockData';
import { SubscriptionStatusBadge, InvoiceStatusBadge } from '../../components/Badge';
import { formatINR, formatDate, isOverdue } from '../../utils/formatters';
import { PrintInvoiceModal } from '../../layouts/PrintInvoiceModal';

export function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<'SUBSCRIPTIONS' | 'INVOICES'>('SUBSCRIPTIONS');
  const [activePrintInvoice, setActivePrintInvoice] = useState<Invoice | null>(null);

  // STRICT CUSTOMER DATA ISOLATION: customer@brightloop.test (customerId: 'cust-1')
  const customerEmail = 'customer@brightloop.test';
  const customerId = 'cust-1';

  const mySubscriptions = initialSubscriptions.filter(
    (s) => s.customerId === customerId || s.customerEmail === customerEmail
  );
  const myInvoices = initialInvoices.filter(
    (i) => i.customerId === customerId || i.customerEmail === customerEmail
  );

  return (
    <div className="space-y-6">
      {/* Customer Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              AR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold">Acme Retail Pvt Ltd</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Verified Client
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                <span className="font-mono">customer@brightloop.test</span>
                <span>•</span>
                <span>42 MG Road, Bengaluru, Karnataka</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs border border-white/10">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200">Customer Data Isolation Enforced</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => setActiveTab('SUBSCRIPTIONS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'SUBSCRIPTIONS'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <FileText className="w-4 h-4" /> My Subscriptions ({mySubscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'INVOICES'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <Receipt className="w-4 h-4" /> My Invoices & Receipts ({myInvoices.length})
          </button>
        </div>
      </div>

      {/* Content Section: Subscriptions Tab */}
      {activeTab === 'SUBSCRIPTIONS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mySubscriptions.map((sub) => {
              const totalAmount = sub.lines.reduce((acc, l) => acc + l.amount, 0);

              return (
                <div
                  key={sub.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-500 block">
                          {sub.number}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">{sub.planName}</h3>
                      </div>
                      <SubscriptionStatusBadge status={sub.status} />
                    </div>

                    {/* Subscription Lines */}
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Included Services & Add-ons
                      </span>
                      {sub.lines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <div>
                            <span className="font-medium text-slate-800">{line.productName}</span>
                            {line.variantName && (
                              <span className="ml-2 inline-block bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                {line.variantName}
                              </span>
                            )}
                            <span className="block text-[11px] text-slate-400">Qty: {line.quantity}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatINR(line.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Next Renewal Date</span>
                      <span className="font-semibold text-slate-700">
                        {formatDate(sub.nextInvoiceDate || sub.startDate)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">Total Commitment</span>
                      <span className="font-mono font-bold text-indigo-600 text-sm">
                        {formatINR(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Section: Invoices Tab */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900">Your Billing History</h3>
            <span className="text-xs text-slate-400">Click Print to generate clean PDF tax receipts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Invoice #</th>
                  <th className="py-3.5 px-4">Billing Period</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Total (INR)</th>
                  <th className="py-3.5 px-4 text-right">Amount Paid</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myInvoices.map((inv) => {
                  const overdue = isOverdue(inv.dueDate, inv.status);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {inv.number}
                      </td>
                      <td className="py-4 px-4 text-slate-600">
                        {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-700">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                        {formatINR(inv.total)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-emerald-600 font-semibold">
                        {formatINR(inv.amountPaid)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <InvoiceStatusBadge status={inv.status} isOverdue={overdue} />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setActivePrintInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition border border-indigo-200"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print / PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {activePrintInvoice && (
        <PrintInvoiceModal
          invoice={activePrintInvoice}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}
    </div>
  );
}
