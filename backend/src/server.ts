import { app } from './app.js';
import { env } from './config/env.js';
import { startBillingScheduler } from './jobs/billing.job.js';

startBillingScheduler();
app.listen(env.PORT, () => {
  console.log(`Brightloop Billing Server running on http://localhost:${env.PORT}`);
  console.log(`Health Check: http://localhost:${env.PORT}/api/health`);
});
