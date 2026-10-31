import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { BILLING_PERIODS } from '@brightloop/shared';
import { api } from '../../api/client';
import type { Plan } from '../../api/types';
import { Button, Checkbox, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, SearchInput, Select, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { applyServerErrors, intField, rupees } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { formatDate, formatINR, periodLabel, todayIso } from '../../lib/format';
import { useList } from '../../lib/useList';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    price: rupees('Plan price'),
    billingPeriod: z.enum(BILLING_PERIODS),
    minQuantity: intField('Minimum quantity'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
    endDate: z.string().optional(),
    pausable: z.boolean(),
    renewable: z.boolean(),
    closable: z.boolean(),
    autoClose: z.boolean(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] });

function PlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: typedResolver(schema),
    defaultValues: { name: '', price: '', billingPeriod: 'MONTHLY', minQuantity: 1, startDate: todayIso(), endDate: '', pausable: true, renewable: true, closable: true, autoClose: false },
  });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (v: z.output<typeof schema>) => api.post('/plans', { ...v, endDate: v.endDate || null }),
    onSuccess: () => { toast.success('Plan created.'); void qc.invalidateQueries({ queryKey: ['/plans'] }); form.reset(); onClose(); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <Modal open={open} onClose={onClose} size="lg" title="New plan" description="The plan price is billed every cycle as an untaxed base-fee line." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="plan-form" loading={create.isPending}>Create plan</Button></>}>
      <form id="plan-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
        <div className="sm:col-span-2"><FormError error={error} /></div>
        <Field label="Name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2"><Input id="name" invalid={!!errors.name} {...form.register('name')} /></Field>
        <Field label="Price per cycle" htmlFor="price" error={errors.price?.message}><Input id="price" inputMode="decimal" prefix="₹" invalid={!!errors.price} {...form.register('price')} /></Field>
        <Field label="Billing period" htmlFor="billingPeriod"><Select id="billingPeriod" {...form.register('billingPeriod')}>{BILLING_PERIODS.map((p) => <option key={p} value={p}>{periodLabel[p]}</option>)}</Select></Field>
        <Field label="Minimum quantity per line" htmlFor="minQuantity" error={errors.minQuantity?.message}><Input id="minQuantity" type="number" min={1} invalid={!!errors.minQuantity} {...form.register('minQuantity')} /></Field>
        <div className="hidden sm:block" />
        <Field label="Available from" htmlFor="startDate" error={errors.startDate?.message}><Input id="startDate" type="date" invalid={!!errors.startDate} {...form.register('startDate')} /></Field>
        <Field label="Available until (optional)" htmlFor="endDate" error={errors.endDate?.message}><Input id="endDate" type="date" invalid={!!errors.endDate} {...form.register('endDate')} /></Field>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
          <Checkbox label="Pausable" description="Customers and staff can pause billing" {...form.register('pausable')} />
          <Checkbox label="Renewable" description="Can be renewed into a new draft" {...form.register('renewable')} />
          <Checkbox label="Customer can close" description="Customers may end it from the portal" {...form.register('closable')} />
          <Checkbox label="Auto-close" description="Close automatically at the end date" {...form.register('autoClose')} />
        </div>
      </form>
    </Modal>
  );
}

const Flag = ({ on, label }: { on: boolean; label: string }) => <span className={`rounded-md px-2 py-0.5 text-xs ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400 line-through'}`}>{label}</span>;

export function PlansPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const list = useList<Plan>('/plans');
  const cols = 5;
  return (
    <>
      <PageHeader title="Plans" description="Billing frequency, base fee and lifecycle policy." actions={user?.role === 'ADMIN' && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New plan</Button>} />
      <div className="mb-4"><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search plans" /></div>
      <Table
        head={<tr><th className="th">Plan</th><th className="th text-right">Price</th><th className="th hidden sm:table-cell">Min qty</th><th className="th hidden lg:table-cell">Availability</th><th className="th hidden md:table-cell">Policy</th></tr>}
        footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}
      >
        {list.isLoading ? <TableSkeleton columns={cols} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage> : list.data!.data.length === 0 ? <TableMessage columns={cols}><EmptyState title="No plans yet" /></TableMessage> : (
          list.data!.data.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="td"><p className="font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{periodLabel[p.billingPeriod]}</p></td>
              <td className="td tabular text-right font-medium">{formatINR(p.price)}</td>
              <td className="td hidden sm:table-cell">{p.minQuantity}</td>
              <td className="td hidden lg:table-cell">{formatDate(p.startDate)} – {p.endDate ? formatDate(p.endDate) : 'open'}</td>
              <td className="td hidden md:table-cell"><div className="flex flex-wrap gap-1"><Flag on={p.pausable} label="Pause" /><Flag on={p.renewable} label="Renew" /><Flag on={p.closable} label="Close" /><Flag on={p.autoClose} label="Auto-close" /></div></td>
            </tr>
          ))
        )}
      </Table>
      <PlanDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
