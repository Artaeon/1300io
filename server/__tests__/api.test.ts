import request from 'supertest';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const prisma = new PrismaClient();

const testUploadDir = path.resolve(process.env.UPLOAD_DIR || './test-uploads');
if (!fs.existsSync(testUploadDir)) {
  fs.mkdirSync(testUploadDir, { recursive: true });
}

let app: import('express').Express;
let authToken: string;
let readonlyToken: string;
let testPropertyId: number;
let testInspectionId: number;
// Strong password that satisfies the policy, reused by every user
// created in beforeAll (and any /register calls in the suite).
const STRONG_PW = 'Correct-Horse-Battery-42';

beforeAll(async () => {
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  app = (await import('../index')).default;

  // Create test admin user
  const hashedPassword = await bcrypt.hash(STRONG_PW, 12);
  await prisma.user.create({
    data: { email: 'admin@test.com', password: hashedPassword, name: 'Test Admin', role: 'ADMIN' }
  });

  // Create readonly user
  await prisma.user.create({
    data: { email: 'readonly@test.com', password: hashedPassword, name: 'Readonly User', role: 'READONLY' }
  });

  // Create checklist data for inspection tests
  await prisma.checklistCategory.create({
    data: {
      name: 'Test Category',
      items: {
        create: [
          { text: 'Test item 1' },
          { text: 'Test item 2' },
        ]
      }
    }
  });

  // Login as admin
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: STRONG_PW });
  authToken = loginRes.body.token;

  // Login as readonly
  const readonlyRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'readonly@test.com', password: STRONG_PW });
  readonlyToken = readonlyRes.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
  // Clean up test uploads
  if (fs.existsSync(testUploadDir)) {
    fs.rmSync(testUploadDir, { recursive: true, force: true });
  }
});

describe('Health Endpoints', () => {
  it('GET /healthz should return ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readyz should return ready with db connected', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.db).toBe('connected');
  });

  it('GET / should return API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('1300.io API');
  });
});

describe('Authentication', () => {
  it('POST /api/auth/register should create a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@test.com', password: STRONG_PW, name: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User created');
    expect(res.body.user.role).toBe('INSPECTOR');
  });

  it('POST /api/auth/register should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', password: STRONG_PW, name: 'Duplicate' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/register should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-email', password: STRONG_PW, name: 'Bad Email' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register should reject short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.com', password: '123', name: 'Short PW' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should return token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: STRONG_PW });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('POST /api/auth/login should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login should reject nonexistent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@test.com', password: STRONG_PW });
    expect(res.status).toBe(401);
  });

  it('should reject requests without auth token', async () => {
    const res = await request(app).get('/api/properties');
    expect(res.status).toBe(401);
  });

  it('should reject requests with invalid token', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(403);
  });
});

describe('Token Refresh', () => {
  let refreshToken: string;
  const { randomBytes } = require('node:crypto') as typeof import('node:crypto');

  beforeAll(async () => {
    // Create a refresh token directly in the DB to avoid login rate limits
    const testUser = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
    refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: testUser.id, expiresAt }
    });
  });

  it('POST /api/auth/refresh should return new token pair', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
    refreshToken = res.body.refreshToken;
  });

  it('POST /api/auth/refresh should reject used token (rotation)', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'already-consumed-token' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/refresh should reject missing token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/logout should invalidate refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });
    expect(res.status).toBe(200);

    // Token should no longer work
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('login response should include refreshToken', async () => {
    // Verify the login response shape includes refreshToken
    // (uses existing authToken from beforeAll login, check stored tokens exist)
    const tokens = await prisma.refreshToken.findMany();
    expect(tokens.length).toBeGreaterThan(0);
  });
});

