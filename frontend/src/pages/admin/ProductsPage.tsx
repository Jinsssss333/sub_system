import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
import { api } from '../../api/client';
import type { Product } from '../../api/types';
import { Button, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, SearchInput, StatusBadge, Table, TableMessage, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { useAuth } from '../../lib/auth';
import { applyServerErrors, rupees } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { formatINR } from '../../lib/format';
import { useList } from '../../lib/useList';

const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: z.string().trim().min(1, 'Type is required').max(50),
  salesPrice: rupees('Sales price'),
  costPrice: rupees('Cost price'),
  notes: z.string().max(1000).optional(),
});
const variantSchema = z.object({ attribute: z.string().trim().min(1, 'Attribute is required').max(50), value: z.string().trim().min(1, 'Value is required').max(100), extraPrice: rupees('Extra price') });

function ProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.input<typeof productSchema>, unknown, z.output<typeof productSchema>>({ resolver: typedResolver(productSchema), defaultValues: { name: '', type: 'SERVICE', salesPrice: '', costPrice: '', notes: '' } });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (v: z.output<typeof productSchema>) => api.post('/products', { ...v, notes: v.notes || undefined }),
    onSuccess: () => { toast.success('Product created.'); void qc.invalidateQueries({ queryKey: ['/products'] }); form.reset(); onClose(); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <Modal open={open} onClose={onClose} title="New product" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="product-form" loading={create.isPending}>Create product</Button></>}>
      <form id="product-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
        <div className="sm:col-span-2"><FormError error={error} /></div>
        <Field label="Name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2"><Input id="name" invalid={!!errors.name} {...form.register('name')} /></Field>
        <Field label="Type" htmlFor="type" error={errors.type?.message}><Input id="type" invalid={!!errors.type} {...form.register('type')} /></Field>
        <div className="hidden sm:block" />
        <Field label="Sales price" htmlFor="salesPrice" error={errors.salesPrice?.message} hint="Per unit, before tax"><Input id="salesPrice" inputMode="decimal" prefix="₹" invalid={!!errors.salesPrice} {...form.register('salesPrice')} /></Field>
        <Field label="Cost price" htmlFor="costPrice" error={errors.costPrice?.message}><Input id="costPrice" inputMode="decimal" prefix="₹" invalid={!!errors.costPrice} {...form.register('costPrice')} /></Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" {...form.register('notes')} /></Field>
      </form>
    </Modal>
  );
}

function VariantDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.input<typeof variantSchema>, unknown, z.output<typeof variantSchema>>({ resolver: typedResolver(variantSchema), defaultValues: { attribute: 'Brand', value: '', extraPrice: '0' } });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (v: z.output<typeof variantSchema>) => api.post(`/products/${product!.id}/variants`, v),
    onSuccess: () => { toast.success('Variant added.'); void qc.invalidateQueries({ queryKey: ['/products'] }); form.reset(); onClose(); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <Modal open={!!product} onClose={onClose} title="Add variant" description={product?.name} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="variant-form" loading={create.isPending}>Add variant</Button></>}>
      <form id="variant-form" noValidate className="grid gap-4 sm:grid-cols-3" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
        <div className="sm:col-span-3"><FormError error={error} /></div>
        <Field label="Attribute" htmlFor="attribute" error={errors.attribute?.message}><Input id="attribute" invalid={!!errors.attribute} {...form.register('attribute')} /></Field>
        <Field label="Value" htmlFor="value" error={errors.value?.message}><Input id="value" placeholder="Odoo Edition" invalid={!!errors.value} {...form.register('value')} /></Field>
        <Field label="Extra price" htmlFor="extraPrice" error={errors.extraPrice?.message}><Input id="extraPrice" inputMode="decimal" prefix="₹" invalid={!!errors.extraPrice} {...form.register('extraPrice')} /></Field>
      </form>
    </Modal>
  );
}

export function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const toast = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [variantFor, setVariantFor] = useState<Product | null>(null);
  const list = useList<Product>('/products');
  const toggle = useMutation({
    mutationFn: (p: Product) => api.patch(`/products/${p.id}`, { active: !p.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['/products'] }),
    onError: toast.error,
  });
  const cols = isAdmin ? 6 : 5;
  return (
    <>
      <PageHeader title="Products" description="Sellable items and their variants. Prices are per unit in rupees." actions={isAdmin && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New product</Button>} />
      <div className="mb-4"><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search products" /></div>
      <Table
        head={<tr><th className="th">Product</th><th className="th hidden md:table-cell">Variants</th><th className="th text-right">Price</th><th className="th hidden text-right sm:table-cell">Cost</th><th className="th">Status</th>{isAdmin && <th className="th text-right">Actions</th>}</tr>}
        footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}
      >
        {list.isLoading ? <TableSkeleton columns={cols} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage> : list.data!.data.length === 0 ? (
          <TableMessage columns={cols}><EmptyState title="No products yet" /></TableMessage>
        ) : (
          list.data!.data.map((p) => (
            <tr key={p.id}>
              <td className="td"><p className="font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.type}</p></td>
              <td className="td hidden whitespace-normal md:table-cell">
                <div className="flex flex-wrap gap-1.5">
                  {(p.variants ?? []).length === 0 ? <span className="text-slate-400">—</span> : p.variants!.map((v) => (
                    <span key={v.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{v.value}{v.extraPrice ? <span className="text-primary-700"> +{formatINR(v.extraPrice)}</span> : ''}</span>
                  ))}
                </div>
              </td>
              <td className="td tabular text-right font-medium">{formatINR(p.salesPrice)}</td>
              <td className="td tabular hidden text-right text-slate-500 sm:table-cell">{formatINR(p.costPrice)}</td>
              <td className="td"><StatusBadge status={p.active ? 'ACTIVE' : 'CLOSED'} /></td>
              {isAdmin && (
                <td className="td text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={<Layers className="h-4 w-4" />} onClick={() => setVariantFor(p)}>Variant</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle.mutate(p)} loading={toggle.isPending && toggle.variables?.id === p.id}>{p.active ? 'Deactivate' : 'Activate'}</Button>
                  </div>
                </td>
              )}
            </tr>
          ))
        )}
      </Table>
      <ProductDialog open={creating} onClose={() => setCreating(false)} />
      <VariantDialog product={variantFor} onClose={() => setVariantFor(null)} />
    </>
  );
}
