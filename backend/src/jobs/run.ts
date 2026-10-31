import { prisma } from '../config/db.js';
import { runBilling } from './billing.job.js';

// Manual billing run: `npm run billing:run`
const result = await runBilling();
console.log(JSON.stringify({ attempted: result.attempted, generated: result.generated, failures: result.failures.length }, null, 2));
await prisma.$disconnect();
