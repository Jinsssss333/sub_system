import { SubscriptionStatus } from '@prisma/client';
import { ALLOWED_TRANSITIONS } from '../src/modules/subscriptions/subscriptions.service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Running Subscription State Machine Tests ---');

// 1. Check strict allowed transitions
assert(ALLOWED_TRANSITIONS.DRAFT.length === 1 && ALLOWED_TRANSITIONS.DRAFT[0] === 'QUOTATION', 'DRAFT -> QUOTATION only');
assert(ALLOWED_TRANSITIONS.QUOTATION.length === 1 && ALLOWED_TRANSITIONS.QUOTATION[0] === 'CONFIRMED', 'QUOTATION -> CONFIRMED only');
assert(ALLOWED_TRANSITIONS.CONFIRMED.length === 1 && ALLOWED_TRANSITIONS.CONFIRMED[0] === 'ACTIVE', 'CONFIRMED -> ACTIVE only');
assert(ALLOWED_TRANSITIONS.ACTIVE.length === 1 && ALLOWED_TRANSITIONS.ACTIVE[0] === 'CLOSED', 'ACTIVE -> CLOSED only');
assert(ALLOWED_TRANSITIONS.CLOSED.length === 0, 'CLOSED has no allowed transitions');
console.log('✓ Valid transition paths verified');

// 2. Check forbidden transitions
const allStatuses: SubscriptionStatus[] = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];

// Illegal jumps from DRAFT
assert(!ALLOWED_TRANSITIONS.DRAFT.includes('ACTIVE'), 'DRAFT -> ACTIVE is forbidden');
assert(!ALLOWED_TRANSITIONS.DRAFT.includes('CONFIRMED'), 'DRAFT -> CONFIRMED is forbidden');
assert(!ALLOWED_TRANSITIONS.DRAFT.includes('CLOSED'), 'DRAFT -> CLOSED is forbidden');

// Illegal jumps from QUOTATION
assert(!ALLOWED_TRANSITIONS.QUOTATION.includes('ACTIVE'), 'QUOTATION -> ACTIVE is forbidden');
assert(!ALLOWED_TRANSITIONS.QUOTATION.includes('DRAFT'), 'QUOTATION -> DRAFT is forbidden');

// Illegal jumps from CONFIRMED
assert(!ALLOWED_TRANSITIONS.CONFIRMED.includes('DRAFT'), 'CONFIRMED -> DRAFT is forbidden');
assert(!ALLOWED_TRANSITIONS.CONFIRMED.includes('QUOTATION'), 'CONFIRMED -> QUOTATION is forbidden');

// Illegal jumps from ACTIVE
assert(!ALLOWED_TRANSITIONS.ACTIVE.includes('DRAFT'), 'ACTIVE -> DRAFT is forbidden');
assert(!ALLOWED_TRANSITIONS.ACTIVE.includes('QUOTATION'), 'ACTIVE -> QUOTATION is forbidden');
assert(!ALLOWED_TRANSITIONS.ACTIVE.includes('CONFIRMED'), 'ACTIVE -> CONFIRMED is forbidden');

// Illegal jumps from CLOSED
for (const s of allStatuses) {
  assert(!ALLOWED_TRANSITIONS.CLOSED.includes(s), `CLOSED -> ${s} is forbidden`);
}

console.log('✓ All illegal state jumps correctly rejected');
console.log('🎉 ALL STATE MACHINE TESTS PASSED SUCCESSFULLY!');
