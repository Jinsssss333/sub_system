import { prisma } from '../config/db.js';
import { runBilling } from './billing.job.js';

// Manual billing run: `npm run billing:run`
try {
  const result = await runBilling();
  // Keep the existing numeric summary fields for scripts consuming this output.
  console.log(JSON.stringify({
    attempted: result.attempted,
    generated: result.generated,
    failures: result.failures.length,
    closed: result.closed,
    durationMs: result.durationMs,
    failureDetails: result.failures,
  }, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
} catch (error) {
  console.error('Billing run failed:', error instanceof Error ? error.message : 'Unknown billing error');
  process.exitCode = 1;
} finally {
  // Do not use process.exit(): allow cleanup and buffered output to finish.
  await prisma.$disconnect();
}
