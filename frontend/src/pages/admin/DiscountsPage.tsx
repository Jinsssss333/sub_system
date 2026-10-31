import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { rupeesToPaise } from '@brightloop/shared';
import { api, Page } from '../../api/client';
import type { Discount, Product } from '../../api/types';
import { Button, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { applyServerErrors } from '../../lib/forms';
import { bpsToPercent, formatDate, formatINR, todayIso } from '../../lib/format';
import { useList } from '../../lib/useList';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    type: z.enum(['FIXED', 'PERCENT']),
    value: z.string().trim().min(1, 'Value is required'),
    scope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
    minPurchase: z.string().optional(),
    usageLimit: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    productIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'PERCENT' && !(/^\d+(\.\d{1,2})?$/.test(v.value) && Number(v.value) > 0 && Number(v.value) <= 100)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a percentage between 0 and 100' });
    if (v.type === 'FIXED' && !(rupeesToPaise(v.value) && rupeesToPaise(v.value)! > 0)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter an amount like 500 or 499.50' });
    if (v.minPurchase && rupeesToPaise(v.minPurchase) === null) ctx.addIssue({ code: 'custom', path: ['minPurchase'], message: 'Enter an amount like 1000' });
    if (v.usageLimit && !/^[1-9]\d*$/.test(v.usageLimit)) ctx.addIssue({ code: 'custom', path: ['usageLimit'], message: 'Enter a whole number' });
    if (v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date' });
    if (v.scope === 'PRODUCT' && v.productIds.length === 0) ctx.addIssue({ code: 'custom', path: ['productIds'], message: 'Choose at least one product' });
  });
type Values = z.infer<typeof schema>;

function DiscountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const products = useQuery({ queryKey: ['/products', 'all'], queryFn: () => api.get<Page<Product>>('/products', { pageSize: 100 }), enabled: open });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', type: 'PERCENT', value: '', scope: 'SUBSCRIPTION', minPurchase: '', usageLimit: '', startDate: todayIso(), endDate: todayIso(), productIds: [] } });
  const { errors } = form.formState;
  const [type, scope] = useWatch({ control: form.control, name: ['type', 'scope'] });
  const create = useMutation({
    mutationFn: (v: Values) =>
      api.post('/discounts', {
        name: v.name, type: v.type, scope: v.scope, startDate: v.startDate, endDate: v.endDate,
        value: v.type === 'PERCENT' ? Math.round(Number(v.value) * 100) : rupeesToPaise(v.value),
        minPurchase: v.minPurchase ? rupeesToPaise(v.minPurchase) : null,
        usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
        productIds: v.scope === 'PRODUCT' ? v.productIds : [],
      }),
    onSuccess: () => { toast.success('Discount created.'); void qc.invalidateQueries({ queryKey: ['/discounts'] }); form.reset(); onClose(); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <Modal open={open} onClose={onClose} size="lg" title="New discount" description="Product discounts apply first, then subscription-wide discounts. Tax is charged on the discounted amount." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="discount-form" loading={create.isPending}>Create discount</Button></>}>
      <form id="discount-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
        <div className="sm:col-span-2"><FormError error={error} /></div>
        <Field label="Name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2"><Input id="name" invalid={!!errors.name} {...form.register('name')} /></Field>
        <Field label="Applies to" htmlFor="scope"><Select id="scope" {...form.register('scope')}><option value="SUBSCRIPTION">Whole subscription</option><option value="PRODUCT">Specific products</option></Select></Field>
        <Field label="Type" htmlFor="type"><Select id="type" {...form.register('type')}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></Select></Field>
        <Field label={type === 'PERCENT' ? 'Percentage off' : 'Amount off'} htmlFor="value" error={errors.value?.message}><Input id="value" inputMode="decimal" prefix={type === 'PERCENT' ? '%' : '₹'} invalid={!!errors.value} {...form.register('value')} /></Field>
        <Field label="Minimum purchase (optional)" htmlFor="minPurchase" error={errors.minPurchase?.message}><Input id="minPurchase" inputMode="decimal" prefix="₹" {...form.register('minPurchase')} /></Field>
        <Field label="Valid from" htmlFor="startDate" error={errors.startDate?.message}><Input id="startDate" type="date" {...form.register('startDate')} /></Field>
        <Field label="Valid until" htmlFor="endDate" error={errors.endDate?.message}><Input id="endDate" type="date" invalid={!!errors.endDate} {...form.register('endDate')} /></Field>
        <Field label="Usage limit (optional)" htmlFor="usageLimit" error={errors.usageLimit?.message} hint="Each invoice that uses it counts once."><Input id="usageLimit" inputMode="numeric" {...form.register('usageLimit')} /></Field>
        {scope === 'PRODUCT' && (
          <Field label="Products" htmlFor="products" error={errors.productIds?.message} className="sm:col-span-2">
            <div id="products" className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {products.data?.data.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" value={p.id} className="h-4 w-4 rounded border-slate-300 text-primary-600" {...form.register('productIds')} /> {p.name}
                </label>
              ))}
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}

export function DiscountsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const list = useList<Discount>('/discounts');
  const cols = 5;
  const today = todayIso();
  return (
    <>
      <PageHeader title="Discounts" description="Fixed or percentage reductions with validity windows and usage limits." actions={user?.role === 'ADMIN' && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New discount</Button>} />
      <div className="mb-4"><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search discounts" /></div>
      <Table head={<tr><th className="th">Discount</th><th className="th text-right">Value</th><th className="th hidden md:table-cell">Valid</th><th className="th hidden sm:table-cell">Used</th><th className="th">Status</th></tr>} footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}>
        {list.isLoading ? <TableSkeleton columns={cols} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} /></TableMessage> : list.data!.data.length === 0 ? <TableMessage columns={cols}><EmptyState title="No discounts yet" /></TableMessage> : (
          list.data!.data.map((d) => {
            const live = d.startDate.slice(0, 10) <= today && d.endDate.slice(0, 10) >= today && (d.usageLimit === null || d.timesUsed < d.usageLimit);
            return (
              <tr key={d.id}>
                <td className="td whitespace-normal"><p className="font-medium text-slate-900">{d.name}</p><p className="text-xs text-slate-500">{d.scope === 'PRODUCT' ? `Products: ${d.products.map((p) => p.product.name).join(', ')}` : 'Whole subscription'}{d.minPurchase ? ` · min ${formatINR(d.minPurchase)}` : ''}</p></td>
                <td className="td tabular text-right font-medium">{d.type === 'PERCENT' ? bpsToPercent(d.value) : formatINR(d.value)}</td>
                <td className="td hidden md:table-cell">{formatDate(d.startDate)} – {formatDate(d.endDate)}</td>
                <td className="td tabular hidden sm:table-cell">{d.timesUsed}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
                <td className="td"><StatusBadge status={live ? 'ACTIVE' : 'CLOSED'} /></td>
              </tr>
            );
          })
        )}
      </Table>
      <DiscountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
