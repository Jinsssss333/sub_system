import React from 'react';

export type SubscriptionStatus = 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'CLOSED';
export type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SubscriptionStatusBadge({
  status,
  size = 'md',
}: {
  status: SubscriptionStatus;
  size?: 'sm' | 'md';
}) {
  const styles: Record<SubscriptionStatus, { bg: string; text: string; dot: string }> = {
    DRAFT: {
      bg: 'bg-slate-100 border-slate-200',
      text: 'text-slate-700',
      dot: 'bg-slate-400',
    },
    QUOTATION: {
      bg: 'bg-sky-50 border-sky-200',
      text: 'text-sky-700',
      dot: 'bg-sky-500',
    },
    CONFIRMED: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
    },
    ACTIVE: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    CLOSED: {
      bg: 'bg-zinc-100 border-zinc-200',
      text: 'text-zinc-600',
      dot: 'bg-zinc-400',
    },
  };

  const style = styles[status] || styles.DRAFT;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${style.bg} ${style.text} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

export function InvoiceStatusBadge({
  status,
  isOverdue = false,
  size = 'md',
}: {
  status: InvoiceStatus;
  isOverdue?: boolean;
  size?: 'sm' | 'md';
}) {
  const effectiveStatus = isOverdue && status !== 'PAID' && status !== 'CANCELLED' ? 'OVERDUE' : status;

  const styles: Record<InvoiceStatus, { bg: string; text: string; dot: string; label: string }> = {
    DRAFT: {
      bg: 'bg-slate-100 border-slate-200',
      text: 'text-slate-700',
      dot: 'bg-slate-400',
      label: 'Draft',
    },
    CONFIRMED: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
      label: 'Confirmed',
    },
    PAID: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: 'Paid',
    },
    CANCELLED: {
      bg: 'bg-rose-50 border-rose-200',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
      label: 'Cancelled',
    },
    OVERDUE: {
      bg: 'bg-red-50 border-red-200 animate-pulse',
      text: 'text-red-700 font-semibold',
      dot: 'bg-red-600',
      label: 'Overdue',
    },
  };

  const style = styles[effectiveStatus] || styles.DRAFT;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${style.bg} ${style.text} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function PolicyBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
        enabled
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
      }`}
    >
      {label}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
    STAFF: 'bg-blue-100 text-blue-700 border-blue-200',
    CUSTOMER: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border ${
        styles[role] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {role}
    </span>
  );
}
