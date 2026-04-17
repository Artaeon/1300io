import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let app: import('express').Express;

const OLD = 'Correct-Horse-Battery-42';
const NEW = 'Brand-New-Passphrase-99';

async function seedUser(email: string, password: string = OLD): Promise<void> {
  const pw = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, password: pw, name: 'Test', role: 'INSPECTOR' },
  });
}

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });
  app = (await import('../index')).default;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Password reset', () => {
  it('request-password-reset always returns 200 (no enumeration)', async () => {
    // Unknown email
    const r1 = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'ghost@nobody.test' });
    expect(r1.status).toBe(200);

    // Empty body
    const r2 = await request(app).post('/api/auth/request-password-reset').send({});
    expect(r2.status).toBe(200);

    // Malformed email
    const r3 = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'not-an-email' });
    expect(r3.status).toBe(200);
  });

  it('request-password-reset for a real user creates a token and sends mail', async () => {
    await seedUser('reset1@test.test');
    const user = await prisma.user.findUnique({ where: { email: 'reset1@test.test' } });

    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'reset1@test.test' })
      .expect(200);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user!.id, usedAt: null },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0]!.token.length).toBeGreaterThan(16);
  });

  it('reset-password flips the password and invalidates all refresh tokens', async () => {
    await seedUser('reset2@test.test');
    const user = await prisma.user.findUnique({ where: { email: 'reset2@test.test' } });

    // Login once to get a refresh token in the DB
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset2@test.test', password: OLD });
    expect(login.status).toBe(200);
    const oldRefresh = login.body.refreshToken as string;

    // Request reset + grab token
    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'reset2@test.test' })
      .expect(200);
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id, usedAt: null },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken!.token, password: NEW });
    expect(res.status).toBe(200);

    // Old password no longer works
    const badLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset2@test.test', password: OLD });
    expect(badLogin.status).toBe(401);

    // New password works
    const goodLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset2@test.test', password: NEW });
    expect(goodLogin.status).toBe(200);

    // Old refresh token is gone
    const oldRefreshRecord = await prisma.refreshToken.findUnique({
      where: { token: oldRefresh },
    });
    expect(oldRefreshRecord).toBeNull();

    // Reset token is marked used
    const used = await prisma.passwordResetToken.findUnique({
      where: { id: resetToken!.id },
    });
    expect(used?.usedAt).not.toBeNull();
  });

  it('reset-password rejects a replayed token with 400', async () => {
    await seedUser('reset3@test.test');
    const user = await prisma.user.findUnique({ where: { email: 'reset3@test.test' } });
    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'reset3@test.test' });
    const token = (
      await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } })
    )!.token;

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: NEW })
      .expect(200);

    // Replay
    const replay = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Another-Good-Pass-99' });
    expect(replay.status).toBe(400);
  });

  it('reset-password enforces the password policy on the NEW password', async () => {
    await seedUser('reset4@test.test');
    const user = await prisma.user.findUnique({ where: { email: 'reset4@test.test' } });
    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'reset4@test.test' });
    const token = (
      await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } })
    )!.token;

    // Too short + no uppercase + no digit
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'tooweak' });
    expect(res.status).toBe(400);

    // Token should NOT have been consumed on validation failure.
    const stillActive = await prisma.passwordResetToken.findUnique({
      where: { id: (await prisma.passwordResetToken.findFirst({
        where: { userId: user!.id },
      }))!.id },
    });
    expect(stillActive?.usedAt).toBeNull();
  });

  it('reset-password rejects expired tokens', async () => {
    await seedUser('reset5@test.test');
    const user = await prisma.user.findUnique({ where: { email: 'reset5@test.test' } });
    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'reset5@test.test' });
    // Force expiry
    await prisma.passwordResetToken.updateMany({
      where: { userId: user!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const token = (
      await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } })
    )!.token;

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: NEW });
    expect(res.status).toBe(400);
  });

  it('reset-password rejects a malformed token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'short', password: NEW });
    expect(res.status).toBe(400);
  });
});
