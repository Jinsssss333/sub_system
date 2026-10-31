import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

/** Apply migrations to the dedicated test database before any test file runs. */
export default function setup() {
  dotenv.config({ path: '.env.test', override: true });
  if (!process.env.DATABASE_URL?.includes('billing_test')) {
    throw new Error('Refusing to run integration tests: DATABASE_URL must point at the billing_test database');
  }
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
}
