import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CircleDollarSign, Clock, PlayCircle, Repeat } from 'lucide-react';
import { api, One, Page } from '../../api/client';
import type { BillingRun, Invoice, Summary } from '../../api/types';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, StatCard, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { compactINR, formatDate, formatINR } from '../../lib/format';

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });

function RevenueChart({ data }: { data: Summary['monthlyRevenue'] }) {
  const max = Math.max(1, ...data.map((d) => d.collected));
  if (data.length === 0) return <EmptyState title="No payments yet" description="Collected revenue appears here once payments are recorded." />;
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3" role="img" aria-label="Collected revenue by month">
      {data.map((d) => (
        <div key={d.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="tabular text-[11px] font-medium text-slate-500">{compactINR(d.collected)}</span>
          <div className="w-full rounded-t-md bg-primary-500/90 transition-all hover:bg-primary-600" style={{ height: `${Math.max(4, (d.collected / max) * 140)}px` }} title={`${d.month}: ${formatINR(d.collected)}`} />
          <span className="text-xs text-slate-500">{monthLabel(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_ORDER = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'] as const;

export function FinanceDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ['/reports/summary'], queryFn: () => api.get<One<Summary>>('/reports/summary'), refetchInterval: 30_000 });
  const overdue = useQuery({ queryKey: ['/reports/overdue', 1], queryFn: () => api.get<Page<Invoice>>('/reports/overdue', { page: 1, pageSize: 8 }) });

  const runBilling = useMutation({
    mutationFn: () => api.post<One<BillingRun>>('/admin/run-billing'),
    onSuccess: ({ data }) => {
      toast.success(
        data.alreadyRunning
          ? 'A billing run was already in progress; showing its result.'
          : `Billing run finished: ${data.generated} invoice${data.generated === 1 ? '' : 's'} generated${data.failures.length ? `, ${data.failures.length} failed` : ''} in ${data.durationMs} ms.`,
      );
      void queryClient.invalidateQueries();
    },
    onError: toast.error,
  });

  if (summary.isLoading) return <PageLoader />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;
  const s = summary.data!.data;
  const totalSubs = STATUS_ORDER.reduce((sum, key) => sum + (s.subscriptionsByStatus[key] ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live revenue, receivables and subscription health from the billing database."
        actions={
          user?.role === 'ADMIN' && (
            <Button onClick={() => runBilling.mutate()} loading={runBilling.isPending} icon={<PlayCircle className="h-4 w-4" />}>
              Run billing now
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active subscriptions" value={s.activeSubscriptions.toLocaleString('en-IN')} hint={`${s.pausedSubscriptions} paused`} icon={<Repeat className="h-5 w-5" />} />
        <StatCard label="Revenue collected" value={formatINR(s.revenueCollected)} hint="All recorded payments" icon={<CircleDollarSign className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Outstanding" value={formatINR(s.outstanding)} hint="Confirmed invoices, unpaid balance" icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard label="Overdue" value={formatINR(s.overdueAmount)} hint={`${s.overdueCount.toLocaleString('en-IN')} invoices past due`} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Collected revenue, last 6 months" className="min-w-0 lg:col-span-2">
          <RevenueChart data={s.monthlyRevenue} />
        </Card>
        <Card title="Subscriptions by status">
          <ul className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = s.subscriptionsByStatus[status] ?? 0;
              return (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="tabular font-medium text-slate-700">{count.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${totalSubs ? (count / totalSubs) * 100 : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Overdue invoices</h2>
          <Link to="/invoices?status=CONFIRMED" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            View all invoices
          </Link>
        </div>
        <Table
          head={
            <tr>
              <th className="th">Invoice</th>
              <th className="th">Customer</th>
              <th className="th hidden sm:table-cell">Due</th>
              <th className="th text-right">Balance</th>
            </tr>
          }
        >
          {overdue.isLoading ? (
            <TableSkeleton columns={4} rows={4} />
          ) : overdue.isError ? (
            <TableMessage columns={4}><ErrorState error={overdue.error} onRetry={() => overdue.refetch()} /></TableMessage>
          ) : overdue.data!.data.length === 0 ? (
            <TableMessage columns={4}><EmptyState title="Nothing overdue" description="Every confirmed invoice is within its payment terms." /></TableMessage>
          ) : (
            overdue.data!.data.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="td">
                  <Link to={`/invoices/${inv.id}`} className="font-medium text-primary-700 hover:underline">{inv.number}</Link>
                </td>
                <td className="td max-w-[12rem] truncate">{inv.customer?.companyName ?? inv.customerName}</td>
                <td className="td hidden text-rose-600 sm:table-cell">{formatDate(inv.dueDate)}</td>
                <td className="td tabular text-right font-medium">{formatINR(inv.total - inv.amountPaid)}</td>
              </tr>
            ))
          )}
        </Table>
      </div>
    </>
  );
}
