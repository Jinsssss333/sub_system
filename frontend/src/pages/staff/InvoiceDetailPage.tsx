import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, IndianRupee, Mail, Printer } from 'lucide-react';
import { PAYMENT_METHODS } from '@brightloop/shared';
import { api, One } from '../../api/client';
import type { Invoice } from '../../api/types';
import { Button, Card, ConfirmDialog, DescriptionList, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, PageLoader, Select, StatusBadge, Table, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { applyServerErrors, rupees } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { bpsToPercent, formatDate, formatINR, isOverdue, paiseToRupeeInput, todayIso, methodLabel } from '../../lib/format';

function PaymentDialog({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const balance = invoice.total - invoice.amountPaid;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({
    amount: rupees('Amount', { allowZero: false }).refine((paise) => paise <= balance, `Amount cannot exceed the balance of ${formatINR(balance)}`),
    method: z.enum(PAYMENT_METHODS),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date').refine((d) => d <= todayIso(), 'Payment date cannot be in the future'),
    note: z.string().max(1000).optional(),
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: typedResolver(schema),
    values: { amount: paiseToRupeeInput(balance), method: 'UPI', paidOn: todayIso(), note: '' },
  });
  const { errors } = form.formState;
  const pay = useMutation({
    mutationFn: (values: z.output<typeof schema>) => api.post(`/invoices/${invoice.id}/payments`, { ...values, note: values.note || undefined }),
    onSuccess: (_res, values) => {
      toast.success(values.amount === balance ? `${invoice.number} is now fully paid.` : `Recorded ${formatINR(values.amount)} against ${invoice.number}.`);
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) => {
      if (!applyServerErrors(err, form.setError)) setError(err);
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`${invoice.number} · balance ${formatINR(balance)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="payment-form" loading={pay.isPending}>Record payment</Button>
        </>
      }
    >
      <form id="payment-form" className="space-y-4" noValidate onSubmit={form.handleSubmit((v) => { setError(null); pay.mutate(v); })}>
        <FormError error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="amount" error={errors.amount?.message}>
            <Input id="amount" inputMode="decimal" prefix="₹" invalid={!!errors.amount} {...form.register('amount')} />
          </Field>
          <Field label="Method" htmlFor="method">
            <Select id="method" {...form.register('method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
            </Select>
          </Field>
          <Field label="Payment date" htmlFor="paidOn" error={errors.paidOn?.message}>
            <Input id="paidOn" type="date" max={todayIso()} invalid={!!errors.paidOn} {...form.register('paidOn')} />
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="note" error={errors.note?.message}>
          <Textarea id="note" placeholder="UPI reference, cheque number…" {...form.register('note')} />
        </Field>
      </form>
    </Modal>
  );
}

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const toast = useToast();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const invoice = useQuery({ queryKey: ['invoice', id], queryFn: () => api.get<One<Invoice>>(`/invoices/${id}`) });

  const action = useMutation({
    mutationFn: (kind: 'confirm' | 'cancel' | 'send') => api.post<One<Invoice>>(`/invoices/${id}/${kind}`),
    onSuccess: (_r, kind) => {
      setConfirmCancel(false);
      void queryClient.invalidateQueries();
      toast.success(kind === 'confirm' ? 'Invoice confirmed.' : kind === 'cancel' ? 'Invoice cancelled.' : 'Invoice emailed to the customer (see Mailpit).');
    },
    onError: (err) => {
      setConfirmCancel(false);
      toast.error(err);
    },
  });
  const print = useMutation({ mutationFn: () => api.openInvoicePrint(id), onError: toast.error });

  if (invoice.isLoading) return <PageLoader />;
  if (invoice.isError) return <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />;
  const inv = invoice.data!.data;
  const balance = inv.total - inv.amountPaid;
  const overdue = isOverdue(inv);
  const subLink = isCustomer ? `/portal/subscriptions/${inv.subscriptionId}` : `/subscriptions/${inv.subscriptionId}`;

  return (
    <>
      <PageHeader
        back={
          <Link to={isCustomer ? '/portal/invoices' : '/invoices'} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> {isCustomer ? 'My invoices' : 'Invoices'}
          </Link>
        }
        title={<span className="flex flex-wrap items-center gap-3">{inv.number}<StatusBadge status={overdue ? 'OVERDUE' : inv.status} /></span>}
        description={<>For {inv.customer?.companyName ?? inv.customerName} · Subscription <Link to={subLink} className="link">{inv.subscription?.number}</Link></>}
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => print.mutate()} loading={print.isPending}>Print</Button>
            {!isCustomer && inv.status === 'DRAFT' && (
              <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => action.mutate('confirm')} loading={action.isPending && action.variables === 'confirm'}>Confirm</Button>
            )}
            {!isCustomer && inv.status === 'CONFIRMED' && (
              <>
                <Button variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={() => action.mutate('send')} loading={action.isPending && action.variables === 'send'}>Email</Button>
                <Button icon={<IndianRupee className="h-4 w-4" />} onClick={() => setPaying(true)}>Record payment</Button>
              </>
            )}
            {!isCustomer && (inv.status === 'DRAFT' || inv.status === 'CONFIRMED') && inv.amountPaid === 0 && (
              <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setConfirmCancel(true)}>Cancel</Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Table
            head={
              <tr>
                <th className="th">Description</th>
                <th className="th text-right">Qty</th>
                <th className="th hidden text-right md:table-cell">Unit</th>
                <th className="th hidden text-right md:table-cell">Discount</th>
                <th className="th hidden text-right sm:table-cell">Tax</th>
                <th className="th text-right">Amount</th>
              </tr>
            }
          >
            {(inv.lines ?? []).map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-normal font-medium text-slate-900">{l.description}</td>
                <td className="td tabular text-right">{l.quantity}</td>
                <td className="td tabular hidden text-right md:table-cell">{formatINR(l.unitPrice)}</td>
                <td className="td tabular hidden text-right md:table-cell">{l.discountAmount ? `−${formatINR(l.discountAmount)}` : '—'}</td>
                <td className="td tabular hidden text-right sm:table-cell">{l.taxRateBps ? <>{formatINR(l.taxAmount)} <span className="text-xs text-slate-400">({bpsToPercent(l.taxRateBps)})</span></> : '—'}</td>
                <td className="td tabular text-right font-medium">{formatINR(l.amount)}</td>
              </tr>
            ))}
          </Table>

          <Card title="Payments">
            {(inv.payments ?? []).length === 0 ? (
              <EmptyState title="No payments recorded" description={inv.status === 'CONFIRMED' ? 'Record a payment when the customer pays.' : undefined} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {inv.payments!.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{methodLabel(p.method)}</p>
                      <p className="text-xs text-slate-500">{formatDate(p.paidOn)}{p.note ? ` · ${p.note}` : ''}</p>
                    </div>
                    <span className="tabular font-medium text-emerald-700">{formatINR(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Summary">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular">{formatINR(inv.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular">{inv.discountTotal ? `−${formatINR(inv.discountTotal)}` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular">{formatINR(inv.taxTotal)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2.5 font-semibold"><dt>Total</dt><dd className="tabular">{formatINR(inv.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd className="tabular text-emerald-700">{formatINR(inv.amountPaid)}</dd></div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-base font-semibold"><dt>Balance due</dt><dd className={`tabular ${overdue ? 'text-rose-600' : ''}`}>{formatINR(balance)}</dd></div>
            </dl>
          </Card>
          <Card title="Details">
            <DescriptionList
              items={[
                { label: 'Billing period', value: `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` },
                { label: 'Issued', value: formatDate(inv.issueDate) },
                { label: 'Due', value: <span className={overdue ? 'font-medium text-rose-600' : ''}>{formatDate(inv.dueDate)}</span> },
                { label: 'Plan', value: inv.subscription?.plan?.name ?? '—' },
              ]}
            />
          </Card>
        </div>
      </div>

      {inv.status === 'CONFIRMED' && <PaymentDialog invoice={inv} open={paying} onClose={() => setPaying(false)} />}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel invoice"
        message={`Cancel ${inv.number}? The billing period stays recorded, so it will not be invoiced again.`}
        confirmLabel="Cancel invoice"
        tone="danger"
        loading={action.isPending}
        onConfirm={() => action.mutate('cancel')}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  );
}
