import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: Array<{ to: string; html: string; text?: string }> = [];
vi.mock('../src/config/mailer.js', () => ({
  sendEmail: vi.fn(async (message: { to: string; html: string; text?: string }) => {
    sent.push(message);
    return { delivered: true, messageId: 'test' };
  }),
}));

const { prisma } = await import('../src/config/db.js');
const { api, auth, createUser, login, PASSWORD, resetDb } = await import('./helpers.js');

afterAll(() => prisma.$disconnect());
beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

const signup = (body: Record<string, unknown>) => api().post('/api/auth/signup').send(body);

describe('signup', () => {
  it('creates a customer account with a customer profile and lowercases the email', async () => {
    const res = await signup({ email: 'New.User@Example.com', password: 'Valid@Pass1', name: 'New User', companyName: 'Acme' });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'new.user@example.com', role: 'CUSTOMER' });
    expect(res.body.data.user.customerId).toBeTruthy();
    expect(res.body.data.token).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it.each([
    ['8 characters', 'Abcdef@1'],
    ['no special character', 'Abcdefgh12'],
    ['no uppercase', 'abcdefg@12'],
    ['no lowercase', 'ABCDEFG@12'],
  ])('rejects a password with %s', async (_label, password) => {
    const res = await signup({ email: 'a@b.co', password, name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.password).toBeTruthy();
  });

  it('rejects duplicate emails case-insensitively with 409', async () => {
    await signup({ email: 'dup@example.com', password: 'Valid@Pass1', name: 'One' });
    const res = await signup({ email: 'DUP@example.com', password: 'Valid@Pass1', name: 'Two' });
    expect(res.status).toBe(409);
  });

  it('ignores attempts to self-assign a role', async () => {
    const res = await signup({ email: 'x@example.com', password: 'Valid@Pass1', name: 'X', role: 'ADMIN' });
    expect(res.status).toBe(400);
  });
});

describe('login and me', () => {
  it('logs in and returns the profile', async () => {
    await createUser('CUSTOMER', 'c@test.local');
    const token = await login('c@test.local');
    const me = await api().get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ email: 'c@test.local', role: 'CUSTOMER' });
  });

  it('uses the same error for unknown email and wrong password', async () => {
    await createUser('CUSTOMER', 'c@test.local');
    const wrong = await api().post('/api/auth/login').send({ email: 'c@test.local', password: 'Wrong@Pass1' });
    const unknown = await api().post('/api/auth/login').send({ email: 'nobody@test.local', password: 'Wrong@Pass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it('rejects tampered tokens', async () => {
    const res = await api().get('/api/auth/me').set(auth('eyJhbGciOiJub25lIn0.eyJpZCI6IngifQ.'));
    expect(res.status).toBe(401);
  });
});

describe('staff creation (RBAC)', () => {
  it('lets an admin create staff and blocks staff and customers with 403', async () => {
    await createUser('ADMIN', 'admin@test.local');
    await createUser('STAFF', 'staff@test.local');
    await createUser('CUSTOMER', 'cust@test.local');
    const body = { email: 'new.staff@test.local', password: 'Valid@Pass1', name: 'New Staff' };

    const asAdmin = await api().post('/api/users/staff').set(auth(await login('admin@test.local'))).send(body);
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.role).toBe('STAFF');

    const asStaff = await api().post('/api/users/staff').set(auth(await login('staff@test.local'))).send({ ...body, email: 's2@test.local' });
    expect(asStaff.status).toBe(403);
    const asCustomer = await api().post('/api/users/staff').set(auth(await login('cust@test.local'))).send({ ...body, email: 's3@test.local' });
    expect(asCustomer.status).toBe(403);

    const list = await api().get('/api/users?page=1&pageSize=2').set(auth(await login('admin@test.local')));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.meta.total).toBe(4);
  });
});

describe('password reset', () => {
  it('returns the same 200 for known and unknown emails and only mails known ones', async () => {
    await createUser('CUSTOMER', 'c@test.local');
    const known = await api().post('/api/auth/forgot-password').send({ email: 'c@test.local' });
    const unknown = await api().post('/api/auth/forgot-password').send({ email: 'ghost@test.local' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('c@test.local');
  });

  it('stores only a hash, resets once, and rejects reuse', async () => {
    const user = await createUser('CUSTOMER', 'c@test.local');
    await api().post('/api/auth/forgot-password').send({ email: 'c@test.local' });
    const token = /token=([a-f0-9]{64})/.exec(sent[0].text ?? '')?.[1];
    expect(token).toBeTruthy();

    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toBe(token);

    const reset = await api().post('/api/auth/reset-password').send({ token, password: 'Brand@New12' });
    expect(reset.status).toBe(200);
    expect(await login('c@test.local', 'Brand@New12')).toBeTruthy();
    const old = await api().post('/api/auth/login').send({ email: 'c@test.local', password: PASSWORD });
    expect(old.status).toBe(401);

    const reuse = await api().post('/api/auth/reset-password').send({ token, password: 'Another@New12' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects expired tokens and invalidates older links when a new one is requested', async () => {
    await createUser('CUSTOMER', 'c@test.local');
    await api().post('/api/auth/forgot-password').send({ email: 'c@test.local' });
    await api().post('/api/auth/forgot-password').send({ email: 'c@test.local' });
    const first = /token=([a-f0-9]{64})/.exec(sent[0].text ?? '')![1];
    const second = /token=([a-f0-9]{64})/.exec(sent[1].text ?? '')![1];

    expect((await api().post('/api/auth/reset-password').send({ token: first, password: 'Brand@New12' })).status).toBe(400);

    await prisma.passwordResetToken.updateMany({ where: { usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api().post('/api/auth/reset-password').send({ token: second, password: 'Brand@New12' })).status).toBe(400);
  });

  it('never logs reset tokens', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((level) => vi.spyOn(console, level));
    await createUser('CUSTOMER', 'c@test.local');
    await api().post('/api/auth/forgot-password').send({ email: 'c@test.local' });
    const token = /token=([a-f0-9]{64})/.exec(sent[0].text ?? '')![1];
    await api().post('/api/auth/reset-password').send({ token, password: 'Brand@New12' });
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
      spy.mockRestore();
    }
  });
});
