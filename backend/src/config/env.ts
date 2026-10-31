import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 chars'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  APP_URL: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(4000),
  BILLING_CRON: z.string().default('0 1 * * *'),
});

export const env = envSchema.parse(process.env);
