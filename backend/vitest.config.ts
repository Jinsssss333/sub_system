import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Integration tests run against a dedicated PostgreSQL database (billing_test).
dotenv.config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['./test/globalSetup.ts'],
  },
});
