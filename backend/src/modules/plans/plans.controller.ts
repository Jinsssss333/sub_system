import { Request, Response, NextFunction } from 'express';
import * as plansService from './plans.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await plansService.listPlans(req.query as any);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await plansService.getPlanById(req.params.id);
    return res.json({ data: plan });
  } catch (error) {
    return next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await plansService.createPlan(req.body);
    return res.status(201).json({ data: plan });
  } catch (error) {
    return next(error);
  }
}
