import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
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

// Mounted module routers
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/reports', reportsRouter);

// Centralized error handling
app.use(errorHandler);
