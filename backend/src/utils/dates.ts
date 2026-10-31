import { BillingPeriod } from '@prisma/client';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  // monthIndex: 0 = January, 1 = February, ..., 11 = December
  // Date.UTC(year, monthIndex + 1, 0) gives the last day of monthIndex
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Adds a billing period with calendar date clamping while retaining the original anchor date.
 * For example:
 * - Jan 31 + 1 month = Feb 28 (or 29 in leap year)
 * - Feb 28 + 1 month with anchor Jan 31 = March 31 (retains anchor!)
 * - Feb 29, 2024 (leap) + 1 year = Feb 28, 2025
 * - Feb 28, 2027 + 1 year with anchor Feb 29 = Feb 29, 2028 (leap recovery!)
 *
 * @param date The current date from which to advance
 * @param period BillingPeriod (DAILY, WEEKLY, MONTHLY, YEARLY)
 * @param anchorDate The original subscription anchor date (defaults to date)
 */
export function addPeriod(date: Date, period: BillingPeriod, anchorDate?: Date): Date {
  const result = new Date(date.getTime());
  const anchor = anchorDate ?? date;
  const anchorDay = anchor.getUTCDate();

  switch (period) {
    case BillingPeriod.DAILY:
      result.setUTCDate(result.getUTCDate() + 1);
      break;

    case BillingPeriod.WEEKLY:
      result.setUTCDate(result.getUTCDate() + 7);
      break;

    case BillingPeriod.MONTHLY: {
      const currentYear = result.getUTCFullYear();
      const currentMonth = result.getUTCMonth();
      const targetMonth = currentMonth + 1;
      const targetYear = currentYear + Math.floor(targetMonth / 12);
      const normalizedMonth = ((targetMonth % 12) + 12) % 12;

      const daysInTargetMonth = getDaysInMonth(targetYear, normalizedMonth);
      const targetDay = Math.min(anchorDay, daysInTargetMonth);

      return new Date(
        Date.UTC(
          targetYear,
          normalizedMonth,
          targetDay,
          result.getUTCHours(),
          result.getUTCMinutes(),
          result.getUTCSeconds(),
          result.getUTCMilliseconds()
        )
      );
    }

    case BillingPeriod.YEARLY: {
      const currentYear = result.getUTCFullYear();
      const targetYear = currentYear + 1;
      const targetMonth = anchor.getUTCMonth();

      const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
      const targetDay = Math.min(anchorDay, daysInTargetMonth);

      return new Date(
        Date.UTC(
          targetYear,
          targetMonth,
          targetDay,
          result.getUTCHours(),
          result.getUTCMinutes(),
          result.getUTCSeconds(),
          result.getUTCMilliseconds()
        )
      );
    }
  }

  return result;
}

/**
 * Calculates the period end date as (periodStart + 1 period - 1 day).
 */
export function calculatePeriodEnd(
  periodStart: Date,
  period: BillingPeriod,
  anchorDate?: Date
): Date {
  const nextPeriodDate = addPeriod(periodStart, period, anchorDate);
  return addDays(nextPeriodDate, -1);
}

/**
 * Shared helper requested by Person 3 (Billing):
 * nextPeriod(periodStart: Date, billingPeriod: string | BillingPeriod, anchor: Date): Date
 */
export function nextPeriod(
  periodStart: Date,
  billingPeriod: string | BillingPeriod,
  anchor?: Date
): Date {
  return addPeriod(periodStart, billingPeriod as BillingPeriod, anchor);
}



