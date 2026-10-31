import cron from 'node-cron';
import { Role } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { generateInvoice } from '../modules/invoices/invoices.service.js';

export interface BillingRunResult { attempted: number; generated: number; failures: Array<{ subscriptionId: string; message: string }>; }

export async function runBilling(today = new Date()): Promise<BillingRunResult> {
  const due = await prisma.subscription.findMany({ where: { status: 'ACTIVE', pausedAt: null, nextInvoiceDate: { lte: today } }, select: { id: true } });
  const result: BillingRunResult = { attempted: due.length, generated: 0, failures: [] };
  for (const subscription of due) {
    try {
      for (let cycle = 0; cycle < 12; cycle += 1) {
        const current = await prisma.subscription.findUnique({ where: { id: subscription.id }, select: { nextInvoiceDate: true, status: true, pausedAt: true } });
        if (!current?.nextInvoiceDate || current.nextInvoiceDate > today || current.status !== 'ACTIVE' || current.pausedAt) break;
        await generateInvoice(subscription.id, today);
        result.generated += 1;
      }
    } catch (error) { result.failures.push({ subscriptionId: subscription.id, message: error instanceof Error ? error.message : 'Unknown billing error' }); }
  }
  return result;
}

export function startBillingScheduler() {
  if (!cron.validate(env.BILLING_CRON)) throw new Error('BILLING_CRON is invalid');
  return cron.schedule(env.BILLING_CRON, () => { void runBilling().catch((error) => console.error('Billing job failed', error)); });
}

export const adminBillingRouter = Router();
adminBillingRouter.post('/run-billing', authMiddleware, requireRole(Role.ADMIN), async (_req, res, next) => {
  try { res.json(await runBilling()); } catch (error) { next(error); }
});
