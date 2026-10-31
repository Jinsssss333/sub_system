import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/db.js';
import { api } from './helpers.js';

afterAll(() => prisma.$disconnect());

describe('foundation', () => {
  it('reports API and database health', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('returns the error envelope for malformed JSON', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects requests without a bearer token', async () => {
    const res = await api().get('/api/subscriptions');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('enforces database money constraints', async () => {
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "Tax" (id, name, "rateBps", active) VALUES ('t1', 'bad', 20000, true)`)).rejects.toThrow();
  });
});
