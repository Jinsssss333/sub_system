import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Invoice } from '../../api/types';
import { EmptyState, ErrorState, PageHeader, Pagination, Select, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { formatDate, formatINR, isOverdue } from '../../lib/format';
import { useList } from '../../lib/useList';

export function MyInvoicesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const list = useList<Invoice>('/me/invoices', { status: status || undefined });
  const cols = 5;
  return (
    <>
      <PageHeader title="My invoices" description="Open any invoice to see its lines and payments, or print it." />
      <div className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
          <option value="">All invoices</option>
          <option value="CONFIRMED">Unpaid</option>
          <option value="PAID">Paid</option>
        </Select>
      </div>
      <Table head={<tr><th className="th">Invoice</th><th className="th hidden md:table-cell">Period</th><th className="th hidden sm:table-cell">Due</th><th className="th">Status</th><th className="th text-right">Total</th></tr>} footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}>
        {list.isLoading ? <TableSkeleton columns={cols} /> : list.isError ? <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage> : list.data!.data.length === 0 ? (
          <TableMessage columns={cols}><EmptyState title="No invoices yet" /></TableMessage>
        ) : (
          list.data!.data.map((inv) => (
            <tr key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/portal/invoices/${inv.id}`)}>
              <td className="td"><Link to={`/portal/invoices/${inv.id}`} className="font-medium text-primary-700 hover:underline" onClick={(e) => e.stopPropagation()}>{inv.number}</Link><p className="text-xs text-slate-500">{inv.subscription?.number}</p></td>
              <td className="td hidden md:table-cell">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</td>
              <td className="td hidden sm:table-cell">{formatDate(inv.dueDate)}</td>
              <td className="td"><StatusBadge status={isOverdue(inv) ? 'OVERDUE' : inv.status} /></td>
              <td className="td tabular text-right font-medium">{formatINR(inv.total)}</td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
