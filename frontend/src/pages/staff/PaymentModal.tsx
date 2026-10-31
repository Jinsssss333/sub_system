import { useState } from 'react';
import type { FormEvent } from 'react';
import { CreditCard, X, Check, AlertCircle } from 'lucide-react';
import { Invoice } from '../../api/mockData';
import { formatINR } from '../../utils/formatters';

interface PaymentModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onRecordPayment: (payment: {
    invoiceId: string;
    method: 'UPI' | 'CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
    amount: number;
    note?: string;
  }) => void;
}

export function PaymentModal({ invoice, onClose, onRecordPayment }: PaymentModalProps) {
  if (!invoice) return null;

  const remainingBalancePaise = Math.max(0, invoice.total - invoice.amountPaid);
  // Default amount in rupees for input
  const [amountRupees, setAmountRupees] = useState<string>((remainingBalancePaise / 100).toFixed(2));
  const [method, setMethod] = useState<'UPI' | 'CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('UPI');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmountPaise = Math.round(parseFloat(amountRupees) * 100);

    if (isNaN(parsedAmountPaise) || parsedAmountPaise <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (parsedAmountPaise > remainingBalancePaise) {
      setError(`Payment cannot exceed the remaining balance of ${formatINR(remainingBalancePaise)}.`);
      return;
    }

    onRecordPayment({
      invoiceId: invoice.id,
      method,
      amount: parsedAmountPaise,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden cursor-default"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">Record Customer Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Banner */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="flex justify-between items-start text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wider block font-semibold">Invoice</span>
              <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{invoice.number}</p>
              <p className="text-slate-600 mt-0.5">{invoice.customerName}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400 uppercase tracking-wider block font-semibold">Remaining Balance</span>
              <p className="font-mono font-extrabold text-base text-rose-600 mt-0.5">
                {formatINR(remainingBalancePaise)}
              </p>
              <p className="text-slate-400 mt-0.5">Total: {formatINR(invoice.total)}</p>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['UPI', 'CARD', 'CASH', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 px-3 rounded-lg border font-medium transition text-center ${
                    method === m
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Amount to Collect (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={(remainingBalancePaise / 100).toString()}
                value={amountRupees}
                onChange={(e) => {
                  setAmountRupees(e.target.value);
                  setError(null);
                }}
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Paise accuracy enforced. Automatically flips status to <strong>PAID</strong> upon full balance settlement.
            </p>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Transaction Reference / Note
            </label>
            <input
              type="text"
              placeholder="e.g. UPI Ref / Bank UTR / Cheque #"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirm & Post Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
