import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Invoice } from '../../api/types';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { formatDate, formatINR, isOverdue } from '../../lib/format';
import { useList } from '../../lib/useList';

export function InvoicesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const list = useList<Invoice>('/invoices', { status: status || undefined });
  const cols = 6;
  return (
    <>
      <PageHeader title="Invoices" description="Generated once per subscription period. Confirm, send, print and collect." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search invoice number or customer" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed (unpaid)</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <Table
        head={
          <tr>
            <th className="th">Invoice</th>
            <th className="th">Customer</th>
            <th className="th hidden md:table-cell">Issued</th>
            <th className="th hidden sm:table-cell">Due</th>
            <th className="th">Status</th>
            <th className="th text-right">Balance / Total</th>
          </tr>
        }
        footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}
      >
        {list.isLoading ? (
          <TableSkeleton columns={cols} />
        ) : list.isError ? (
          <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage>
        ) : list.data!.data.length === 0 ? (
          <TableMessage columns={cols}><EmptyState title="No invoices found" description="Invoices appear when active subscriptions are billed." /></TableMessage>
        ) : (
          list.data!.data.map((inv) => {
            const overdue = isOverdue(inv);
            return (
              <tr key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <td className="td">
                  <Link to={`/invoices/${inv.id}`} className="link" onClick={(e) => e.stopPropagation()}>{inv.number}</Link>
                  <p className="text-xs text-slate-500">{inv.subscription?.number}</p>
                </td>
                <td className="td max-w-[14rem] truncate">{inv.customer?.companyName ?? inv.customerName}</td>
                <td className="td hidden md:table-cell">{formatDate(inv.issueDate)}</td>
                <td className={`td hidden sm:table-cell ${overdue ? 'font-medium text-rose-600' : ''}`}>{formatDate(inv.dueDate)}</td>
                <td className="td"><StatusBadge status={overdue ? 'OVERDUE' : inv.status} /></td>
                <td className="td tabular text-right">
                  <span className="font-medium text-slate-900">{formatINR(inv.total - inv.amountPaid)}</span>
                  <span className="block text-xs text-slate-500">of {formatINR(inv.total)}</span>
                </td>
              </tr>
            );
          })
        )}
      </Table>
    </>
  );
}
