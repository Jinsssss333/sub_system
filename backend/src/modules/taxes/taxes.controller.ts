import { Request, Response, NextFunction } from 'express';
import * as taxesService from './taxes.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await taxesService.listTaxes(req.query as any);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const tax = await taxesService.getTaxById(req.params.id);
    return res.json({ data: tax });
  } catch (error) {
    return next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const tax = await taxesService.createTax(req.body);
    return res.status(201).json({ data: tax });
  } catch (error) {
    return next(error);
  }
}

