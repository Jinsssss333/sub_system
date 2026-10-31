import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CirclePause, CirclePlay, Copy, Send, ShieldCheck, XCircle, Zap } from 'lucide-react';
import { api, One, Page } from '../../api/client';
import type { Invoice, Subscription, SubscriptionStatus } from '../../api/types';
import { Button, Card, cn, ConfirmDialog, DescriptionList, EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { bpsToPercent, formatDate, formatINR, isOverdue, periodLabel } from '../../lib/format';

const STEPS: SubscriptionStatus[] = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];
const DONE_MESSAGE: Record<string, string> = {
  quote: 'Quotation sent to the customer.',
  confirm: 'Order confirmed.',
  activate: 'Subscription activated. The first invoice is created on the next billing run.',
  pause: 'Billing paused.',
  resume: 'Billing resumed.',
  close: 'Subscription closed.',
};

const STEP_LABEL: Record<SubscriptionStatus, string> = { DRAFT: 'Draft', QUOTATION: 'Quotation', CONFIRMED: 'Confirmed', ACTIVE: 'Active', CLOSED: 'Closed' };

function Stepper({ status }: { status: SubscriptionStatus }) {
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Lifecycle">
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium',
              i < current && 'bg-primary-50 text-primary-700',
              i === current && 'bg-primary-600 text-white',
              i > current && 'bg-slate-100 text-slate-500',
            )}
            aria-current={i === current ? 'step' : undefined}
          >
            {i < current && <Check className="h-3.5 w-3.5" aria-hidden />}
            {STEP_LABEL[step]}
          </span>
          {i < STEPS.length - 1 && <span className={cn('h-px w-4 sm:w-8', i < current ? 'bg-primary-300' : 'bg-slate-200')} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

type Action = { key: string; label: string; icon: React.ReactNode; run: () => Promise<unknown>; confirm?: string; tone?: 'primary' | 'danger'; variant?: 'primary' | 'secondary' };

export function SubscriptionDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const base = isCustomer ? '/portal' : '';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Action | null>(null);

  const sub = useQuery({ queryKey: ['subscription', id], queryFn: () => api.get<One<Subscription>>(isCustomer ? `/me/subscriptions/${id}` : `/subscriptions/${id}`) });
  const invoices = useQuery({
    queryKey: ['subscription-invoices', id],
    queryFn: () => api.get<Page<Invoice>>(isCustomer ? '/me/invoices' : '/invoices', { subscriptionId: id, pageSize: 24 }),
  });

  const act = useMutation({
    mutationFn: (action: Action) => action.run(),
    onSuccess: (result, action) => {
      setPending(null);
      void queryClient.invalidateQueries();
      const data = (result as One<Subscription>).data;
      if (action.key === 'renew' && data?.id) {
        toast.success(`Renewal draft ${data.number} created.`);
        if (!isCustomer) navigate(`/subscriptions/${data.id}`);
      } else toast.success(DONE_MESSAGE[action.key] ?? 'Subscription updated.');
    },
    onError: (err) => {
      setPending(null);
      toast.error(err);
    },
  });

  if (sub.isLoading) return <PageLoader />;
  if (sub.isError) return <ErrorState error={sub.error} onRetry={() => sub.refetch()} />;
  const s = sub.data!.data;
  const transition = (to: SubscriptionStatus) => () => api.post<One<Subscription>>(`/subscriptions/${s.id}/transition`, { to });
  const lineTotal = s.lines.reduce((sum, l) => sum + l.amount, 0);

  const actions: Action[] = [];
  if (!isCustomer) {
    if (s.status === 'DRAFT') actions.push({ key: 'quote', label: 'Send as quotation', icon: <Send className="h-4 w-4" />, run: transition('QUOTATION') });
    if (s.status === 'QUOTATION') actions.push({ key: 'confirm', label: 'Confirm order', icon: <ShieldCheck className="h-4 w-4" />, run: transition('CONFIRMED') });
    if (s.status === 'CONFIRMED') actions.push({ key: 'activate', label: 'Activate', icon: <Zap className="h-4 w-4" />, run: transition('ACTIVE'), confirm: `Activate ${s.number}? Billing starts on ${formatDate(s.startDate)}.` });
  }
  if (s.status === 'ACTIVE') {
    if (s.plan.pausable && !s.pausedAt) actions.push({ key: 'pause', label: 'Pause', icon: <CirclePause className="h-4 w-4" />, run: () => api.post(`/subscriptions/${s.id}/pause`), confirm: 'Pause billing? Periods while paused are not billed.', variant: 'secondary' });
    if (s.pausedAt) actions.push({ key: 'resume', label: 'Resume', icon: <CirclePlay className="h-4 w-4" />, run: () => api.post(`/subscriptions/${s.id}/resume`), confirm: 'Resume billing at the next billing date on or after today. Skipped periods are not back-billed.' });
    if (!isCustomer || s.plan.closable) actions.push({ key: 'close', label: 'Close', icon: <XCircle className="h-4 w-4" />, run: transition('CLOSED'), confirm: `Close ${s.number}? No further invoices will be generated.`, tone: 'danger', variant: 'secondary' });
  }
  if ((s.status === 'ACTIVE' || s.status === 'CLOSED') && s.plan.renewable) actions.push({ key: 'renew', label: 'Renew', icon: <Copy className="h-4 w-4" />, run: () => api.post<One<Subscription>>(`/subscriptions/${s.id}/renew`), confirm: 'Create a renewal draft with the same plan and products? The current subscription is not changed.', variant: 'secondary' });

  const trigger = (action: Action) => (action.confirm ? setPending(action) : act.mutate(action));

  return (
    <>
      <PageHeader
        back={
          <Link to={isCustomer ? '/portal' : '/subscriptions'} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> {isCustomer ? 'Overview' : 'Subscriptions'}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.number}
            <StatusBadge status={s.status} />
            {s.pausedAt && <StatusBadge status="PAUSED" />}
          </span>
        }
        description={`${s.customer.companyName ?? s.customer.user.name} · ${s.plan.name} (${periodLabel[s.plan.billingPeriod].toLowerCase()})`}
        actions={actions.map((a) => (
          <Button key={a.key} variant={a.variant ?? 'primary'} icon={a.icon} onClick={() => trigger(a)} loading={act.isPending && act.variables?.key === a.key}>
            {a.label}
          </Button>
        ))}
      />

      <div className="card mb-6 px-5 py-4">
        <Stepper status={s.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Table
            head={
              <tr>
                <th className="th">Item</th>
                <th className="th text-right">Qty</th>
                <th className="th hidden text-right sm:table-cell">Unit price</th>
                <th className="th hidden text-right sm:table-cell">Tax</th>
                <th className="th text-right">Amount</th>
              </tr>
            }
          >
            {s.lines.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-normal">
                  <p className="font-medium text-slate-900">{l.product.name}</p>
                  {l.variant && <p className="text-xs text-slate-500">{l.variant.attribute}: {l.variant.value}</p>}
                </td>
                <td className="td tabular text-right">{l.quantity}</td>
                <td className="td tabular hidden text-right sm:table-cell">{formatINR(l.unitPrice)}</td>
                <td className="td hidden text-right sm:table-cell">{l.tax ? bpsToPercent(l.tax.rateBps) : '—'}</td>
                <td className="td tabular text-right font-medium">{formatINR(l.amount)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/60">
              <td className="td whitespace-normal" colSpan={2}>
                <p className="font-medium text-slate-900">Plan base fee</p>
                <p className="text-xs text-slate-500">{s.plan.name}, untaxed</p>
              </td>
              <td className="td hidden sm:table-cell" />
              <td className="td hidden sm:table-cell" />
              <td className="td tabular text-right font-medium">{formatINR(s.plan.price)}</td>
            </tr>
            <tr>
              <td className="td font-semibold text-slate-900" colSpan={2}>Per cycle, before tax and discounts</td>
              <td className="td hidden sm:table-cell" />
              <td className="td hidden sm:table-cell" />
              <td className="td tabular text-right font-semibold text-slate-900">{formatINR(lineTotal + s.plan.price)}</td>
            </tr>
          </Table>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Invoices</h2>
            <Table
              head={
                <tr>
                  <th className="th">Invoice</th>
                  <th className="th hidden sm:table-cell">Period</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Total</th>
                </tr>
              }
            >
              {invoices.isLoading ? (
                <TableSkeleton columns={4} rows={3} />
              ) : invoices.isError ? (
                <TableMessage columns={4}><ErrorState error={invoices.error} /></TableMessage>
              ) : invoices.data!.data.length === 0 ? (
                <TableMessage columns={4}>
                  <EmptyState title="No invoices yet" description={s.status === 'ACTIVE' ? `The next invoice is generated on ${formatDate(s.nextInvoiceDate)}.` : 'Invoices are generated once the subscription is active.'} />
                </TableMessage>
              ) : (
                invoices.data!.data.map((inv) => (
                  <tr key={inv.id}>
                    <td className="td">
                      <Link to={`${base}/invoices/${inv.id}`} className="link">{inv.number}</Link>
                    </td>
                    <td className="td hidden sm:table-cell">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</td>
                    <td className="td"><StatusBadge status={isOverdue(inv) ? 'OVERDUE' : inv.status} /></td>
                    <td className="td tabular text-right">{formatINR(inv.total)}</td>
                  </tr>
                ))
              )}
            </Table>
          </div>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <DescriptionList
              items={[
                { label: 'Customer', value: <>{s.customer.companyName ?? s.customer.user.name}<br /><span className="text-slate-500">{s.customer.user.email}</span></> },
                { label: 'Start date', value: formatDate(s.startDate) },
                { label: 'End date', value: formatDate(s.expiryDate) },
                { label: 'Next invoice', value: s.status === 'ACTIVE' && !s.pausedAt ? formatDate(s.nextInvoiceDate) : '—' },
                { label: 'Payment terms', value: `${s.paymentTermDays} days` },
                ...(s.quotationExpiryDate && (s.status === 'DRAFT' || s.status === 'QUOTATION') ? [{ label: 'Quote valid until', value: formatDate(s.quotationExpiryDate) }] : []),
                ...(s.pausedAt ? [{ label: 'Paused since', value: formatDate(s.pausedAt) }] : []),
              ]}
            />
          </Card>
          <Card title="Plan policy">
            <ul className="space-y-2 text-sm">
              {[
                ['Can be paused', s.plan.pausable],
                ['Can be renewed', s.plan.renewable],
                ['Customer can close', s.plan.closable],
                ['Closes automatically at end date', s.plan.autoClose],
              ].map(([label, on]) => (
                <li key={label as string} className="flex items-center justify-between">
                  <span className="text-slate-600">{label}</span>
                  <span className={on ? 'font-medium text-emerald-600' : 'text-slate-400'}>{on ? 'Yes' : 'No'}</span>
                </li>
              ))}
            </ul>
          </Card>
          {s.discounts.length > 0 && (
            <Card title="Discounts">
              <ul className="space-y-2 text-sm">
                {s.discounts.map(({ discount: d }) => (
                  <li key={d.id} className="flex justify-between">
                    <span>{d.name}</span>
                    <span className="font-medium">{d.type === 'PERCENT' ? bpsToPercent(d.value) : formatINR(d.value)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(s.renewedFrom || (s.renewals && s.renewals.length > 0)) && !isCustomer && (
            <Card title="Renewal history">
              <ul className="space-y-2 text-sm">
                {s.renewedFrom && (
                  <li>Renewed from <Link className="link" to={`/subscriptions/${s.renewedFrom.id}`}>{s.renewedFrom.number}</Link></li>
                )}
                {s.renewals?.map((r) => (
                  <li key={r.id}>Renewed as <Link className="link" to={`/subscriptions/${r.id}`}>{r.number}</Link> <StatusBadge status={r.status} /></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        title={pending?.label ?? ''}
        message={pending?.confirm}
        confirmLabel={pending?.label ?? 'Confirm'}
        tone={pending?.tone}
        loading={act.isPending}
        onConfirm={() => pending && act.mutate(pending)}
        onClose={() => setPending(null)}
      />
    </>
  );
}
