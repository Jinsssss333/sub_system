import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';

// Person 1 routers (Identity & Catalog)
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { plansRouter } from './modules/plans/plans.routes.js';
import { taxesRouter } from './modules/taxes/taxes.routes.js';

// Person 2 routers (Subscriptions & Templates)
import { templatesRouter } from './modules/templates/templates.routes.js';
import {
  subscriptionsRouter,
  meSubscriptionsRouter,
} from './modules/subscriptions/subscriptions.routes.js';

// Person 3 routers (Billing & Finance Engine)
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Public health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Brightloop Subscription Platform',
    timestamp: new Date().toISOString(),
  });
});

// Person 1: Identity & Catalog routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/taxes', taxesRouter);

// Person 2: Subscriptions & Templates routes
app.use('/api/templates', templatesRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/me/subscriptions', meSubscriptionsRouter);

// Person 3: Billing & Reports routes
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportsRouter);

// Centralized error handling
app.use(errorHandler);
