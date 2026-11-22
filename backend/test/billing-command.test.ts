import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingRunResult } from '../src/jobs/billing.job.js';

const mocks = vi.hoisted(() => ({ runBilling: vi.fn(), disconnect: vi.fn() }));
vi.mock('../src/jobs/billing.job.js', () => ({ runBilling: mocks.runBilling }));
vi.mock('../src/config/db.js', () => ({ prisma: { $disconnect: mocks.disconnect } }));

const originalExitCode = process.exitCode;
const success: BillingRunResult = {
  attempted: 2, generated: 3, closed: 1, failures: [], durationMs: 20,
};

beforeEach(() => {
  vi.resetModules();
  mocks.runBilling.mockReset().mockResolvedValue(success);
  mocks.disconnect.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('manual billing command', () => {
  it('preserves the numeric summary, adds details, and disconnects on success', async () => {
    await import('../src/jobs/run.js');
    expect(mocks.runBilling).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({
      attempted: 2, generated: 3, failures: 0, closed: 1, durationMs: 20, failureDetails: [],
    });
    expect(process.exitCode).toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('reports partial failures and returns a failing exit code without retrying invoices', async () => {
    const failures = [{ subscriptionId: 'expired-subscription', message: 'Subscription has reached its expiry date' }];
    mocks.runBilling.mockResolvedValue({ ...success, failures });
    await import('../src/jobs/run.js');
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({
      attempted: 2, generated: 3, failures: 1, failureDetails: failures,
    });
    expect(process.exitCode).toBe(1);
    expect(mocks.runBilling).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it.each([new Error('Database unavailable'), 'unexpected rejection'])(
    'disconnects and signals failure when the run rejects (%s)', async (error) => {
      mocks.runBilling.mockRejectedValue(error);
      await import('../src/jobs/run.js');
      expect(console.error).toHaveBeenCalledWith(
        'Billing run failed:', error instanceof Error ? error.message : 'Unknown billing error',
      );
      expect(console.log).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    },
  );
});
