import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`🚀 Brightloop Billing Server running on http://localhost:${env.PORT}`);
  console.log(`📡 Health Check: http://localhost:${env.PORT}/api/health`);
});
