import { z } from 'zod';
import { forgotPasswordBody, loginBody, resetPasswordBody, signupBody } from '@brightloop/shared';

// Request schemas are the shared contracts the frontend also uses.
export const loginSchema = z.object({ body: loginBody });
export const signupSchema = z.object({ body: signupBody });
export const forgotPasswordSchema = z.object({ body: forgotPasswordBody });
export const resetPasswordSchema = z.object({ body: resetPasswordBody });

export type LoginInput = z.infer<typeof loginBody>;
export type SignupInput = z.infer<typeof signupBody>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBody>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBody>;
