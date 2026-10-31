import { Request, Response, NextFunction } from 'express';
import * as customersService from './customers.service.js';
import { ListCustomersQuery } from './customers.schema.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customersService.listCustomers(req.query as unknown as ListCustomersQuery);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.createCustomer(req.body);
    return res.status(201).json({ data: customer });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.getCustomerById(req.params.id, req.user!);
    return res.json({ data: customer });
  } catch (error) {
    return next(error);
  }
}

