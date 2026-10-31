import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { createStaffBody, PASSWORD_MESSAGE } from '@brightloop/shared';
import { api } from '../../api/client';
import type { User } from '../../api/types';
import { Button, EmptyState, ErrorState, Field, FormError, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { useToast } from '../../components/toast';
import { applyServerErrors } from '../../lib/forms';
import { formatDate } from '../../lib/format';
import { useList } from '../../lib/useList';

type ListedUser = User & { createdAt: string; customer: { id: string; companyName: string | null } | null };

export function UsersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const list = useList<ListedUser>('/users', { role: role || undefined });
  const form = useForm<z.infer<typeof createStaffBody>>({ resolver: zodResolver(createStaffBody), defaultValues: { name: '', email: '', password: '' } });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (v: z.infer<typeof createStaffBody>) => api.post('/users/staff', v),
    onSuccess: () => { toast.success('Staff account created.'); void qc.invalidateQueries({ queryKey: ['/users'] }); form.reset(); setOpen(false); },
    onError: (err) => !applyServerErrors(err, form.setError) && setError(err),
  });
  const cols = 4;
  return (
    <>
      <PageHeader title="Users & staff" description="Only administrators can create staff accounts." actions={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add staff</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name or email" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-44" aria-label="Filter by role"><option value="">All roles</option><option value="ADMIN">Admin</option><option value="STAFF">Staff</option><option value="CUSTOMER">Customer</option></Select>
      </div>
      <Table head={<tr><th className="th">Name</th><th className="th">Role</th><th className="th hidden md:table-cell">Company</th><th className="th hidden sm:table-cell">Joined</th></tr>} footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}>
        {list.isLoading ? <TableSkeleton columns={cols} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} /></TableMessage> : list.data!.data.length === 0 ? <TableMessage columns={cols}><EmptyState title="No users found" /></TableMessage> : (
          list.data!.data.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="td"><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
              <td className="td"><StatusBadge status={u.role} /></td>
              <td className="td hidden md:table-cell">{u.customer?.companyName ?? '—'}</td>
              <td className="td hidden sm:table-cell">{formatDate(u.createdAt)}</td>
            </tr>
          ))
        )}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title="Add staff member" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="staff-form" loading={create.isPending}>Create account</Button></>}>
        <form id="staff-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => { setError(null); create.mutate(v); })}>
          <FormError error={error} />
          <Field label="Full name" htmlFor="name" error={errors.name?.message}><Input id="name" invalid={!!errors.name} {...form.register('name')} /></Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}><Input id="email" type="email" invalid={!!errors.email} {...form.register('email')} /></Field>
          <Field label="Temporary password" htmlFor="password" error={errors.password?.message} hint={PASSWORD_MESSAGE}><Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...form.register('password')} /></Field>
        </form>
      </Modal>
    </>
  );
}
