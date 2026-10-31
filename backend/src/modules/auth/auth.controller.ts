import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser(req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signupUser(req.body);
    return res.status(201).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getCurrentUser(req.user!.id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}
