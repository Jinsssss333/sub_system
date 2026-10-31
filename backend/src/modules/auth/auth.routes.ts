import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authMiddleware } from '../../middleware/auth.js';
import { loginSchema, signupSchema } from './auth.schema.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/signup', validate(signupSchema), authController.signup);
authRouter.get('/me', authMiddleware, authController.me);
