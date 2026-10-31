import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Receipt, Wallet } from 'lucide-react';
import { api, Page } from '../../api/client';
import type { Invoice, Subscription } from '../../api/types';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { formatDate, formatINR, isOverdue, periodLabel } from '../../lib/format';

export function CustomerPortal() {
  const { user } = useAuth();
  const subs = useQuery({ queryKey: ['/me/subscriptions'], queryFn: () => api.get<Page<Subscription>>('/me/subscriptions', { pageSize: 50 }) });
  const open = useQuery({ queryKey: ['/me/invoices', 'open'], queryFn: () => api.get<Page<Invoice>>('/me/invoices', { status: 'CONFIRMED', pageSize: 50 }) });

  if (subs.isLoading) return <PageLoader />;
  if (subs.isError) return <ErrorState error={subs.error} onRetry={() => subs.refetch()} />;
  const list = subs.data!.data;
  const active = list.filter((s) => s.status === 'ACTIVE');
  const due = (open.data?.data ?? []).reduce((sum, inv) => sum + inv.total - inv.amountPaid, 0);
  const nextDates = active.filter((s) => !s.pausedAt && s.nextInvoiceDate).map((s) => s.nextInvoiceDate!).sort();

  return (
    <>
      <PageHeader title={`Hello, ${user?.name.split(' ')[0]}`} description={`${user?.customer?.companyName ?? ''} — your subscriptions and billing at a glance.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active subscriptions" value={active.length} icon={<Receipt className="h-5 w-5" />} />
        <StatCard label="Balance due" value={formatINR(due)} hint={`${open.data?.meta.total ?? 0} open invoices`} icon={<Wallet className="h-5 w-5" />} tone={due > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Next invoice" value={nextDates[0] ? formatDate(nextDates[0]) : '—'} icon={<CalendarClock className="h-5 w-5" />} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Your subscriptions</h2>
      {list.length === 0 ? (
        <div className="card p-10"><EmptyState title="No subscriptions yet" description="When our team sends you a quotation it will appear here." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((s) => (
            <Link key={s.id} to={`/portal/subscriptions/${s.id}`} className="card group p-5 transition hover:border-primary-300 hover:shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{s.number}</p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-900">{s.plan.name}</p>
                  <p className="text-sm text-slate-500">{periodLabel[s.plan.billingPeriod]} billing</p>
                </div>
                <div className="flex shrink-0 gap-1.5"><StatusBadge status={s.status} />{s.pausedAt && <StatusBadge status="PAUSED" />}</div>
              </div>
              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                {s.lines.slice(0, 3).map((l) => <li key={l.id} className="truncate">{l.product.name}{l.variant ? ` · ${l.variant.value}` : ''} × {l.quantity}</li>)}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                <span className="text-slate-500">{s.status === 'ACTIVE' && !s.pausedAt ? `Next invoice ${formatDate(s.nextInvoiceDate)}` : s.status === 'ACTIVE' ? 'Billing paused' : `Started ${formatDate(s.startDate)}`}</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary-700">Manage <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Invoices to pay</h2>
        <Link to="/portal/invoices" className="link text-sm">All invoices</Link>
      </div>
      <Table head={<tr><th className="th">Invoice</th><th className="th hidden sm:table-cell">Due</th><th className="th">Status</th><th className="th text-right">Balance</th></tr>}>
        {open.isLoading ? <TableSkeleton columns={4} rows={3} /> : open.isError ? <TableMessage columns={4}><ErrorState error={open.error} /></TableMessage> : open.data!.data.length === 0 ? (
          <TableMessage columns={4}><EmptyState title="You're all paid up" description="No open invoices right now." /></TableMessage>
        ) : (
          open.data!.data.map((inv) => (
            <tr key={inv.id}>
              <td className="td"><Link to={`/portal/invoices/${inv.id}`} className="link">{inv.number}</Link></td>
              <td className="td hidden sm:table-cell">{formatDate(inv.dueDate)}</td>
              <td className="td"><StatusBadge status={isOverdue(inv) ? 'OVERDUE' : inv.status} /></td>
              <td className="td tabular text-right font-medium">{formatINR(inv.total - inv.amountPaid)}</td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
