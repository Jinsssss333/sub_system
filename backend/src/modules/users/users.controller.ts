import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.listUsers(req.query as any);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function createStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.createStaff(req.body);
    return res.status(201).json({ data: user });
  } catch (error) {
    return next(error);
  }
}

