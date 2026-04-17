import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * End-to-end happy path: register → login → create property → start
 * inspection → record one OK + one DEFECT result → complete →
 * download PDF + CSV → verify audit trail.
 *
 * This is the 'one test to prove the system works' gate. If any of
 * the finer-grained suites regress, this one should too.
 */

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

describe('End-to-end inspector happy path', () => {
  it('runs from empty DB to signed PDF report', async () => {
    // 1. Register. registerSchema enforces the password policy.
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'inspector@e2e.test', password: STRONG, name: 'Inspector E2E' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('INSPECTOR');

    // Promote to ADMIN so we can also hit /api/checklist + /api/users
    await prisma.user.update({
      where: { email: 'inspector@e2e.test' },
      data: { role: 'ADMIN' },
    });

    // 2. Login.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inspector@e2e.test', password: STRONG });
    expect(login.status).toBe(200);
    const token = login.body.token as string;
    expect(token).toBeTruthy();

    // 3. Seed a category with two items — Admin role can do this.
    const catRes = await request(app)
      .post('/api/checklist/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dach' });
    expect(catRes.status).toBe(201);
    const catId = catRes.body.id as number;

    const item1 = await request(app)
      .post('/api/checklist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Ziegelabdeckung vollständig?', category_id: catId });
    const item2 = await request(app)
      .post('/api/checklist/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Dachrinne frei?', category_id: catId });
    expect(item1.status).toBe(201);
    expect(item2.status).toBe(201);

    // 4. Create a property.
    const prop = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'Teststrasse 1, 1010 Wien', owner_name: 'E2E GmbH', units_count: 4 });
    expect(prop.status).toBe(201);
    const propId = prop.body.id as number;

    // 5. Start an inspection.
    const ins = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${token}`)
      .send({ propertyId: propId, inspectorName: 'Inspector E2E' });
    expect(ins.status).toBe(201);
    expect(ins.body.status).toBe('DRAFT');
    const insId = ins.body.id as number;

    // 6. Save one OK and one DEFECT result.
    const okRes = await request(app)
      .post(`/api/inspections/${insId}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checklistItemId: item1.body.id, status: 'OK' });
    expect(okRes.status).toBe(201);

    const defectRes = await request(app)
      .post(`/api/inspections/${insId}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        checklistItemId: item2.body.id,
        status: 'DEFECT',
        comment: 'Dachrinne an der Nordseite verstopft',
      });
    expect(defectRes.status).toBe(201);

    // 7. Validate completeness report.
    const validate = await request(app)
      .get(`/api/inspections/${insId}/validate`)
      .set('Authorization', `Bearer ${token}`);
    expect(validate.status).toBe(200);
    expect(validate.body.isComplete).toBe(true);
    expect(validate.body.answeredCount).toBe(2);

    // 8. Complete the inspection.
    const complete = await request(app)
      .post(`/api/inspections/${insId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('COMPLETED');
    expect(complete.body.ended_at).toBeTruthy();

    // 9. Download the PDF and verify it's a real one.
    const pdf = await request(app)
      .get(`/api/inspections/${insId}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    // PDF magic number
    expect(Buffer.from(pdf.body as Buffer).slice(0, 4).toString('ascii')).toBe('%PDF');

    // 10. Download CSV and check it contains the DEFECT row.
    const csv = await request(app)
      .get(`/api/inspections/${insId}/export/csv`)
      .set('Authorization', `Bearer ${token}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Dachrinne an der Nordseite verstopft');
    expect(csv.text).toContain('Mangel');

    // 11. The defect created an open DefectTracking row.
    const defects = await request(app)
      .get(`/api/properties/${propId}/defects`)
      .set('Authorization', `Bearer ${token}`);
    expect(defects.status).toBe(200);
    expect(defects.body.length).toBe(1);
    expect(defects.body[0].status).toBe('OPEN');

    // 12. Audit trail — expect at least: CREATE User, LOGIN_SUCCESS,
    //     CREATE ChecklistCategory x2 items, CREATE Property, CREATE
    //     Inspection, 2x CREATE InspectionResult, UPDATE (complete).
    const audit = await request(app)
      .get('/api/audit-logs?limit=20')
      .set('Authorization', `Bearer ${token}`);
    expect(audit.status).toBe(200);
    const actions = audit.body.data.map((r: { action: string; entityType: string }) => `${r.action}:${r.entityType}`);
    expect(actions).toContain('LOGIN_SUCCESS:User');
    expect(actions).toContain('CREATE:Property');
    expect(actions).toContain('CREATE:Inspection');
    expect(actions).toContain('UPDATE:Inspection'); // complete()
    expect(actions).toContain('CREATE:InspectionResult');
  });
});
