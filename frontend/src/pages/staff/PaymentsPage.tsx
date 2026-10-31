import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PAYMENT_METHODS } from '@brightloop/shared';
import type { LedgerPayment } from '../../api/types';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { formatDate, formatINR, methodLabel } from '../../lib/format';
import { useList } from '../../lib/useList';

export function PaymentsPage() {
  const [method, setMethod] = useState('');
  const list = useList<LedgerPayment>('/payments', { method: method || undefined });
  const cols = 5;
  return (
    <>
      <PageHeader title="Payments" description="Every payment recorded against an invoice." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search invoice or customer" />
        <Select value={method} onChange={(e) => setMethod(e.target.value)} className="sm:w-48" aria-label="Filter by method">
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
        </Select>
      </div>
      <Table
        head={
          <tr>
            <th className="th">Date</th>
            <th className="th">Invoice</th>
            <th className="th hidden md:table-cell">Customer</th>
            <th className="th hidden sm:table-cell">Method</th>
            <th className="th text-right">Amount</th>
          </tr>
        }
        footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}
      >
        {list.isLoading ? (
          <TableSkeleton columns={cols} />
        ) : list.isError ? (
          <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage>
        ) : list.data!.data.length === 0 ? (
          <TableMessage columns={cols}><EmptyState title="No payments yet" description="Record a payment from a confirmed invoice." /></TableMessage>
        ) : (
          list.data!.data.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="td">{formatDate(p.paidOn)}</td>
              <td className="td"><Link to={`/invoices/${p.invoice.id}`} className="font-medium text-primary-700 hover:underline">{p.invoice.number}</Link></td>
              <td className="td hidden max-w-[14rem] truncate md:table-cell">{p.invoice.customerName}</td>
              <td className="td hidden sm:table-cell">{methodLabel(p.method)}</td>
              <td className="td tabular text-right font-medium text-emerald-700">{formatINR(p.amount)}</td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
