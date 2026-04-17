import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let app: import('express').Express;

const STRONG = 'Correct-Horse-Battery-42';

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

describe('Email verification', () => {
  it('register issues an EmailVerificationToken', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify1@test.test', password: STRONG, name: 'Verify1' });
    expect(res.status).toBe(201);
    expect(res.body.emailVerificationSent).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: 'verify1@test.test' } });
    expect(user?.emailVerified).toBe(false);

    const tokens = await prisma.emailVerificationToken.findMany({
      where: { userId: user!.id },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0]!.token.length).toBeGreaterThan(16);
    expect(tokens[0]!.usedAt).toBeNull();
  });

  it('POST /api/auth/verify-email flips emailVerified and consumes the token', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'verify1@test.test' } });
    const token = await prisma.emailVerificationToken.findFirst({ where: { userId: user!.id } });

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: token!.token });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('verify1@test.test');

    const refreshed = await prisma.user.findUnique({ where: { id: user!.id } });
    expect(refreshed?.emailVerified).toBe(true);

    const remaining = await prisma.emailVerificationToken.findMany({
      where: { userId: user!.id, usedAt: null },
    });
    expect(remaining.length).toBe(0);
  });

  it('re-using a verification token returns 400', async () => {
    // Register, verify, try to verify again with the same token.
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify2@test.test', password: STRONG, name: 'Verify2' });
    const user = await prisma.user.findUnique({ where: { email: 'verify2@test.test' } });
    const token = await prisma.emailVerificationToken.findFirst({ where: { userId: user!.id } });

    await request(app).post('/api/auth/verify-email').send({ token: token!.token }).expect(200);
    const replay = await request(app).post('/api/auth/verify-email').send({ token: token!.token });
    expect(replay.status).toBe(400);
  });

  it('an unknown token returns 400 with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'definitely-not-a-real-token-with-enough-length' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid verification token');
  });

  it('an expired token returns 400', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify3@test.test', password: STRONG, name: 'Verify3' });
    const user = await prisma.user.findUnique({ where: { email: 'verify3@test.test' } });
    // Force the token to be expired.
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const token = await prisma.emailVerificationToken.findFirst({ where: { userId: user!.id } });

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: token!.token });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/request-verification always responds 200 (no enumeration)', async () => {
    // Unknown email: 200
    const r1 = await request(app)
      .post('/api/auth/request-verification')
      .send({ email: 'nobody@who.test' });
    expect(r1.status).toBe(200);

    // Already verified: 200 (and no new token created)
    const r2 = await request(app)
      .post('/api/auth/request-verification')
      .send({ email: 'verify1@test.test' });
    expect(r2.status).toBe(200);
    const verified = await prisma.user.findUnique({ where: { email: 'verify1@test.test' } });
    const newTokens = await prisma.emailVerificationToken.findMany({
      where: { userId: verified!.id, usedAt: null },
    });
    expect(newTokens.length).toBe(0);
  });

  it('request-verification for an unverified user creates a fresh token', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify4@test.test', password: STRONG, name: 'Verify4' });
    const user = await prisma.user.findUnique({ where: { email: 'verify4@test.test' } });
    // Consume any existing tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user!.id },
      data: { usedAt: new Date() },
    });

    await request(app)
      .post('/api/auth/request-verification')
      .send({ email: 'verify4@test.test' })
      .expect(200);

    const fresh = await prisma.emailVerificationToken.findMany({
      where: { userId: user!.id, usedAt: null },
    });
    expect(fresh.length).toBe(1);
  });
});
