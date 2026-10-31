import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }).strict(),
});

export const signupSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z
      .string()
      .min(9, 'Password must be more than 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one special character'
      ),
    name: z.string().trim().min(1, 'Name is required'),
    companyName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional(),
  }).strict(),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type SignupInput = z.infer<typeof signupSchema>['body'];

