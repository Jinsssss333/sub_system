import { Router } from 'express';
import { env } from '../../config/env.js';
import { authMiddleware } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './auth.schema.js';

export const authRouter = Router();

// Per-IP limit on credential endpoints (relaxed under test so suites can log in freely).
const credentialLimit = rateLimit({ windowMs: 60_000, max: env.NODE_ENV === 'test' ? 10_000 : 20 });

authRouter.post('/login', credentialLimit, validate(loginSchema), authController.login);
authRouter.post('/signup', credentialLimit, validate(signupSchema), authController.signup);
authRouter.post('/forgot-password', credentialLimit, validate(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', credentialLimit, validate(resetPasswordSchema), authController.resetPassword);
authRouter.get('/me', authMiddleware, authController.me);
