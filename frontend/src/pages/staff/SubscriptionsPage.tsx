import { useState } from 'react';
import { 
  Search, 
  Send, 
  CheckCircle, 
  Play, 
  Pause, 
  RefreshCw, 
  XCircle 
} from 'lucide-react';
import { Subscription, initialSubscriptions } from '../../api/mockData';
import { SubscriptionStatusBadge } from '../../components/Badge';
import { formatINR, formatDate } from '../../utils/formatters';

interface SubscriptionsPageProps {
  subscriptions?: Subscription[];
}

export function SubscriptionsPage({ subscriptions: propSubs = initialSubscriptions }: SubscriptionsPageProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(propSubs);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(propSubs[0] || null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = subscriptions.filter((sub) => {
    const matchesFilter = statusFilter === 'ALL' || sub.status === statusFilter;
    const matchesSearch =
      sub.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.planName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // State Transition Actions
  const handleTransition = (newStatus: Subscription['status'], extraUpdate?: Partial<Subscription>) => {
    if (!selectedSub) return;
    const updated: Subscription = {
      ...selectedSub,
      status: newStatus,
      ...extraUpdate,
    };

    setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedSub(updated);
  };

  const handlePause = () => {
    if (!selectedSub) return;
    const isPaused = Boolean(selectedSub.pausedAt);
    if (isPaused) {
      // Resume
      handleTransition('ACTIVE', { pausedAt: undefined });
    } else {
      // Pause
      handleTransition('ACTIVE', { pausedAt: new Date().toISOString() });
    }
  };

  const handleRenew = () => {
    if (!selectedSub) return;
    const clonedSub: Subscription = {
      ...selectedSub,
      id: `sub-${Date.now()}`,
      number: `SUB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'DRAFT',
      startDate: new Date().toISOString().split('T')[0],
      pausedAt: undefined,
    };
    setSubscriptions((prev) => [clonedSub, ...prev]);
    setSelectedSub(clonedSub);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscription Lifecycle</h1>
            <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
              Staff Operations
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Section 136-143: Quotation negotiation, approval state machine, pause skipping, and contract renewal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newDraft: Subscription = {
                id: `sub-${Date.now()}`,
                number: `SUB-2026-0${subscriptions.length + 101}`,
                customerId: 'cust-1',
                customerName: 'Acme Retail Pvt Ltd',
                customerEmail: 'customer@brightloop.test',
                planId: 'plan-1',
                planName: 'Standard Monthly Plan',
                status: 'DRAFT',
                startDate: new Date().toISOString().split('T')[0],
                paymentTermDays: 14,
                lines: [
                  {
                    id: `line-${Date.now()}`,
                    productId: 'prod-1',
                    productName: 'Brightloop Business Suite',
                    quantity: 1,
                    unitPrice: 200000,
                    taxRateBps: 1800,
                    amount: 200000,
                  },
                ],
              };
              setSubscriptions((prev) => [newDraft, ...prev]);
              setSelectedSub(newDraft);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            + Create New Subscription
          </button>
        </div>
      </div>

      {/* Main Grid: Left List + Right Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Subscriptions Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, customer, or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'].map((st) => (
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

          {/* List Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filtered.map((sub) => {
                const isSelected = selectedSub?.id === sub.id;
                const totalLinesPaise = sub.lines.reduce((acc, l) => acc + l.amount, 0);

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSub(sub)}
                    className={`p-4 transition cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-indigo-50/50 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50/75'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{sub.number}</span>
                        <SubscriptionStatusBadge status={sub.status} size="sm" />
                        {sub.pausedAt && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            PAUSED
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-800">{sub.customerName}</p>
                      <p className="text-[11px] text-slate-500">{sub.planName}</p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatINR(totalLinesPaise)}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Start: {formatDate(sub.startDate)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  No subscriptions match the selected criteria.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Subscription Detail & Actions (5 cols) */}
        <div className="lg:col-span-5">
          {selectedSub ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 sticky top-6">
              
              {/* Detail Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-extrabold text-slate-900">
                      {selectedSub.number}
                    </span>
                    <SubscriptionStatusBadge status={selectedSub.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Customer: {selectedSub.customerName}</p>
                </div>
              </div>

              {/* Contextual Transition Action Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                  Allowed State Transitions
                </span>

                <div className="flex flex-wrap gap-2">
                  {selectedSub.status === 'DRAFT' && (
                    <button
                      onClick={() => handleTransition('QUOTATION', { quotationExpiryDate: '2026-11-20' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Quote
                    </button>
                  )}

                  {selectedSub.status === 'QUOTATION' && (
                    <button
                      onClick={() => handleTransition('CONFIRMED')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve & Confirm
                    </button>
                  )}

                  {selectedSub.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleTransition('ACTIVE')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      <Play className="w-3.5 h-3.5" /> Activate Subscription
                    </button>
                  )}

                  {selectedSub.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={handlePause}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          selectedSub.pausedAt
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-amber-600 text-white hover:bg-amber-500'
                        }`}
                      >
                        {selectedSub.pausedAt ? (
                          <>
                            <Play className="w-3.5 h-3.5" /> Resume
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleRenew}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Clone & Renew
                      </button>

                      <button
                        onClick={() => handleTransition('CLOSED')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Close Early
                      </button>
                    </>
                  )}

                  {selectedSub.status === 'CLOSED' && (
                    <span className="text-xs text-slate-400 italic">
                      Contract is closed. Use "Clone & Renew" to initiate a fresh quotation.
                    </span>
                  )}
                </div>
              </div>

              {/* Line Items Breakdown */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-3">
                  Configured Subscription Lines
                </span>
                <div className="space-y-2">
                  {selectedSub.lines.map((line) => (
                    <div
                      key={line.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{line.productName}</p>
                        {line.variantName && (
                          <span className="inline-block mt-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {line.variantName}
                          </span>
                        )}
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Qty: {line.quantity} × {formatINR(line.unitPrice)}
                        </p>
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatINR(line.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata details */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Payment Terms</span>
                  <span className="font-semibold text-slate-700">{selectedSub.paymentTermDays} days</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Next Billing Date</span>
                  <span className="font-semibold text-slate-700">{formatDate(selectedSub.nextInvoiceDate)}</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
              Select a subscription to inspect details.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
