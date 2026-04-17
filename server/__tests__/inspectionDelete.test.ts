import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let app: import('express').Express;
let adminToken: string;
let propertyId: number;
let categoryId: number;
let itemId: number;

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  app = require('../index');

  const pw = await bcrypt.hash('Correct-Horse-Battery-42', 12);
  await prisma.user.create({
    data: { email: 'admin@inspdel.test', password: pw, name: 'Admin', role: 'ADMIN' },
  });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@inspdel.test', password: 'Correct-Horse-Battery-42' });
  adminToken = login.body.token;

  const prop = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ address: 'Insp Delete 1', owner_name: 'Test', units_count: 3 });
  propertyId = prop.body.id;

  const cat = await prisma.checklistCategory.create({
    data: {
      name: 'Dach',
      items: { create: [{ text: 'Kamin frei?' }] },
    },
    include: { items: true },
  });
  categoryId = cat.id;
  itemId = cat.items[0]!.id;
  void categoryId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('DELETE /api/inspections/:id', () => {
  it('deletes a DRAFT inspection and its results', async () => {
    // Create draft
    const ins = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ propertyId, inspectorName: 'Tester' });
    expect(ins.status).toBe(201);

    // Add a result with DEFECT status → also creates a DefectTracking row
    await request(app)
      .post(`/api/inspections/${ins.body.id}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ checklistItemId: itemId, status: 'DEFECT', comment: 'probe' });

    // Now delete it
    const del = await request(app)
      .delete(`/api/inspections/${ins.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    // Inspection gone, results gone, defect tracking resolved or gone
    const remaining = await prisma.inspection.findUnique({ where: { id: ins.body.id } });
    expect(remaining).toBeNull();
    const results = await prisma.inspectionResult.findMany({ where: { inspection_id: ins.body.id } });
    expect(results).toEqual([]);
    const openDefects = await prisma.defectTracking.findMany({
      where: { property_id: propertyId, status: 'OPEN' },
    });
    expect(openDefects).toEqual([]);
  });

  it('refuses to delete a COMPLETED inspection with 409', async () => {
    const ins = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ propertyId, inspectorName: 'Tester' });

    await request(app)
      .post(`/api/inspections/${ins.body.id}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ checklistItemId: itemId, status: 'OK' });

    const complete = await request(app)
      .post(`/api/inspections/${ins.body.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(complete.status).toBe(200);

    const del = await request(app)
      .delete(`/api/inspections/${ins.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(409);

    // Still exists
    const still = await prisma.inspection.findUnique({ where: { id: ins.body.id } });
    expect(still).not.toBeNull();
  });

  it('returns 404 for unknown inspection id', async () => {
    const del = await request(app)
      .delete('/api/inspections/9999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(404);
  });

  it('requires authentication', async () => {
    const ins = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ propertyId, inspectorName: 'Tester' });

    const del = await request(app).delete(`/api/inspections/${ins.body.id}`);
    expect(del.status).toBe(401);
  });

  it('writes an audit DELETE row', async () => {
    const ins = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ propertyId, inspectorName: 'Tester' });

    await request(app)
      .delete(`/api/inspections/${ins.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'DELETE', entityType: 'Inspection', entityId: ins.body.id },
    });
    expect(row).toBeTruthy();
  });
});
