import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Subscription } from '../../api/types';
import { Button, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, StatusBadge, Table, TableMessage, TableSkeleton } from '../../components/ui';
import { formatDate, formatINR, periodLabel } from '../../lib/format';
import { useList } from '../../lib/useList';

const STATUSES = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];
const monthlyValue = (s: Subscription) => s.plan.price + s.lines.reduce((sum, l) => sum + l.amount, 0);

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const list = useList<Subscription>('/subscriptions', { status: status || undefined });
  const cols = 6;
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Quotations, confirmed orders and recurring contracts."
        actions={
          <Button onClick={() => navigate('/subscriptions/new')} icon={<Plus className="h-4 w-4" />}>
            New subscription
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search number, customer or email" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>
      <Table
        head={
          <tr>
            <th className="th">Number</th>
            <th className="th">Customer</th>
            <th className="th hidden md:table-cell">Plan</th>
            <th className="th">Status</th>
            <th className="th hidden lg:table-cell">Next invoice</th>
            <th className="th hidden text-right sm:table-cell">Per cycle (pre-tax)</th>
          </tr>
        }
        footer={list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.meta.total} onPage={list.setPage} />}
      >
        {list.isLoading ? (
          <TableSkeleton columns={cols} />
        ) : list.isError ? (
          <TableMessage columns={cols}><ErrorState error={list.error} onRetry={() => list.refetch()} /></TableMessage>
        ) : list.data!.data.length === 0 ? (
          <TableMessage columns={cols}>
            <EmptyState title="No subscriptions found" description={list.search || status ? 'Try a different search or filter.' : 'Create the first quotation to get started.'} />
          </TableMessage>
        ) : (
          list.data!.data.map((s) => (
            <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/subscriptions/${s.id}`)}>
              <td className="td">
                <Link to={`/subscriptions/${s.id}`} className="font-medium text-primary-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                  {s.number}
                </Link>
              </td>
              <td className="td max-w-[14rem]">
                <p className="truncate font-medium text-slate-900">{s.customer.companyName ?? s.customer.user.name}</p>
                <p className="truncate text-xs text-slate-500">{s.customer.user.email}</p>
              </td>
              <td className="td hidden md:table-cell">
                {s.plan.name} <span className="text-slate-400">· {periodLabel[s.plan.billingPeriod]}</span>
              </td>
              <td className="td">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={s.status} />
                  {s.pausedAt && <StatusBadge status="PAUSED" />}
                </div>
              </td>
              <td className="td hidden lg:table-cell">{s.status === 'ACTIVE' && !s.pausedAt ? formatDate(s.nextInvoiceDate) : '—'}</td>
              <td className="td tabular hidden text-right font-medium sm:table-cell">{formatINR(monthlyValue(s))}</td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}
