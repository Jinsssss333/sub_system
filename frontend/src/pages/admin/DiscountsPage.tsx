import { CheckCircle2 } from 'lucide-react';
import { Discount, initialDiscounts } from '../../api/mockData';
import { formatINR, formatBps, formatDate } from '../../utils/formatters';

interface DiscountsPageProps {
  discounts?: Discount[];
}

export function DiscountsPage({ discounts = initialDiscounts }: DiscountsPageProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Discounts & Promos</h1>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Admin Console
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Section 146-150: Only Admins create taxes and discount rules (FIXED or PERCENT basis points).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Evaluation Order: Product Scope → Subscription Scope</span>
        </div>
      </div>

      {/* Discounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {discounts.map((discount) => {
          const isPercent = discount.type === 'PERCENT';
          const usagePercent = discount.usageLimit
            ? Math.round((discount.timesUsed / discount.usageLimit) * 100)
            : 0;

          return (
            <div
              key={discount.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider mb-2 ${
                        discount.scope === 'PRODUCT'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      Scope: {discount.scope}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{discount.name}</h3>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                      {isPercent ? formatBps(discount.value) : formatINR(discount.value)}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {isPercent ? 'Rate Off' : 'Flat Off'}
                    </span>
                  </div>
                </div>

                {/* Criteria */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Threshold Requirement</span>
                    <span className="font-semibold text-slate-800">
                      {discount.minQuantity
                        ? `Min ${discount.minQuantity} seats/units`
                        : discount.minPurchase
                        ? `Min purchase ${formatINR(discount.minPurchase)}`
                        : 'No minimum threshold'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Validity Window</span>
                    <span className="font-semibold text-slate-800">
                      {formatDate(discount.startDate)} – {formatDate(discount.endDate)}
                    </span>
                  </div>
                </div>

                {/* Usage meter */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-600">Usage Limit Meter</span>
                    <span className="font-mono text-slate-700">
                      {discount.timesUsed} / {discount.usageLimit || '∞'} applied
                    </span>
                  </div>
                  {discount.usageLimit && (
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, usagePercent)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-slate-400">Type: {discount.type}</span>
                <span className="text-emerald-700 font-medium">Automatic application active</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
