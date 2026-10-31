import { BillingPeriod } from '@prisma/client';

export function addPeriod(date: Date, period: BillingPeriod): Date {
  const result = new Date(date.getTime());

  switch (period) {
    case BillingPeriod.DAILY:
      result.setUTCDate(result.getUTCDate() + 1);
      break;
    case BillingPeriod.WEEKLY:
      result.setUTCDate(result.getUTCDate() + 7);
      break;
    case BillingPeriod.MONTHLY: {
      const currentDay = result.getUTCDate();
      result.setUTCMonth(result.getUTCMonth() + 1);
      // Clamp end of month (e.g. 31 Jan -> 28/29 Feb)
      if (result.getUTCDate() < currentDay) {
        result.setUTCDate(0);
      }
      break;
    }
    case BillingPeriod.YEARLY: {
      const currentDay = result.getUTCDate();
      result.setUTCFullYear(result.getUTCFullYear() + 1);
      if (result.getUTCDate() < currentDay) {
        result.setUTCDate(0);
      }
      break;
    }
  }

  return result;
}

