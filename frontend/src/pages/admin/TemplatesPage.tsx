import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, Page } from '../../api/client';
import type { Plan, Product, Template } from '../../api/types';
import { Button, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, Select, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { applyServerErrors, intField } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { formatINR } from '../../lib/format';
import { useList } from '../../lib/useList';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  planId: z.string().uuid('Choose a plan'),
  validityDays: intField('Validity', 1, 365),
  lines: z.array(z.object({ productId: z.string().uuid('Choose a product'), variantId: z.string().optional(), quantity: intField('Quantity') })).min(1, 'Add at least one line'),
});

function TemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const plans = useQuery({ queryKey: ['/plans', 'all'], queryFn: () => api.get<Page<Plan>>('/plans', { pageSize: 100 }), enabled: open });
  const products = useQuery({ queryKey: ['/products', 'active'], queryFn: () => api.get<Page<Product>>('/products', { active: 'true', pageSize: 100 }), enabled: open });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: typedResolver(schema), defaultValues: { name: '', planId: '', validityDays: 14, lines: [{ productId: '', variantId: '', quantity: 1 }] } });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const { errors } = form.formState;
  const watchedLines = form.watch('lines');
  const create = useMutation({
    mutationFn: (v: z.output<typeof schema>) => api.post('/templates', { ...v, lines: v.lines.map((l) => ({ ...l, variantId: l.variantId || null })) }),
    onSuccess: () => { toast.success('Template created.'); void qc.invalidateQueries({ queryKey: ['/templates'] }); form.reset(); onClose(); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <Modal open={open} onClose={onClose} size="lg" title="New quote template" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="template-form" loading={create.isPending}>Create template</Button></>}>
      <form id="template-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
        <FormError error={error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" htmlFor="name" error={errors.name?.message}><Input id="name" invalid={!!errors.name} {...form.register('name')} /></Field>
          <Field label="Plan" htmlFor="planId" error={errors.planId?.message}><Select id="planId" invalid={!!errors.planId} {...form.register('planId')}><option value="">Select</option>{plans.data?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Valid for (days)" htmlFor="validityDays" error={errors.validityDays?.message}><Input id="validityDays" type="number" min={1} {...form.register('validityDays')} /></Field>
        </div>
        {lines.fields.map((field, i) => {
          const product = products.data?.data.find((p) => p.id === watchedLines?.[i]?.productId);
          return (
            <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
              <Field label="Product" htmlFor={`tp-${i}`} error={errors.lines?.[i]?.productId?.message} className="sm:col-span-5"><Select id={`tp-${i}`} {...form.register(`lines.${i}.productId`)}><option value="">Select</option>{products.data?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Variant" htmlFor={`tv-${i}`} className="sm:col-span-4"><Select id={`tv-${i}`} disabled={!product?.variants?.length} {...form.register(`lines.${i}.variantId`)}><option value="">Base</option>{product?.variants?.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}</Select></Field>
              <Field label="Qty" htmlFor={`tq-${i}`} error={errors.lines?.[i]?.quantity?.message} className="sm:col-span-2"><Input id={`tq-${i}`} type="number" min={1} {...form.register(`lines.${i}.quantity`)} /></Field>
              <div className="flex sm:col-span-1 sm:pt-7"><Button variant="ghost" size="sm" aria-label="Remove line" onClick={() => lines.remove(i)} icon={<Trash2 className="h-4 w-4" />} /></div>
            </div>
          );
        })}
        {errors.lines?.message && <p className="text-xs font-medium text-rose-600">{errors.lines.message}</p>}
        <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => lines.append({ productId: '', variantId: '', quantity: 1 })}>Add line</Button>
      </form>
    </Modal>
  );
}

export function TemplatesPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const list = useList<Template>('/templates');
  const cols = 4;
  return (
    <>
      <PageHeader title="Quote templates" description="Reusable product bundles that pre-fill new subscriptions." actions={user?.role === 'ADMIN' && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New template</Button>} />
      <Table head={<tr><th className="th">Template</th><th className="th hidden sm:table-cell">Plan</th><th className="th hidden md:table-cell">Products</th><th className="th text-right">Per cycle</th></tr>} footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}>
        {list.isLoading ? <TableSkeleton columns={cols} rows={3} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} /></TableMessage> : list.data!.data.length === 0 ? <TableMessage columns={cols}><EmptyState title="No templates yet" /></TableMessage> : (
          list.data!.data.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="td"><p className="font-medium text-slate-900">{t.name}</p><p className="text-xs text-slate-500">Valid {t.validityDays} days</p></td>
              <td className="td hidden sm:table-cell">{t.plan.name}</td>
              <td className="td hidden whitespace-normal md:table-cell">{t.lines.map((l) => `${l.product.name}${l.variant ? ` (${l.variant.value})` : ''} × ${l.quantity}`).join(', ')}</td>
              <td className="td tabular text-right font-medium">{formatINR(t.plan.price + t.lines.reduce((s, l) => s + l.quantity * (l.product.salesPrice + (l.variant?.extraPrice ?? 0)), 0))}</td>
            </tr>
          ))
        )}
      </Table>
      <TemplateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