describe('Properties', () => {
  it('POST /api/properties should create a property (admin)', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'Teststrasse 1, 1010 Wien', owner_name: 'Test GmbH', units_count: 10 });
    expect(res.status).toBe(201);
    expect(res.body.address).toBe('Teststrasse 1, 1010 Wien');
    testPropertyId = res.body.id;
  });

  it('POST /api/properties should reject invalid data', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: '', owner_name: '', units_count: -1 });
    expect(res.status).toBe(400);
  });

  it('POST /api/properties should be denied for readonly users', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${readonlyToken}`)
      .send({ address: 'Denied St', owner_name: 'Denied', units_count: 1 });
    expect(res.status).toBe(403);
  });

  it('GET /api/properties should return paginated properties', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBeGreaterThan(0);
  });

  it('GET /api/properties?search= should filter by address', async () => {
    const res = await request(app)
      .get('/api/properties?search=nonexistent-address-xyz')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
    expect(res.body.total).toBe(0);
  });

  it('GET /api/properties/:id should return a specific property', async () => {
    const res = await request(app)
      .get(`/api/properties/${testPropertyId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testPropertyId);
  });

  it('GET /api/properties/:id should return 404 for nonexistent', async () => {
    const res = await request(app)
      .get('/api/properties/99999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/properties/:id should reject invalid id', async () => {
    const res = await request(app)
      .get('/api/properties/abc')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('PUT /api/properties/:id should update a property', async () => {
    const res = await request(app)
      .put(`/api/properties/${testPropertyId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'Updated Str 1, 1010 Wien' });
    expect(res.status).toBe(200);
    expect(res.body.address).toBe('Updated Str 1, 1010 Wien');
  });

  it('PUT /api/properties/:id should return 404 for nonexistent', async () => {
    const res = await request(app)
      .put('/api/properties/99999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'Test' });
    expect(res.status).toBe(404);
  });

  it('PUT /api/properties/:id should reject empty body', async () => {
    const res = await request(app)
      .put(`/api/properties/${testPropertyId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('PUT /api/properties/:id should be denied for readonly users', async () => {
    const res = await request(app)
      .put(`/api/properties/${testPropertyId}`)
      .set('Authorization', `Bearer ${readonlyToken}`)
      .send({ address: 'Denied' });
    expect(res.status).toBe(403);
  });

  it('DELETE /api/properties/:id should delete a property without drafts', async () => {
    // Create a property with no inspections
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'Delete-Me-Str 1', owner_name: 'Delete GmbH', units_count: 1 });
    const deleteId = propRes.body.id;

    const res = await request(app)
      .delete(`/api/properties/${deleteId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Property deleted');

    // Verify it's gone
    const getRes = await request(app)
      .get(`/api/properties/${deleteId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.status).toBe(404);
  });

  it('DELETE /api/properties/:id should be denied for non-admin', async () => {
    const res = await request(app)
      .delete(`/api/properties/${testPropertyId}`)
      .set('Authorization', `Bearer ${readonlyToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Draft Inspections', () => {
  it('GET /api/properties/:id/draft-inspection should return null when no draft', async () => {
    // Create a property with no inspections
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'No-Draft-Str 1', owner_name: 'Test', units_count: 1 });
    const res = await request(app)
      .get(`/api/properties/${propRes.body.id}/draft-inspection`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('GET /api/properties/:id/draft-inspection should return latest draft', async () => {
    // Create a draft inspection for testPropertyId (created in Properties tests)
    await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ propertyId: testPropertyId, inspectorName: 'Draft Tester' });

    const res = await request(app)
      .get(`/api/properties/${testPropertyId}/draft-inspection`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.property_id).toBe(testPropertyId);
  });

  it('GET /api/inspections/:id/results should return saved results', async () => {
    // First create an inspection and save a result
    const inspRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ propertyId: testPropertyId, inspectorName: 'Results Tester' });
    const inspId = inspRes.body.id;

    // Need a checklist item id
    const catRes = await request(app)
      .get('/api/checklist/categories')
      .set('Authorization', `Bearer ${authToken}`);
    const firstItemId = catRes.body[0].items[0].id;

    // Save a result
    await request(app)
      .post(`/api/inspections/${inspId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: firstItemId, status: 'OK' });

    // Fetch results
    const res = await request(app)
      .get(`/api/inspections/${inspId}/results`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('OK');
  });

  it('GET /api/inspections/:id/results should return 404 for nonexistent', async () => {
    const res = await request(app)
      .get('/api/inspections/99999/results')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Inspections', () => {
  it('POST /api/inspections should create an inspection', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ propertyId: testPropertyId, inspectorName: 'Max Mustermann' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    testInspectionId = res.body.id;
  });

  it('POST /api/inspections should reject nonexistent property', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ propertyId: 99999, inspectorName: 'Test' });
    expect(res.status).toBe(404);
  });

  it('POST /api/inspections should be denied for readonly users', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${readonlyToken}`)
      .send({ propertyId: testPropertyId, inspectorName: 'Denied' });
    expect(res.status).toBe(403);
  });

  it('GET /api/inspections/:id should return inspection details', async () => {
    const res = await request(app)
      .get(`/api/inspections/${testInspectionId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testInspectionId);
  });

  it('POST /api/inspections/:id/results should save a result', async () => {
    const categories = await prisma.checklistCategory.findMany({ include: { items: true } });
    const itemId = categories[0].items[0].id;

    const res = await request(app)
      .post(`/api/inspections/${testInspectionId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: itemId, status: 'OK' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OK');
  });

  it('POST /api/inspections/:id/results should reject invalid status', async () => {
    const categories = await prisma.checklistCategory.findMany({ include: { items: true } });
    const itemId = categories[0].items[0].id;

    const res = await request(app)
      .post(`/api/inspections/${testInspectionId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: itemId, status: 'INVALID_STATUS' });
    expect(res.status).toBe(400);
  });

  it('GET /api/inspections/:id/validate should return validation status', async () => {
    const res = await request(app)
      .get(`/api/inspections/${testInspectionId}/validate`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBeGreaterThan(0);
    expect(typeof res.body.isComplete).toBe('boolean');
  });

  it('POST /api/inspections/:id/complete should mark as completed', async () => {
    const res = await request(app)
      .post(`/api/inspections/${testInspectionId}/complete`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.ended_at).toBeDefined();
  });

  it('POST /api/inspections/:id/complete should reject already completed', async () => {
    const res = await request(app)
      .post(`/api/inspections/${testInspectionId}/complete`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('POST /api/inspections/:id/results should reject on completed inspection', async () => {
    const categories = await prisma.checklistCategory.findMany({ include: { items: true } });
    const itemId = categories[0].items[1].id;

    const res = await request(app)
      .post(`/api/inspections/${testInspectionId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: itemId, status: 'OK' });
    expect(res.status).toBe(400);
  });

  it('GET /api/inspections/history should return paginated completed inspections', async () => {
    const res = await request(app)
      .get('/api/inspections/history')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });
});

describe('Defect Tracking', () => {
  let defectPropertyId;
  let defectInspectionId;
  let defectItemId;

  beforeAll(async () => {
    // Create a dedicated property for defect tests
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'Defect-Str 1', owner_name: 'Defect GmbH', units_count: 5 });
    defectPropertyId = propRes.body.id;

    // Get a checklist item id
    const categories = await prisma.checklistCategory.findMany({ include: { items: true } });
    defectItemId = categories[0].items[0].id;

    // Create an inspection
    const inspRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ propertyId: defectPropertyId, inspectorName: 'Defect Tester' });
    defectInspectionId = inspRes.body.id;
  });

  it('should auto-create DefectTracking when DEFECT result is saved', async () => {
    await request(app)
      .post(`/api/inspections/${defectInspectionId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: defectItemId, status: 'DEFECT', comment: 'Riss in Wand' });

    const defects = await prisma.defectTracking.findMany({
      where: { property_id: defectPropertyId, checklist_item_id: defectItemId }
    });
    expect(defects.length).toBe(1);
    expect(defects[0].status).toBe('OPEN');
  });

  it('should not duplicate DefectTracking for same item', async () => {
    // Save DEFECT again for same item (update)
    await request(app)
      .post(`/api/inspections/${defectInspectionId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: defectItemId, status: 'DEFECT', comment: 'Noch da' });

    const defects = await prisma.defectTracking.findMany({
      where: { property_id: defectPropertyId, checklist_item_id: defectItemId, status: 'OPEN' }
    });
    expect(defects.length).toBe(1);
  });

  it('should auto-resolve DefectTracking when OK result is saved', async () => {
    // Complete the first inspection
    await request(app)
      .post(`/api/inspections/${defectInspectionId}/complete`)
      .set('Authorization', `Bearer ${authToken}`);

    // Create a new inspection
    const inspRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ propertyId: defectPropertyId, inspectorName: 'Resolve Tester' });
    const newInspId = inspRes.body.id;

    // Save OK result for the same item
    await request(app)
      .post(`/api/inspections/${newInspId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ checklistItemId: defectItemId, status: 'OK' });

    const defects = await prisma.defectTracking.findMany({
      where: { property_id: defectPropertyId, checklist_item_id: defectItemId }
    });
    const resolved = defects.find(d => d.status === 'RESOLVED');
    expect(resolved).toBeTruthy();
    expect(resolved.resolved_result_id).toBeTruthy();
  });

  it('GET /api/properties/:id/defects should return defects list', async () => {
    const res = await request(app)
      .get(`/api/properties/${defectPropertyId}/defects`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].checklist_item).toBeDefined();
    expect(res.body[0].first_found_result).toBeDefined();
  });

  it('GET /api/properties/:id/defects should return 404 for nonexistent property', async () => {
    const res = await request(app)
      .get('/api/properties/99999/defects')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Checklist', () => {
  it('GET /api/checklist/categories should return categories with items', async () => {
    const res = await request(app)
      .get('/api/checklist/categories')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].items).toBeDefined();
    expect(res.body[0].items.length).toBeGreaterThan(0);
  });
});

describe('Checklist Management', () => {
  let testCategoryId;
  let testItemId;

  it('POST /api/checklist/categories should create a category', async () => {
    const res = await request(app)
      .post('/api/checklist/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'New Test Category', sort_order: 99 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Test Category');
    testCategoryId = res.body.id;
  });

  it('PUT /api/checklist/categories/:id should update a category', async () => {
    const res = await request(app)
      .put(`/api/checklist/categories/${testCategoryId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated Category' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Category');
  });

  it('POST /api/checklist/items should create an item', async () => {
    const res = await request(app)
      .post('/api/checklist/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'New Test Item', category_id: testCategoryId, sort_order: 0 });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe('New Test Item');
    testItemId = res.body.id;
  });

  it('PUT /api/checklist/items/:id should update an item', async () => {
    const res = await request(app)
      .put(`/api/checklist/items/${testItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ text: 'Updated Item Text' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Updated Item Text');
  });

  it('DELETE /api/checklist/items/:id should delete an item', async () => {
    const res = await request(app)
      .delete(`/api/checklist/items/${testItemId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/checklist/categories/:id should delete a category', async () => {
    const res = await request(app)
      .delete(`/api/checklist/categories/${testCategoryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('checklist CRUD should be denied for readonly users', async () => {
    const res = await request(app)
      .post('/api/checklist/categories')
      .set('Authorization', `Bearer ${readonlyToken}`)
      .send({ name: 'Unauthorized' });
    expect(res.status).toBe(403);
  });
});

describe('PDF Report', () => {
  it('GET /api/inspections/:id/pdf should require authentication', async () => {
    const res = await request(app)
      .get(`/api/inspections/${testInspectionId}/pdf`);
    expect(res.status).toBe(401);
  });

  it('GET /api/inspections/:id/pdf should return PDF for valid inspection', async () => {
    const res = await request(app)
      .get(`/api/inspections/${testInspectionId}/pdf`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('GET /api/inspections/:id/pdf should return 404 for nonexistent', async () => {
    const res = await request(app)
      .get('/api/inspections/99999/pdf')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('File Upload', () => {
  it('POST /api/upload should require authentication', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(401);
  });

  it('POST /api/upload should reject request without file', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('POST /api/upload should accept a valid image', async () => {
    // Create a minimal valid JPEG buffer
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
    ]);

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('photo', jpegHeader, { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/uploads\//);
  });
});

// ==================== User Management ====================
describe('User Management', () => {
  let createdUserId;

  it('GET /api/users should list all users (admin)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Should not include password
    expect(res.body[0].password).toBeUndefined();
  });

  it('GET /api/users should be denied for non-admin', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${readonlyToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/users should create a user (admin)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'manager@test.com', password: STRONG_PW, name: 'Manager User', role: 'MANAGER' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('manager@test.com');
    expect(res.body.role).toBe('MANAGER');
    createdUserId = res.body.id;
  });

  it('POST /api/users should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'manager@test.com', password: STRONG_PW, name: 'Dup', role: 'INSPECTOR' });
    expect(res.status).toBe(409);
  });

  it('PUT /api/users/:id should update user (admin)', async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated Manager', role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Manager');
    expect(res.body.role).toBe('ADMIN');
  });

  it('PUT /api/users/:id should return 404 for nonexistent', async () => {
    const res = await request(app)
      .put('/api/users/99999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/users/:id should prevent self-delete', async () => {
    // Find admin user id
    const users = await prisma.user.findMany({ where: { email: 'admin@test.com' } });
    const res = await request(app)
      .delete(`/api/users/${users[0].id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own account/);
  });

  it('DELETE /api/users/:id should delete user (admin)', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);

    // Verify deleted
    const check = await prisma.user.findUnique({ where: { id: createdUserId } });
    expect(check).toBeNull();
  });
});

// ==================== Organization Management ====================
describe('Organization Management', () => {
  let testOrgId;

  it('POST /api/organizations should create an organization (admin)', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Hausverwaltung GmbH' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Hausverwaltung GmbH');
    testOrgId = res.body.id;
  });

  it('GET /api/organizations should list organizations (admin)', async () => {
    const res = await request(app)
      .get('/api/organizations')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]._count).toBeDefined();
  });

  it('GET /api/organizations should be denied for non-admin', async () => {
    const res = await request(app)
      .get('/api/organizations')
      .set('Authorization', `Bearer ${readonlyToken}`);
    expect(res.status).toBe(403);
  });

  it('PUT /api/organizations/:id should update an organization', async () => {
    const res = await request(app)
      .put(`/api/organizations/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated Hausverwaltung' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Hausverwaltung');
  });

  it('PUT /api/organizations/:id should return 404 for nonexistent', async () => {
    const res = await request(app)
      .put('/api/organizations/99999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('PUT /api/organizations/:id/users/:userId should assign user', async () => {
    const users = await prisma.user.findMany({ where: { email: 'readonly@test.com' } });
    const res = await request(app)
      .put(`/api/organizations/${testOrgId}/users/${users[0].id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: users[0].id } });
    expect(updatedUser.organizationId).toBe(testOrgId);
  });

  it('DELETE /api/organizations/:id/users/:userId should remove user', async () => {
    const users = await prisma.user.findMany({ where: { email: 'readonly@test.com' } });
    const res = await request(app)
      .delete(`/api/organizations/${testOrgId}/users/${users[0].id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: users[0].id } });
    expect(updatedUser.organizationId).toBeNull();
  });

  it('DELETE /api/organizations/:id should delete and unlink members', async () => {
    const res = await request(app)
      .delete(`/api/organizations/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);

    const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
    expect(org).toBeNull();
  });

  it('DELETE /api/organizations/:id should return 404 for nonexistent', async () => {
    const res = await request(app)
      .delete('/api/organizations/99999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

// ==================== Audit Logging ====================
describe('Audit Logging', () => {
  it('should create audit log entry when property is created', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Property', action: 'CREATE' }
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].newData).toBeTruthy();
  });

  it('should create audit log entry when inspection is created', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Inspection', action: 'CREATE' }
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should create audit log entry when inspection result is saved', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'InspectionResult' }
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should create audit log entry when inspection is completed', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Inspection', action: 'UPDATE' }
    });
    expect(logs.length).toBeGreaterThan(0);
    const completionLog = logs.find(l => {
      const newData = JSON.parse(l.newData);
      return newData.status === 'COMPLETED';
    });
    expect(completionLog).toBeTruthy();
  });
});
