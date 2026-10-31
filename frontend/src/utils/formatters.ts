/**
 * Currency & Formatting utilities for Brightloop Subscription Engine
 * 
 * Invariants:
 * - Currency is strictly stored in integer paise (1 INR = 100 paise)
 * - Taxes/Percentages are stored in integer basis points (1% = 100 bps)
 */

export const formatINR = (paise: number = 0): string => {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

export const formatBps = (bps: number = 0): string => {
  const percentage = bps / 100;
  return `${percentage.toFixed(percentage % 1 === 0 ? 0 : 2)}%`;
};

export const formatDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

export const formatDateTime = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const isOverdue = (dueDateInput: string | Date, status: string): boolean => {
  if (status === 'PAID' || status === 'CANCELLED') return false;
  const due = new Date(dueDateInput);
  return due.getTime() < Date.now();
};
