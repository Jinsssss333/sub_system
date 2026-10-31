import { Printer, X } from 'lucide-react';
import { Invoice } from '../api/mockData';
import { formatINR, formatBps, formatDate, isOverdue } from '../utils/formatters';
import { InvoiceStatusBadge } from '../components/Badge';

interface PrintInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export function PrintInvoiceModal({ invoice, onClose }: PrintInvoiceModalProps) {
  if (!invoice) return null;

  const overdue = isOverdue(invoice.dueDate, invoice.status);
  const balanceDue = Math.max(0, invoice.total - invoice.amountPaid);

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
    >
      {/* Modal Container */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col my-8 cursor-default"
      >
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm">Invoice Preview & Print System</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
              {invoice.number}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="p-8 md:p-12 text-slate-800 bg-white" id="printable-invoice">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-200 pb-8 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-lg">
                  B
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">BRIGHTLOOP</h1>
                  <p className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">
                    Subscription Systems Engine
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 max-w-xs mt-2">
                Brightloop Technologies Private Limited<br />
                Tower 4, Embassy Tech Village, Outer Ring Road<br />
                Bengaluru, Karnataka 560103, India<br />
                GSTIN: 29AABCB1234F1Z5
              </p>
            </div>

            <div className="text-right flex flex-col items-end">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">TAX INVOICE</h2>
              <div className="mt-2 text-sm space-y-1">
                <p className="font-mono text-indigo-700 font-bold">{invoice.number}</p>
                <p className="text-xs text-slate-500">
                  Subscription Ref: <span className="font-mono text-slate-700">{invoice.subscriptionNumber}</span>
                </p>
                <div className="mt-2">
                  <InvoiceStatusBadge status={invoice.status} isOverdue={overdue} />
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-b border-slate-200 text-xs">
            <div>
              <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">Issue Date</span>
              <p className="font-medium text-slate-800 text-sm">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">Due Date</span>
              <p className={`font-medium text-sm ${overdue ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                {formatDate(invoice.dueDate)}
              </p>
            </div>
            <div>
              <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">Billing Period</span>
              <p className="font-medium text-slate-800 text-sm">
                {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
              </p>
            </div>
            <div>
              <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">Payment Status</span>
              <p className="font-medium text-slate-800 text-sm">
                {balanceDue === 0 ? 'Fully Settled' : `Balance: ${formatINR(balanceDue)}`}
              </p>
            </div>
          </div>

          {/* Billed To Address */}
          <div className="py-6 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Billed To</span>
            <h3 className="font-bold text-slate-900 text-base">{invoice.customerName}</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-md">{invoice.customerAddress}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{invoice.customerEmail}</p>
          </div>

          {/* Line Items Table */}
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-600 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-2">#</th>
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-2 text-right">Unit Price</th>
                  <th className="py-3 px-2 text-center">Qty</th>
                  <th className="py-3 px-2 text-right">Discount</th>
                  <th className="py-3 px-2 text-right">Tax Rate</th>
                  <th className="py-3 px-2 text-right">Tax Amount</th>
                  <th className="py-3 px-2 text-right">Net Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-2 font-medium text-slate-900">
                      {line.description}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-700">
                      {formatINR(line.unitPrice)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-medium text-slate-800">
                      {line.quantity}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-600">
                      {line.discountAmount > 0 ? `-${formatINR(line.discountAmount)}` : '—'}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-600">
                      {formatBps(line.taxRateBps)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-600">
                      {formatINR(line.taxAmount)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900">
                      {formatINR(line.amount + line.taxAmount - line.discountAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Summary (Section 148 Invariant: Line -> Discount -> Tax -> Total) */}
          <div className="flex flex-col md:flex-row justify-between items-start pt-4 border-t border-slate-200 gap-8">
            <div className="text-xs text-slate-500 max-w-md space-y-2">
              <p className="font-semibold text-slate-700">Order of Calculation Notice:</p>
              <p className="leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                Line amounts are computed first, followed by discount deduction, GST calculation on the discounted taxable value, and finalized into the total. All values are denominated strictly in Indian Rupees (INR) with integer paise accuracy.
              </p>
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold text-slate-700 mb-1">Recorded Payments:</p>
                  <div className="space-y-1">
                    {invoice.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded border border-emerald-200">
                        <span>{p.method} ({formatDate(p.paidOn)})</span>
                        <span className="font-mono font-bold">{formatINR(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:w-80 space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Subtotal (Gross):</span>
                <span className="font-mono font-medium">{formatINR(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-600">
                <span>Discounts Applied:</span>
                <span className="font-mono font-medium">
                  {invoice.discountTotal > 0 ? `-${formatINR(invoice.discountTotal)}` : '₹0.00'}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>GST Tax (CGST + SGST):</span>
                <span className="font-mono font-medium">{formatINR(invoice.taxTotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="font-mono text-base text-indigo-700">{formatINR(invoice.total)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Amount Paid:</span>
                <span className="font-mono text-emerald-600 font-semibold">{formatINR(invoice.amountPaid)}</span>
              </div>
              <div className={`flex justify-between py-2 border-t border-slate-200 text-xs font-bold ${
                balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                <span>Balance Due:</span>
                <span className="font-mono text-sm">{formatINR(balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-slate-200 text-center text-[11px] text-slate-400">
            Thank you for choosing Brightloop Subscription Systems. This is a computer-generated tax invoice.
          </div>
        </div>
      </div>
    </div>
  );
}
