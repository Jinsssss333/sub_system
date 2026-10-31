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


export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.requestPasswordReset(req.body);
    return res.status(200).json({ data: { message: 'If that email is registered, a reset link is on its way.' } });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body);
    return res.status(200).json({ data: { message: 'Password updated. You can sign in now.' } });
  } catch (error) {
    return next(error);
  }
}
