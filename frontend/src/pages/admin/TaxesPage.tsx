import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import type { Tax } from '../../api/types';
import { Button, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { applyServerErrors, percent } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { bpsToPercent } from '../../lib/format';
import { useList } from '../../lib/useList';

const schema = z.object({ name: z.string().trim().min(1, 'Name is required').max(100), rateBps: percent('Rate') });

export function TaxesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const list = useList<Tax>('/taxes', {}, 50);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: typedResolver(schema), defaultValues: { name: '', rateBps: '' } });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (v: z.output<typeof schema>) => api.post('/taxes', v),
    onSuccess: () => { toast.success('Tax rate created.'); void qc.invalidateQueries({ queryKey: ['/taxes'] }); form.reset(); setOpen(false); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <>
      <PageHeader title="Taxes" description="Rates are stored as basis points (18% = 1800) and applied to the discounted line amount." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New tax</Button>} />
      <Table head={<tr><th className="th">Name</th><th className="th text-right">Rate</th><th className="th">Status</th></tr>} footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}>
        {list.isLoading ? <TableSkeleton columns={3} rows={3} /> : list.isError ? <TableMessage columns={3}><ErrorState error={list.error} /></TableMessage> : list.data!.data.length === 0 ? <TableMessage columns={3}><EmptyState title="No tax rates yet" /></TableMessage> : (
          list.data!.data.map((t) => (
            <tr key={t.id}><td className="td font-medium text-slate-900">{t.name}</td><td className="td tabular text-right">{bpsToPercent(t.rateBps)} <span className="text-xs text-slate-400">({t.rateBps} bps)</span></td><td className="td"><StatusBadge status={t.active ? 'ACTIVE' : 'CLOSED'} /></td></tr>
          ))
        )}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title="New tax rate" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="tax-form" loading={create.isPending}>Create</Button></>}>
        <form id="tax-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
          <div className="sm:col-span-2"><FormError error={error} /></div>
          <Field label="Name" htmlFor="name" error={errors.name?.message}><Input id="name" placeholder="GST 18%" invalid={!!errors.name} {...form.register('name')} /></Field>
          <Field label="Rate (%)" htmlFor="rate" error={errors.rateBps?.message}><Input id="rate" inputMode="decimal" placeholder="18" invalid={!!errors.rateBps} {...form.register('rateBps')} /></Field>
        </form>
      </Modal>
    </>
  );
}
