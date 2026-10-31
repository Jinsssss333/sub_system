import { expect, it } from 'vitest';
import { BillingPeriod } from '@prisma/client';
import {
  addPeriod,
  calculatePeriodEnd,
  addDays,
  isLeapYear,
  getDaysInMonth,
} from '../src/utils/dates.js';

function assert(condition: boolean, message: string) {
  expect(condition, message).toBe(true);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

it('date clamping and anchor recovery (team suite)', () => {
void ('--- Running Date Clamping & Anchor Recovery Tests ---');

// 1. Leap year helper
assert(isLeapYear(2024) === true, '2024 should be leap year');
assert(isLeapYear(2025) === false, '2025 should not be leap year');
assert(isLeapYear(2026) === false, '2026 should not be leap year');
assert(isLeapYear(2000) === true, '2000 should be leap year');
assert(isLeapYear(1900) === false, '1900 should not be leap year');
void ('✓ isLeapYear tests passed');

// 2. Days in month
assert(getDaysInMonth(2026, 0) === 31, 'Jan 2026 has 31 days');
assert(getDaysInMonth(2026, 1) === 28, 'Feb 2026 has 28 days');
assert(getDaysInMonth(2024, 1) === 29, 'Feb 2024 has 29 days');
assert(getDaysInMonth(2026, 3) === 30, 'April 2026 has 30 days');
void ('✓ getDaysInMonth tests passed');

// 3. Daily and Weekly
const baseDate = new Date('2026-01-15T00:00:00.000Z');
const nextDay = addPeriod(baseDate, BillingPeriod.DAILY);
assert(formatDate(nextDay) === '2026-01-16', `Expected 2026-01-16, got ${formatDate(nextDay)}`);

const nextWeek = addPeriod(baseDate, BillingPeriod.WEEKLY);
assert(formatDate(nextWeek) === '2026-01-22', `Expected 2026-01-22, got ${formatDate(nextWeek)}`);
void ('✓ DAILY and WEEKLY tests passed');

// 4. Month-end Clamping and Anchor Date Recovery
// Jan 31 -> Feb 28 (in non-leap year 2026)
const jan31 = new Date('2026-01-31T00:00:00.000Z');
const feb28 = addPeriod(jan31, BillingPeriod.MONTHLY, jan31);
assert(formatDate(feb28) === '2026-02-28', `Expected 2026-02-28, got ${formatDate(feb28)}`);

// Feb 28 -> March 31 (retains Jan 31 anchor!)
const march31 = addPeriod(feb28, BillingPeriod.MONTHLY, jan31);
assert(formatDate(march31) === '2026-03-31', `Expected 2026-03-31 (anchor recovery), got ${formatDate(march31)}`);

// March 31 -> April 30 (April has 30 days, clamped)
const april30 = addPeriod(march31, BillingPeriod.MONTHLY, jan31);
assert(formatDate(april30) === '2026-04-30', `Expected 2026-04-30, got ${formatDate(april30)}`);

// April 30 -> May 31 (May has 31 days, anchor recovered!)
const may31 = addPeriod(april30, BillingPeriod.MONTHLY, jan31);
assert(formatDate(may31) === '2026-05-31', `Expected 2026-05-31 (anchor recovery), got ${formatDate(may31)}`);

// June 30 -> July 31
const june30 = addPeriod(may31, BillingPeriod.MONTHLY, jan31);
assert(formatDate(june30) === '2026-06-30', `Expected 2026-06-30, got ${formatDate(june30)}`);
const july31 = addPeriod(june30, BillingPeriod.MONTHLY, jan31);
assert(formatDate(july31) === '2026-07-31', `Expected 2026-07-31, got ${formatDate(july31)}`);

// Year-end rollover: Dec 31 -> Jan 31 next year
const dec31 = new Date('2026-12-31T00:00:00.000Z');
const jan31Next = addPeriod(dec31, BillingPeriod.MONTHLY, dec31);
assert(formatDate(jan31Next) === '2027-01-31', `Expected 2027-01-31, got ${formatDate(jan31Next)}`);
void ('✓ Month-end clamping and anchor recovery tests passed');

// 5. Leap year February clamping
const jan31Leap = new Date('2024-01-31T00:00:00.000Z');
const feb29Leap = addPeriod(jan31Leap, BillingPeriod.MONTHLY, jan31Leap);
assert(formatDate(feb29Leap) === '2024-02-29', `Expected 2024-02-29 in leap year, got ${formatDate(feb29Leap)}`);

const mar31Leap = addPeriod(feb29Leap, BillingPeriod.MONTHLY, jan31Leap);
assert(formatDate(mar31Leap) === '2024-03-31', `Expected 2024-03-31, got ${formatDate(mar31Leap)}`);
void ('✓ Leap year February clamping tests passed');

// 6. Yearly clamping and leap year anniversary recovery
const leapDayAnchor = new Date('2024-02-29T00:00:00.000Z');
const yr2025 = addPeriod(leapDayAnchor, BillingPeriod.YEARLY, leapDayAnchor);
assert(formatDate(yr2025) === '2025-02-28', `Expected 2025-02-28, got ${formatDate(yr2025)}`);

const yr2026 = addPeriod(yr2025, BillingPeriod.YEARLY, leapDayAnchor);
assert(formatDate(yr2026) === '2026-02-28', `Expected 2026-02-28, got ${formatDate(yr2026)}`);

const yr2027 = addPeriod(yr2026, BillingPeriod.YEARLY, leapDayAnchor);
assert(formatDate(yr2027) === '2027-02-28', `Expected 2027-02-28, got ${formatDate(yr2027)}`);

// 2028 is leap year: Feb 29 anchor recovered!
const yr2028 = addPeriod(yr2027, BillingPeriod.YEARLY, leapDayAnchor);
assert(formatDate(yr2028) === '2028-02-29', `Expected 2028-02-29 (leap anniversary recovery), got ${formatDate(yr2028)}`);
void ('✓ Yearly leap anniversary recovery tests passed');

// 7. calculatePeriodEnd (periodStart + 1 period - 1 day)
const pStart = new Date('2026-01-01T00:00:00.000Z');
const pEnd = calculatePeriodEnd(pStart, BillingPeriod.MONTHLY, pStart);
assert(formatDate(pEnd) === '2026-01-31', `Expected 2026-01-31, got ${formatDate(pEnd)}`);

const pStartFeb = new Date('2026-02-01T00:00:00.000Z');
const pEndFeb = calculatePeriodEnd(pStartFeb, BillingPeriod.MONTHLY, pStartFeb);
assert(formatDate(pEndFeb) === '2026-02-28', `Expected 2026-02-28, got ${formatDate(pEndFeb)}`);
void ('✓ calculatePeriodEnd tests passed');

// 8. addDays
const dayPlus5 = addDays(baseDate, 5);
assert(formatDate(dayPlus5) === '2026-01-20', `Expected 2026-01-20, got ${formatDate(dayPlus5)}`);
void ('✓ addDays tests passed');

void ('🎉 ALL DATES TESTS PASSED SUCCESSFULLY!');
});
