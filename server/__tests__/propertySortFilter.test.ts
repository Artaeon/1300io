import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let app: import('express').Express;
let adminToken: string;

const STRONG = 'Correct-Horse-Battery-42';

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  app = (await import('../index')).default;

  const pw = await bcrypt.hash(STRONG, 12);
  await prisma.user.create({
    data: { email: 'sort@test.test', password: pw, name: 'Sort Admin', role: 'ADMIN' },
  });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'sort@test.test', password: STRONG });
  adminToken = login.body.token;

  // Seed a set of properties we can verify ordering/filter against.
  // The trick: vary address, owner, units, and fabricate inspection
  // history that covers the three status buckets.
  const now = new Date();
  const yearAgoPlus2d = new Date(now.getTime() - 362 * 86_400_000); // valid
  const twoYearsAgo = new Date(now.getTime() - 720 * 86_400_000); // expired

  await prisma.property.createMany({
    data: [
      { address: 'Alpha-1', owner_name: 'Alpha Owner', units_count: 10 },
      { address: 'Bravo-2', owner_name: 'Bravo Owner', units_count: 3 },
      { address: 'Charlie-3', owner_name: 'Charlie Owner', units_count: 25 },
      { address: 'Delta-4', owner_name: 'Delta Owner', units_count: 1 },
    ],
  });
  const props = await prisma.property.findMany({ orderBy: { address: 'asc' } });

  // Bravo-2: valid (inspected a month ago)
  await prisma.inspection.create({
    data: {
      property_id: props[1]!.id,
      inspector_name: 'Test',
      status: 'COMPLETED',
      ended_at: yearAgoPlus2d,
    },
  });
  // Charlie-3: expired (inspected 2 years ago)
  await prisma.inspection.create({
    data: {
      property_id: props[2]!.id,
      inspector_name: 'Test',
      status: 'COMPLETED',
      ended_at: twoYearsAgo,
    },
  });
  // Alpha-1 and Delta-4 have no inspection → 'due'
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function list(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await request(app)
    .get(`/api/properties?${qs}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  return res.body;
}

describe('GET /api/properties — sort + filter', () => {
  it('sorts by address ascending', async () => {
    const body = await list({ sort: 'address', dir: 'asc' });
    const addrs = body.data.map((p: { address: string }) => p.address);
    expect(addrs).toEqual(['Alpha-1', 'Bravo-2', 'Charlie-3', 'Delta-4']);
    expect(body.sort).toBe('address');
    expect(body.dir).toBe('asc');
  });

  it('sorts by units_count descending', async () => {
    const body = await list({ sort: 'units_count', dir: 'desc' });
    const units = body.data.map((p: { units_count: number }) => p.units_count);
    expect(units).toEqual([25, 10, 3, 1]);
  });

  it('defaults to createdAt/desc when no sort param', async () => {
    const body = await list({});
    expect(body.sort).toBe('createdAt');
    expect(body.dir).toBe('desc');
  });

  it('falls back to createdAt/desc on unknown sort key', async () => {
    const body = await list({ sort: 'DROP-TABLE', dir: 'desc' });
    expect(body.sort).toBe('createdAt');
  });

  it("status='due' returns only properties never/not-inspected", async () => {
    const body = await list({ status: 'due' });
    const addrs = body.data.map((p: { address: string }) => p.address).sort();
    expect(addrs).toEqual(['Alpha-1', 'Delta-4']);
  });

  it("status='valid' returns only properties inspected within 1 year", async () => {
    const body = await list({ status: 'valid' });
    const addrs = body.data.map((p: { address: string }) => p.address);
    expect(addrs).toEqual(['Bravo-2']);
  });

  it("status='expired' returns only properties last inspected >1y ago", async () => {
    const body = await list({ status: 'expired' });
    const addrs = body.data.map((p: { address: string }) => p.address);
    expect(addrs).toEqual(['Charlie-3']);
  });

  it('unknown status is ignored (returns everything)', async () => {
    const body = await list({ status: 'garbage' });
    expect(body.data.length).toBe(4);
  });
});
