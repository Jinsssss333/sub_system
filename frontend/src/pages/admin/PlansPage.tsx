import { useState, useEffect } from 'react';
import { Calendar, Zap } from 'lucide-react';
import { Plan, initialPlans } from '../../api/mockData';
import { getPlans } from '../../api/client';
import { formatINR, formatDate } from '../../utils/formatters';
import { PolicyBadge } from '../../components/Badge';

interface PlansPageProps {
  plans?: Plan[];
}

export function PlansPage({ plans: initialList = initialPlans }: PlansPageProps) {
  const [plans, setPlans] = useState<Plan[]>(initialList);

  useEffect(() => {
    getPlans().then((data) => {
      if (data && data.length > 0) setPlans(data);
    });
  }, []);
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscription Plans</h1>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Admin Console
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure recurring billing plans, minimum commit thresholds, and policy rules.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-800 px-3.5 py-2 rounded-xl text-xs font-medium">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span>Section 136-142 Business Invariants Active</span>
        </div>
      </div>

      {/* Plans Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider mb-2">
                    {plan.billingPeriod}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-indigo-600 font-mono">
                    {formatINR(plan.price)}
                  </div>
                  <div className="text-xs text-slate-400">per {plan.billingPeriod.toLowerCase()}</div>
                </div>
              </div>

              {/* Threshold & Validity */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[11px]">Minimum Quantity</span>
                  <span className="font-semibold text-slate-800">{plan.minQuantity} unit(s)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Plan Start Date</span>
                  <span className="font-semibold text-slate-800">{formatDate(plan.startDate)}</span>
                </div>
              </div>

              {/* Policy Badges */}
              <div className="mt-5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Plan Policy Rules
                </span>
                <div className="flex flex-wrap gap-2">
                  <PolicyBadge label="Closable" enabled={plan.closable} />
                  <PolicyBadge label="Pausable" enabled={plan.pausable} />
                  <PolicyBadge label="Renewable" enabled={plan.renewable} />
                  <PolicyBadge label="Auto-Close" enabled={plan.autoClose} />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Active Recurring Contract
              </span>
              <span className="text-indigo-600 font-semibold hover:underline cursor-pointer">
                View Quotation Templates →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
