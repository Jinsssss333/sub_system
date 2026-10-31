import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { customerBody } from '@brightloop/shared';
import { api } from '../../api/client';
import type { Customer } from '../../api/types';
import { Button, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, SearchInput, Table, TableMessage, TableSkeleton, Textarea } from '../../components/ui';
import { useToast } from '../../components/toast';
import { applyServerErrors } from '../../lib/forms';
import { typedResolver } from '../../lib/forms';
import { useList } from '../../lib/useList';

const schema = customerBody.omit({ password: true });

function NewCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const form = useForm<z.input<typeof schema>>({ resolver: typedResolver(schema), defaultValues: { name: '', email: '', companyName: '', phone: '', address: '' } });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (values: z.output<typeof schema>) => api.post('/customers', values),
    onSuccess: () => {
      toast.success('Customer created. They were emailed a link to set their password.');
      void queryClient.invalidateQueries({ queryKey: ['/customers'] });
      form.reset();
      onClose();
    },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  return (
    <Modal open={open} onClose={onClose} title="New customer" description="Creates a customer login. No shared default password is set." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="customer-form" loading={create.isPending}>Create customer</Button></>}>
      <form id="customer-form" className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v as z.output<typeof schema>); })}>
        <div className="sm:col-span-2"><FormError error={error} /></div>
        <Field label="Company" htmlFor="companyName" error={errors.companyName?.message}><Input id="companyName" {...form.register('companyName')} /></Field>
        <Field label="Contact name" htmlFor="name" error={errors.name?.message}><Input id="name" invalid={!!errors.name} {...form.register('name')} /></Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}><Input id="email" type="email" invalid={!!errors.email} {...form.register('email')} /></Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}><Input id="phone" type="tel" {...form.register('phone')} /></Field>
        <Field label="Billing address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2"><Textarea id="address" {...form.register('address')} /></Field>
      </form>
    </Modal>
  );
}

export function CustomersPage() {
  const [open, setOpen] = useState(false);
  const list = useList<Customer>('/customers');
  const cols = 4;
  return (
    <>
      <PageHeader title="Customers" description="Companies and contacts you bill." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New customer</Button>} />
      <div className="mb-4"><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search company, name, email or phone" /></div>
      <Table
        head={<tr><th className="th">Company</th><th className="th">Contact</th><th className="th hidden md:table-cell">Phone</th><th className="th hidden lg:table-cell">Address</th></tr>}
        footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}
      >
        {list.isLoading ? <TableSkeleton columns={cols} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage> : list.data!.data.length === 0 ? (
          <TableMessage columns={cols}><EmptyState title="No customers found" /></TableMessage>
        ) : (
          list.data!.data.map((c) => (
            <tr key={c.id}>
              <td className="td font-medium text-slate-900">{c.companyName ?? '—'}</td>
              <td className="td"><p>{c.user.name}</p><p className="text-xs text-slate-500">{c.user.email}</p></td>
              <td className="td hidden md:table-cell">{c.phone ?? '—'}</td>
              <td className="td hidden max-w-xs truncate lg:table-cell">{c.address ?? '—'}</td>
            </tr>
          ))
        )}
      </Table>
      <NewCustomerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
