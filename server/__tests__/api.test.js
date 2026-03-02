const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Ensure test uploads directory exists
const testUploadDir = path.resolve(process.env.UPLOAD_DIR || './test-uploads');
if (!fs.existsSync(testUploadDir)) {
  fs.mkdirSync(testUploadDir, { recursive: true });
}

let app;
let authToken;
let readonlyToken;
let testPropertyId;
let testInspectionId;

beforeAll(async () => {
  // Push schema to test database
  const { execSync } = require('child_process');
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  // Import app after env is set
  app = require('../index');

  // Create test admin user
  const hashedPassword = await bcrypt.hash('testpassword123', 12);
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
    .send({ email: 'admin@test.com', password: 'testpassword123' });
  authToken = loginRes.body.token;

  // Login as readonly
  const readonlyRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'readonly@test.com', password: 'testpassword123' });
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
      .send({ email: 'newuser@test.com', password: 'password123', name: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User created');
    expect(res.body.user.role).toBe('INSPECTOR');
  });

  it('POST /api/auth/register should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', password: 'password123', name: 'Duplicate' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/register should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-email', password: 'password123', name: 'Bad Email' });
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
      .send({ email: 'admin@test.com', password: 'testpassword123' });
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
      .send({ email: 'nonexistent@test.com', password: 'password123' });
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

  it('GET /api/properties should return all properties', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
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

  it('GET /api/inspections/history should return completed inspections', async () => {
    const res = await request(app)
      .get('/api/inspections/history')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
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
