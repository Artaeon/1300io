import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let app: import('express').Express;

const ADMIN = {
  email: 'owner@1300.test',
  password: 'Sup3rSecret!Pass123',
  name: 'Initial Owner',
};
const ORG = { name: 'Initial Hausverwaltung GesbR' };

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

describe('Setup wizard', () => {
  it('status returns initialized=false when no admin exists', async () => {
    const res = await request(app).get('/api/setup/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ initialized: false });
  });

  it('non-admin users do not count as initialized', async () => {
    await prisma.user.create({
      data: {
        email: 'inspector@1300.test',
        password: await bcrypt.hash(ADMIN.password, 12),
        name: 'Inspector',
        role: 'INSPECTOR',
      },
    });
    const res = await request(app).get('/api/setup/status');
    expect(res.body).toEqual({ initialized: false });
    await prisma.user.deleteMany({});
  });

  it('initialize creates admin + org, returns working tokens', async () => {
    const res = await request(app)
      .post('/api/setup/initialize')
      .send({ admin: ADMIN, organization: ORG });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^eyJ/);
    expect(res.body.refreshToken).toHaveLength(64); // base64url of 48 bytes
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user.email).toBe(ADMIN.email);
    expect(res.body.organization.name).toBe(ORG.name);
    expect(res.body.user.organizationId).toBe(res.body.organization.id);

    // DB state: admin exists with emailVerified=true, linked to org.
    const user = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe('ADMIN');
    expect(user!.emailVerified).toBe(true);
    expect(user!.organizationId).not.toBeNull();

    // Refresh token persisted so the session actually works.
    const rt = await prisma.refreshToken.findUnique({
      where: { token: res.body.refreshToken },
    });
    expect(rt).not.toBeNull();
    expect(rt!.userId).toBe(user!.id);

    // Audit rows: CREATE Organization + CREATE User + LOGIN_SUCCESS.
    const audits = await prisma.auditLog.findMany({
      where: { userId: user!.id },
      orderBy: { id: 'asc' },
    });
    expect(audits.map((a) => a.action)).toEqual(['CREATE', 'CREATE', 'LOGIN_SUCCESS']);
    expect(audits[0].entityType).toBe('Organization');
    expect(audits[1].entityType).toBe('User');
    expect(audits[1].newData).toContain('"initialSetup":true');
  });

  it('status now reports initialized=true', async () => {
    const res = await request(app).get('/api/setup/status');
    expect(res.body).toEqual({ initialized: true });
  });

  it('initialize refuses to run a second time (409)', async () => {
    const res = await request(app)
      .post('/api/setup/initialize')
      .send({
        admin: { email: 'second@1300.test', password: ADMIN.password, name: 'Second' },
        organization: { name: 'Second Org' },
      });
    expect(res.status).toBe(409);
    // And nothing leaked into the DB.
    const user = await prisma.user.findUnique({ where: { email: 'second@1300.test' } });
    expect(user).toBeNull();
  });

  it('rejects weak passwords with 400 (policy enforced)', async () => {
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    const res = await request(app)
      .post('/api/setup/initialize')
      .send({
        admin: { email: 'weak@1300.test', password: 'short', name: 'Weak' },
        organization: { name: 'Weak Org' },
      });
    expect(res.status).toBe(400);
    const user = await prisma.user.findUnique({ where: { email: 'weak@1300.test' } });
    expect(user).toBeNull();
  });

  it('rejects bad email shape with 400', async () => {
    const res = await request(app)
      .post('/api/setup/initialize')
      .send({
        admin: { email: 'not-an-email', password: ADMIN.password, name: 'No' },
        organization: { name: 'Org' },
      });
    expect(res.status).toBe(400);
  });

  it('rejects empty organization name with 400', async () => {
    const res = await request(app)
      .post('/api/setup/initialize')
      .send({
        admin: ADMIN,
        organization: { name: '' },
      });
    expect(res.status).toBe(400);
  });
});
