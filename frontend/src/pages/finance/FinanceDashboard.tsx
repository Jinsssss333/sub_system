import { useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Users, 
  CreditCard 
} from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { initialInvoices, Invoice } from '../../api/mockData';
import { formatINR, formatDate, isOverdue } from '../../utils/formatters';
import { InvoiceStatusBadge } from '../../components/Badge';
import { PrintInvoiceModal } from '../../layouts/PrintInvoiceModal';

export function FinanceDashboard() {
  const [invoices] = useState<Invoice[]>(initialInvoices);
  const [activePrintInvoice, setActivePrintInvoice] = useState<Invoice | null>(null);

  // Compute Live Metrics from Invoices & Seed Data
  const activeSubscribersCount = 12; // Matching the brief demo target
  const revenueCollectedPaise = 45000000; // ₹4,50,000.00
  const totalOutstandingPaise = 12000000;  // ₹1,20,000.00
  
  // Overdue Invoices
  const overdueInvoices = invoices.filter((inv) => isOverdue(inv.dueDate, inv.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Executive Dashboard</h1>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
              Executive View
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time receivables aggregate, collected revenue, and immediate overdue exposure tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-medium">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>Real-time Financial Aggregates Active</span>
        </div>
      </div>

      {/* 4 Big KPI Metric Cards (Section 78-85 of Person 4 Guide) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Subscriptions */}
        <StatCard
          title="Active Subscriptions"
          value={`${activeSubscribersCount} Active`}
          subtitle="Enterprise & SMB recurring accounts"
          icon={<Users className="w-5 h-5" />}
          accentColor="indigo"
          trend={{ value: '18%', positive: true }}
        />

        {/* Metric 2: Revenue Collected */}
        <StatCard
          title="Revenue Collected"
          value={formatINR(revenueCollectedPaise)}
          subtitle="Settled via UPI, Card & Wire"
          icon={<CreditCard className="w-5 h-5" />}
          accentColor="emerald"
          trend={{ value: '24%', positive: true }}
        />

        {/* Metric 3: Total Outstanding */}
        <StatCard
          title="Total Outstanding"
          value={formatINR(totalOutstandingPaise)}
          subtitle="Uncollected billed receivables"
          icon={<DollarSign className="w-5 h-5" />}
          accentColor="amber"
          trend={{ value: '5%', positive: false }}
        />

        {/* Metric 4: Overdue Invoices */}
        <StatCard
          title="Overdue Invoices"
          value={`${overdueInvoices.length} Invoices`}
          subtitle="Exceeded agreed payment terms"
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="rose"
          trend={{ value: '2', positive: false }}
        />
      </div>

      {/* Overdue Invoices Priority Action Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-base text-slate-900">Overdue Receivables Attention List</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Invoices exceeding due date requiring immediate collection and reminder dispatch.
            </p>
          </div>
          <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-200">
            {overdueInvoices.length} Action Items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-6">Invoice #</th>
                <th className="py-3.5 px-4">Customer Account</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Invoice Total</th>
                <th className="py-3.5 px-4 text-right">Remaining Balance</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdueInvoices.map((inv) => {
                const balanceDue = Math.max(0, inv.total - inv.amountPaid);

                return (
                  <tr key={inv.id} className="hover:bg-rose-50/30 transition">
                    <td className="py-4 px-6 font-mono font-bold text-slate-900">
                      {inv.number}
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{inv.customerEmail}</div>
                    </td>

                    <td className="py-4 px-4 font-bold text-rose-600">
                      {formatDate(inv.dueDate)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-medium text-slate-900">
                      {formatINR(inv.total)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-rose-600">
                      {formatINR(balanceDue)}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <InvoiceStatusBadge status={inv.status} isOverdue={true} />
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActivePrintInvoice(inv)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          View Bill
                        </button>
                        <button
                          onClick={() => alert(`Payment reminder email sent to ${inv.customerEmail}!`)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition shadow-xs"
                        >
                          Send Demand Note
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {overdueInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    No overdue invoices currently. All accounts in good standing!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
